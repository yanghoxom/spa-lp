import {
  AuthorizationError,
  OAuthAuthorizationServer,
  OAuthResourceServer,
  insufficientScope,
  type AuthRequest,
  type ConsentDescription,
  type OAuthHelpers,
  type OAuthResourceContext,
} from '@cloudflare/workers-oauth-provider';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { readBoundedBody } from './download';
import { MediaError } from './validation';

/** OAuth state is deliberately isolated from the image namespace. */
export interface AuthEnv {
  OAUTH_KV: KVNamespace;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ALLOWED_EMAIL: string;
  SERVER_ORIGIN: string;
}

export interface AuthProps {
  subject: string;
  email: string;
  /** On MCP calls this is replaced with the verified access token's scope. */
  scopes?: string[];
}

export type AuthenticatedHandler<E extends AuthEnv> = {
  fetch(request: Request, env: E, ctx: OAuthResourceContext<AuthProps>): Response | Promise<Response>;
};

export interface AuthOptions<E extends AuthEnv> {
  /** Browser-only destructive-action approval, always behind verified Access identity. */
  authorizeDelete?: (request: Request, identity: AuthProps, env: E) => Promise<Response>;
  /** Dependency injection for local, cryptographic JWT tests. Never read from an HTTP input. */
  accessKeySet?: JWTVerifyGetKey;
}

export const OAUTH_SCOPES = ['media:read', 'media:write', 'media:delete', 'offline_access'] as const;
const CONSENT_TTL_SECONDS = 600;
const MAX_AUTH_BODY_BYTES = 32 * 1024;
const AUTH_BODY_TIMEOUT_MS = 10_000;
const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff' };

class AuthFailure extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

interface AuthConfig {
  origin: string;
  issuer: string;
  audience: string;
  email: string;
}

function authConfig(env: AuthEnv): AuthConfig {
  try {
    if (!env.OAUTH_KV || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ALLOWED_EMAIL || !env.SERVER_ORIGIN) {
      throw new Error();
    }
    const origin = new URL(env.SERVER_ORIGIN);
    const local = origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
    if ((!local && origin.protocol !== 'https:') || origin.origin !== env.SERVER_ORIGIN || origin.username || origin.password) {
      throw new Error();
    }
    const team = new URL(env.ACCESS_TEAM_DOMAIN.startsWith('https://')
      ? env.ACCESS_TEAM_DOMAIN : `https://${env.ACCESS_TEAM_DOMAIN}`);
    if (team.protocol !== 'https:' || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team.hostname)
      || team.pathname !== '/' || team.search || team.hash || team.port || team.username || team.password) {
      throw new Error();
    }
    if (!/^[a-zA-Z0-9_-]{16,256}$/.test(env.ACCESS_AUD) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ALLOWED_EMAIL)) {
      throw new Error();
    }
    return { origin: origin.origin, issuer: team.origin, audience: env.ACCESS_AUD, email: env.ALLOWED_EMAIL.toLowerCase() };
  } catch {
    throw new AuthFailure(503, 'authentication_not_configured');
  }
}

/** Public readiness check: exposes no identity, keys, or tokens. */
export function isAuthConfigured(env: AuthEnv): boolean {
  try { authConfig(env); return true; } catch { return false; }
}

function failResponse(error: unknown): Response {
  if (error instanceof AuthFailure) return Response.json({ error: error.code }, { status: error.status, headers: NO_STORE });
  if (error instanceof AuthorizationError) {
    // Do not reflect exception descriptions, request URLs, authorization codes or tokens.
    return Response.json({ error: 'invalid_authorization_request' }, { status: 400, headers: NO_STORE });
  }
  return Response.json({ error: 'authentication_unavailable' }, { status: 503, headers: NO_STORE });
}

