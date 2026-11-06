import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { createOAuthHandler, isAuthConfigured, verifyAccessIdentity, type AuthEnv, type AuthProps } from '../src/auth';

vi.mock('cloudflare:workers', () => ({ WorkerEntrypoint: class WorkerEntrypoint {} }));

const ORIGIN = 'https://media-mcp.example.com';
const TEAM = 'example.cloudflareaccess.com';
const AUD = 'a'.repeat(64);
const EMAIL = 'owner@example.com';
const CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect';

// Only the KV API is replaced. OAuth parsing, encryption, signatures, consent,
// PKCE, grants, access-token checks and refresh rotation use the real library.
function memoryKv(): KVNamespace {
  const entries = new Map<string, { value: string; metadata?: unknown; expires?: number }>();
  const get = vi.fn(async (key: string | string[], options?: string | { type?: string }) => {
    const read = (name: string) => {
      const entry = entries.get(name);
      if (!entry || (entry.expires !== undefined && entry.expires <= Date.now())) return null;
      const type = typeof options === 'string' ? options : options?.type;
      return type === 'json' ? JSON.parse(entry.value) : entry.value;
    };
    return Array.isArray(key) ? new Map(key.map(name => [name, read(name)])) : read(key);
  });
  return {
    get,
    put: vi.fn(async (key: string, value: string, options?: { metadata?: unknown; expirationTtl?: number }) => {
      entries.set(key, { value, metadata: options?.metadata, expires: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined });
    }),
    delete: vi.fn(async (key: string) => { entries.delete(key); }),
    list: vi.fn(async (options?: { prefix?: string; limit?: number }) => ({
      keys: [...entries.entries()].filter(([key]) => key.startsWith(options?.prefix ?? ''))
        .slice(0, options?.limit ?? 1000).map(([name, entry]) => ({ name, metadata: entry.metadata })),
      list_complete: true,
      cacheStatus: null,
    })),
    getWithMetadata: vi.fn(),
  } as KVNamespace;
}

function executionContext(): ExecutionContext {
  // Authentication uses only props and waitUntil; Workers-specific tracing is
  // exercised by the parent application's runtime smoke test.
  return { waitUntil() {}, passThroughOnException() {}, props: {}, exports: {} as Cloudflare.Exports, mapVirtualHost() { return ''; }, abort() {}, tracing: {} as Tracing };
}

let privateKey: CryptoKey;
let keySet: JWTVerifyGetKey;
let env: AuthEnv;
let captured: AuthProps[];
let handler: ReturnType<typeof createOAuthHandler<AuthEnv>>;

beforeAll(async () => {
  const keys = await generateKeyPair('RS256', { extractable: true });
  privateKey = keys.privateKey;
  keySet = createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'test-access-key', alg: 'RS256', use: 'sig' }] });
});

beforeEach(() => {
  env = { OAUTH_KV: memoryKv(), SERVER_ORIGIN: ORIGIN, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ALLOWED_EMAIL: EMAIL };
  captured = [];
  handler = createOAuthHandler({
    fetch(_request, _env, ctx) {
      captured.push(ctx.props);
      return Response.json({ authenticated: true, scopes: ctx.props.scopes });
    },
  }, { accessKeySet: keySet });
});

async function accessToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: 'owner-subject', email: EMAIL, type: 'app', iss: `https://${TEAM}`, aud: [AUD], iat: now, exp: now + 600,
    ...overrides,
  }).setProtectedHeader({ alg: 'RS256', kid: 'test-access-key' }).sign(privateKey);
}

async function request(path: string, init: RequestInit = {}) {
  return handler.fetch(new Request(`${ORIGIN}${path}`, init), env, executionContext());
}

async function registerClient(name = 'ChatGPT') {
  const response = await request('/oauth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_name: name, redirect_uris: [CALLBACK], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }),
  });
  expect(response.status).toBe(201);
  const data = await response.json() as { client_id: string };
  expect(typeof data.client_id).toBe('string');
  return data.client_id;
}

async function beginAuthorization(options: { clientName?: string; scopes?: string[]; claims?: Record<string, unknown>; query?: Record<string, string> } = {}) {
  const clientId = await registerClient(options.clientName);
  const verifier = 'v'.repeat(64);
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))).toString('base64url');
  const scopes = options.scopes ?? ['media:read', 'media:write', 'media:delete', 'offline_access'];
  const access = await accessToken(options.claims);
  const query = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: CALLBACK,
    scope: scopes.join(' '), state: 'client-state', code_challenge: challenge, code_challenge_method: 'S256', resource: `${ORIGIN}/mcp`, ...options.query });
  const response = await request(`/authorize?${query}`, { headers: { 'Cf-Access-Jwt-Assertion': access } });
  const html = await response.text();
  const handle = /name="handle" value="([A-Za-z0-9_-]+)"/.exec(html)?.[1] ?? '';
  const cookie = response.headers.get('Set-Cookie')?.split(';', 1)[0] ?? '';
  return { clientId, verifier, access, scopes, response, html, handle, cookie };
}

async function approve(consent: Awaited<ReturnType<typeof beginAuthorization>>, overrides: { cookie?: string; origin?: string; access?: string; decision?: string; scopes?: string[] } = {}) {
  const form = new URLSearchParams({ handle: consent.handle, decision: overrides.decision ?? 'approve' });
  for (const scope of overrides.scopes ?? consent.scopes) form.append('scope', scope);
  return request('/authorize', { method: 'POST', headers: {
    'Content-Type': 'application/x-www-form-urlencoded', Origin: overrides.origin ?? ORIGIN,
    Cookie: overrides.cookie ?? consent.cookie, 'Cf-Access-Jwt-Assertion': overrides.access ?? consent.access,
  }, body: form.toString() });
}