/** Verify the signed Access JWT; the email header alone is never trusted. */
export async function verifyAccessIdentity(request: Request, env: AuthEnv, keySet?: JWTVerifyGetKey): Promise<AuthProps> {
  const config = authConfig(env);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16 * 1024) throw new AuthFailure(401, 'authentication_required');
  try {
    const keys = keySet ?? createRemoteJWKSet(new URL(`${config.issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'],
      clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 256
      || typeof payload.email !== 'string' || payload.email.toLowerCase() !== config.email
      || payload.type !== 'app') {
      throw new Error();
    }
    return { subject: payload.sub, email: payload.email.toLowerCase() };
  } catch {
    throw new AuthFailure(403, 'access_denied');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

const SCOPE_LABELS: Record<string, string> = {
  'media:read': 'Xem danh sách, tải ảnh gốc từ KV, xem metadata và kiểm tra CDN',
  'media:write': 'Tải ảnh mới lên CDN công khai bằng đường dẫn có phiên bản',
  'media:delete': 'Yêu cầu xóa từng ảnh; mỗi lần xóa vẫn cần chị xác nhận riêng',
  offline_access: 'Duy trì kết nối bằng refresh token; có thể thu hồi kết nối',
};

/** Every value from client metadata is escaped. No third-party fonts, scripts, or images. */
function consentPage(details: ConsentDescription, handle: string): string {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kết nối kho ảnh · Phùng Hà Korea</title><style>
body{margin:0;padding:32px 20px;background:#fbf7f1;color:#392d30;font:17px/1.6 system-ui,sans-serif}main{max-width:600px;margin:4vh auto;background:white;border:1px solid #eaded0;border-radius:20px;padding:32px}h1{font-size:26px;line-height:1.3}label{display:block;padding:12px 0;border-bottom:1px solid #eee}input{margin-right:10px}button{margin:24px 10px 0 0;border:0;border-radius:10px;padding:12px 22px;background:#71484b;color:white;font:inherit;cursor:pointer}button[value="deny"]{background:#eee7df;color:#392d30}.note{font-size:14px;color:#66585d;overflow-wrap:anywhere}
</style></head><body><main><p>PHÙNG HÀ KOREA</p><h1>Cho phép ${escapeHtml(details.clientName)} quản lý ảnh?</h1>
<p>Quyền truy cập sẽ được gửi đến <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
${details.clientDomain ? `<p class="note">Tên miền của ứng dụng: ${escapeHtml(details.clientDomain)}</p>` : ''}
<p>Chỉ áp dụng cho ảnh trong <strong>/assets/</strong>. Những ảnh tải lên sẽ xuất hiện công khai tại cdn.phunghakorea.com.</p>
<form method="post" action="/authorize"><input type="hidden" name="handle" value="${escapeHtml(handle)}">
${details.scope.map(scope => `<label><input type="checkbox" name="scope" value="${escapeHtml(scope)}" checked>${escapeHtml(SCOPE_LABELS[scope] ?? scope)}</label>`).join('')}
<button name="decision" value="approve">Cho phép kết nối</button><button name="decision" value="deny">Hủy</button></form>
<p class="note">Không cấp quyền quản lý DNS, billing, tài khoản hoặc secrets. Chị không cần đưa API token vào cuộc trò chuyện.</p></main></body></html>`;
}

function validateAuthRequest(request: AuthRequest): void {
  // Require S256 for confidential clients too; MCP authorization never uses plain PKCE.
  if (request.codeChallengeMethod !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(request.codeChallenge ?? '')) {
    throw new AuthFailure(400, 'pkce_s256_required');
  }
  if (request.scope.some(scope => !(OAUTH_SCOPES as readonly string[]).includes(scope))) {
    throw new AuthFailure(400, 'invalid_scope');
  }
}

async function consentOwnerKey(handle: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(handle));
  return `phungha-consent-owner:${Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

interface ConsentOwner { subject: string; email: string; expiresAt: number; scopes: string[] }

async function boundedBody(request: Request, limit = MAX_AUTH_BODY_BYTES): Promise<Request> {
  const declared = request.headers.get('Content-Length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new AuthFailure(413, 'request_too_large');
  if (!request.body) return request;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), AUTH_BODY_TIMEOUT_MS);
  try {
    // A single fixed-capacity buffer also bounds bookkeeping for tiny chunks.
    // The helper races stalled reads/cancellation against this whole-body deadline.
    const body = await readBoundedBody(new Response(request.body), limit, controller.signal);
    return new Request(request.url, { method: request.method, headers: request.headers, body });
  } catch (error) {
    if (controller.signal.aborted) throw new AuthFailure(408, 'request_timeout');
    if (error instanceof MediaError && error.code === 'IMAGE_TOO_LARGE') throw new AuthFailure(413, 'request_too_large');
    throw new AuthFailure(400, 'invalid_request_body');
  } finally { clearTimeout(deadline); }
}

export async function handleAuthorize(
  request: Request, env: AuthEnv, oauth: OAuthHelpers, identity: AuthProps,
): Promise<Response> {
  if (request.method === 'GET') {
    const authRequest = await oauth.parseAuthRequest(request);
    validateAuthRequest(authRequest);
    // A client that omits scope sees all media permissions in the consent UI.
    // Explicit narrower client scope requests are never elevated.
    if (authRequest.scope.length === 0) authRequest.scope = [...OAUTH_SCOPES];
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    await env.OAUTH_KV.put(await consentOwnerKey(consent.handle), JSON.stringify({
      subject: identity.subject, email: identity.email, expiresAt: Date.now() + CONSENT_TTL_SECONDS * 1000,
      scopes: [...authRequest.scope],
    } satisfies ConsentOwner), { expirationTtl: CONSENT_TTL_SECONDS });
    consent.headers.set('Content-Type', 'text/html; charset=utf-8');
    consent.headers.set('Cache-Control', 'no-store');
    consent.headers.set('Referrer-Policy', 'same-origin');
    // Browsers apply form-action to the OAuth 302 redirect after POST as well as the form target.
    // Permit only the redirect origin already validated against the registered OAuth client.
    const redirect = new URL(authRequest.redirectUri);
    const loopback = redirect.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname);
    if ((redirect.protocol !== 'https:' && !loopback) || redirect.username || redirect.password) {
      throw new AuthFailure(400, 'invalid_redirect_uri');
    }
    consent.headers.set('Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' ${redirect.origin}; base-uri 'none'; frame-ancestors 'none'`);
    consent.headers.set('X-Frame-Options', 'DENY');
    consent.headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(consentPage(details, consent.handle), { headers: consent.headers });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...NO_STORE, Allow: 'GET, POST' } });
  if (request.headers.get('Origin') !== authConfig(env).origin) throw new AuthFailure(403, 'invalid_consent_origin');
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    throw new AuthFailure(415, 'unsupported_media_type');
  }
  const bounded = await boundedBody(request);
  const form = new URLSearchParams(await bounded.text());
  if (form.getAll('handle').length !== 1 || form.getAll('decision').length !== 1) throw new AuthFailure(400, 'invalid_consent');
  const handle = form.get('handle') ?? '';
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(handle)) throw new AuthFailure(400, 'invalid_consent');
  const ownerKey = await consentOwnerKey(handle);
  const owner = await env.OAUTH_KV.get<ConsentOwner>(ownerKey, 'json');
  if (!owner || owner.subject !== identity.subject || owner.email !== identity.email
    || typeof owner.expiresAt !== 'number' || owner.expiresAt <= Date.now() || !Array.isArray(owner.scopes)) {
    throw new AuthFailure(403, 'invalid_consent');
  }
  if (form.get('decision') === 'deny') {
    const denied = await oauth.denyConsent(bounded, handle);
    await env.OAUTH_KV.delete(ownerKey);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  if (form.get('decision') !== 'approve') throw new AuthFailure(400, 'invalid_consent');
  const scopes = [...new Set(form.getAll('scope'))];
  if (!scopes.includes('media:read') || scopes.some(scope => !(OAUTH_SCOPES as readonly string[]).includes(scope) || !owner.scopes.includes(scope))) {
    throw new AuthFailure(400, 'invalid_scope');
  }
  const approved = await oauth.approveConsent(bounded, handle, { scope: scopes });
  await env.OAUTH_KV.delete(ownerKey);
  validateAuthRequest(approved.request);
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: encodeURIComponent(identity.subject),
    metadata: {},
    scope: approved.request.scope,
    props: { subject: identity.subject, email: identity.email, scopes: approved.request.scope } satisfies AuthProps,
  });
  approved.headers.set('Location', redirectTo);
  approved.headers.set('Cache-Control', 'no-store');
  approved.headers.set('Referrer-Policy', 'no-referrer');
  return new Response(null, { status: 302, headers: approved.headers });
}

/** Same-Worker AS + resource server. Only /mcp is exposed to the authenticated handler. */
export function createOAuthHandler<E extends AuthEnv>(apiHandler: AuthenticatedHandler<E>, options: AuthOptions<E> = {}) {
  return {
    async fetch(request: Request, env: E, ctx: ExecutionContext): Promise<Response> {
      try {
        const config = authConfig(env);
        const url = new URL(request.url);
        if (url.origin !== config.origin) return new Response(null, { status: 404, headers: NO_STORE });
        const authServer = new OAuthAuthorizationServer<E>({
          issuer: config.origin,
          resources: [`${config.origin}/mcp`],
          scopesSupported: [...OAUTH_SCOPES],
          authorizeEndpoint: '/authorize',
          tokenEndpoint: '/oauth/token',
          clientRegistrationEndpoint: '/oauth/register',
          clientIdMetadataDocumentEnabled: true,
          accessTokenTTL: 3600,
          refreshTokenTTL: 30 * 24 * 60 * 60,
          allowTokenExchangeGrant: false,
          // Disable the library's default error logging, which can carry request diagnostics.
          onError: ({ code, status, headers }) => Response.json({ error: code }, {
            status, headers: { ...headers, ...NO_STORE },
          }),
        });
        if (url.pathname === '/authorize' || url.pathname === '/authorize/delete') {
          const identity = await verifyAccessIdentity(request, env, options.accessKeySet);
          if (url.pathname === '/authorize/delete') {
            const bounded = request.method === 'POST' ? await boundedBody(request, 4096) : request;
            return options.authorizeDelete ? await options.authorizeDelete(bounded, identity, env)
              : new Response(null, { status: 404, headers: NO_STORE });
          }
          return await handleAuthorize(request, env, authServer.getOAuthApi(env), identity);
        }
        if (url.pathname === '/mcp' || url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
          const resourceServer = new OAuthResourceServer<E, AuthProps>({
            resourceMetadata: {
              resource: `${config.origin}/mcp`, authorization_servers: [config.origin], resource_name: 'Phùng Hà Korea Media',
            },
            requiredScopes: ['media:read'],
            validateToken: currentEnv => async (resource, token) => {
              if (token.length > 16 * 1024) return null;
              const verified = await authServer.validateToken<unknown>(resource, token, currentEnv);
              if (!verified || typeof verified.props !== 'object' || verified.props === null) return null;
              const props = verified.props as Record<string, unknown>;
              if (typeof props.subject !== 'string' || !props.subject || props.email !== config.email) return null;
              return {
                ...verified,
                props: { subject: props.subject, email: config.email, scopes: [...verified.scope] },
              };
            },
            handler: {
              fetch(req, currentEnv, context) {
                if (!context.auth.scope.includes('media:read')) return insufficientScope(context.auth, ['media:read']);
                return apiHandler.fetch(req, currentEnv, context);
              },
            },
          });
          return await resourceServer.fetch(request, env, ctx);
        }
        const bounded = request.method === 'POST' ? await boundedBody(request) : request;
        return await authServer.fetch(bounded, env, ctx);
      } catch (error) {
        return failResponse(error);
      }
    },
  };
}