async function exchangeCode(clientId: string, code: string, verifier: string) {
  return request('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: CALLBACK, code_verifier: verifier, resource: `${ORIGIN}/mcp` }).toString() });
}

describe('authentication boundary', () => {
  it('fails closed when configuration is incomplete and never reaches MCP', async () => {
    env.ACCESS_AUD = '';
    expect(isAuthConfigured(env)).toBe(false);
    const response = await request('/mcp', { method: 'POST', body: '{}' });
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"authentication_not_configured"}');
    expect(captured).toHaveLength(0);
  });

  it('publishes OAuth discovery and protects MCP with an audience-specific challenge', async () => {
    const resource = await request('/.well-known/oauth-protected-resource/mcp');
    expect(await resource.json()).toMatchObject({ resource: `${ORIGIN}/mcp`, authorization_servers: [ORIGIN], scopes_supported: ['media:read'] });
    const discovery = await request('/.well-known/oauth-authorization-server');
    expect(await discovery.json()).toMatchObject({ issuer: ORIGIN, code_challenge_methods_supported: ['S256'], authorization_response_iss_parameter_supported: true, token_endpoint: `${ORIGIN}/oauth/token`, registration_endpoint: `${ORIGIN}/oauth/register` });
    const response = await request('/mcp', { method: 'POST', body: '{}' });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`);
    expect(captured).toHaveLength(0);
  });

  it('does not disclose a supplied token in an authentication error', async () => {
    const supplied = 'fake-sensitive-token-never-echo';
    const response = await request('/mcp', { headers: { Authorization: `Bearer ${supplied}` } });
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain(supplied);
    expect(JSON.stringify([...response.headers])).not.toContain(supplied);
    expect(captured).toHaveLength(0);
  });

  it('does not trust an unsigned email header or unsigned Access JWT', async () => {
    const headerOnly = await request('/authorize', { headers: { 'Cf-Access-Authenticated-User-Email': EMAIL } });
    expect(headerOnly.status).toBe(401);
    const tampered = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ email: EMAIL })).toString('base64url')}.`;
    const response = await request('/authorize', { headers: { 'Cf-Access-Jwt-Assertion': tampered } });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(tampered);
  });

  it.each([
    ['wrong audience', { aud: ['other-audience'] }], ['wrong issuer', { iss: 'https://other.cloudflareaccess.com' }],
    ['expired', { exp: 1 }], ['other email', { email: 'someone-else@example.com' }],
    ['service identity', { sub: '' }], ['org session', { type: 'org' }],
  ])('rejects Access JWT with %s', async (_label, claims) => {
    await expect(verifyAccessIdentity(new Request(`${ORIGIN}/authorize`, { headers: { 'Cf-Access-Jwt-Assertion': await accessToken(claims) } }), env, keySet)).rejects.toThrow('access_denied');
  });

  it('rejects a token signed by an untrusted key', async () => {
    const other = await generateKeyPair('RS256');
    const signed = await new SignJWT({ sub: 'owner-subject', email: EMAIL, type: 'app' }).setProtectedHeader({ alg: 'RS256', kid: 'test-access-key' })
      .setIssuer(`https://${TEAM}`).setAudience(AUD).setIssuedAt().setExpirationTime('10m').sign(other.privateKey);
    await expect(verifyAccessIdentity(new Request(`${ORIGIN}/authorize`, { headers: { 'Cf-Access-Jwt-Assertion': signed } }), env, keySet)).rejects.toThrow('access_denied');
  });

  it('guards the browser delete route with the same verified identity', async () => {
    const callback = vi.fn(async (_request: Request, identity: AuthProps) => Response.json({ subject: identity.subject }));
    const protectedHandler = createOAuthHandler({ fetch: () => new Response('mcp') }, { accessKeySet: keySet, authorizeDelete: callback });
    const denied = await protectedHandler.fetch(new Request(`${ORIGIN}/authorize/delete`), env, executionContext());
    expect(denied.status).toBe(401);
    expect(callback).not.toHaveBeenCalled();
    const accepted = await protectedHandler.fetch(new Request(`${ORIGIN}/authorize/delete`, { headers: { 'Cf-Access-Jwt-Assertion': await accessToken() } }), env, executionContext());
    expect(accepted.status).toBe(200);
    expect(callback).toHaveBeenCalledOnce();
    expect(await accepted.json()).toEqual({ subject: 'owner-subject' });
  });
});

describe('real OAuth consent and token lifecycle', () => {
  it('completes DCR, PKCE and explicit consent, then authenticates MCP and refreshes', async () => {
    const consent = await beginAuthorization();
    expect(consent.response.status).toBe(200);
    expect(consent.html).toContain('chatgpt.com');
    expect(consent.response.headers.get('Set-Cookie')).toContain('Secure');
    expect(consent.response.headers.get('Set-Cookie')).toContain('HttpOnly');
    const approved = await approve(consent);
    expect(approved.status).toBe(302);
    const redirect = new URL(approved.headers.get('Location')!);
    expect(redirect.origin).toBe('https://chatgpt.com');
    expect(redirect.searchParams.get('state')).toBe('client-state');
    expect(redirect.searchParams.get('iss')).toBe(ORIGIN);
    const exchanged = await exchangeCode(consent.clientId, redirect.searchParams.get('code')!, consent.verifier);
    expect(exchanged.status).toBe(200);
    const token = await exchanged.json() as { access_token: string; refresh_token: string };
    const mcp = await request('/mcp', { headers: { Authorization: `Bearer ${token.access_token}` } });
    expect(mcp.status).toBe(200);
    expect(captured[0]).toEqual({ subject: 'owner-subject', email: EMAIL, scopes: consent.scopes });
    const refreshed = await request('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: consent.clientId, refresh_token: token.refresh_token, resource: `${ORIGIN}/mcp`, scope: 'media:read' }).toString() });
    expect(refreshed.status).toBe(200);
    const next = await refreshed.json() as { access_token: string; refresh_token: string };
    expect(next.refresh_token).not.toBe(token.refresh_token);
    await request('/mcp', { headers: { Authorization: `Bearer ${next.access_token}` } });
    expect(captured[1].scopes).toEqual(['media:read']);
  });

  it('requires S256 and rejects unsafe redirect substitution', async () => {
    expect((await beginAuthorization({ query: { code_challenge_method: 'plain' } })).response.status).toBe(400);
    expect((await beginAuthorization({ query: { redirect_uri: 'https://attacker.invalid/callback' } })).response.status).toBe(400);
    expect((await beginAuthorization({ query: { resource: 'https://other.example.com/mcp' } })).response.status).toBe(400);
  });

  it('escapes untrusted client names and blocks embedding', async () => {
    const consent = await beginAuthorization({ clientName: '<script>alert(1)</script>' });
    expect(consent.html).not.toContain('<script>');
    expect(consent.html).toContain('&lt;script&gt;');
    expect(consent.response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(consent.response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('rejects cross-site and cross-browser consent posts', async () => {
    const consent = await beginAuthorization();
    expect((await approve(consent, { origin: 'https://attacker.invalid' })).status).toBe(403);
    expect((await approve(consent, { cookie: '' })).status).toBe(400);
    expect((await approve(consent)).status).toBe(302);
    expect((await approve(consent)).status).toBe(403);
  });

  it('binds consent to the authenticated subject even with a valid cookie', async () => {
    const consent = await beginAuthorization();
    const otherSubject = await accessToken({ sub: 'different-owner-subject' });
    expect((await approve(consent, { access: otherSubject })).status).toBe(403);
  });

  it('cannot grant a scope that was absent from the shown consent screen', async () => {
    const consent = await beginAuthorization({ scopes: ['media:read'] });
    expect((await approve(consent, { scopes: ['media:read', 'media:delete'] })).status).toBe(400);
    expect((await approve(consent, { scopes: ['media:read'] })).status).toBe(302);
  });

  it('rejects unsupported scopes and does not authorize a rejected consent', async () => {
    expect((await beginAuthorization({ scopes: ['media:read', 'account:admin'] })).response.status).toBe(400);
    const consent = await beginAuthorization();
    const denied = await approve(consent, { decision: 'deny' });
    expect(denied.status).toBe(302);
    const redirect = new URL(denied.headers.get('Location')!);
    expect(redirect.searchParams.get('error')).toBe('access_denied');
    expect(redirect.searchParams.has('code')).toBe(false);
    expect((await approve(consent)).status).toBe(403);
  });

  it('rejects a wrong PKCE verifier and an oversized auth request without reflecting secrets', async () => {
    const consent = await beginAuthorization();
    const approved = await approve(consent);
    const code = new URL(approved.headers.get('Location')!).searchParams.get('code')!;
    const wrong = await exchangeCode(consent.clientId, code, 'wrong-verifier'.repeat(5));
    expect(wrong.status).toBe(400);
    expect(await wrong.text()).not.toContain(code);
    const oversized = await request('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(32769) });
    expect(oversized.status).toBe(413);
  });

  it('ends a stalled OAuth request body without waiting for stream cancellation', async () => {
    vi.useFakeTimers();
    try {
      const body = new ReadableStream<Uint8Array>({
        pull: () => new Promise<void>(() => {}),
        cancel: () => new Promise<void>(() => {}),
      });
      const init: RequestInit & { duplex: 'half' } = {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half',
      };
      const responsePromise = request('/oauth/register', init);
      await vi.advanceTimersByTimeAsync(10_001);
      const response = await responsePromise;
      expect(response.status).toBe(408);
      expect(await response.json()).toEqual({ error: 'request_timeout' });
    } finally { vi.useRealTimers(); }
  });
});
