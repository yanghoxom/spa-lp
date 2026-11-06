/**
 * Exercise the built Worker in a real local workerd process. Run after npm run build:
 *   node scripts/runtime-smoke.mjs
 *
 * All KV / Durable Objects are ephemeral and local. Every Worker outbound fetch
 * is intercepted: only synthetic Access public keys and a local-KV CDN simulator
 * are served. OAuth credentials, generated images, and tokens remain in memory.
 */
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Miniflare, NoOpLog, convertV4MiniflareOptions, Response as MiniflareResponse } from "miniflare";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { pngFixture } from "../test/fixtures.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "https://phungha-media-mcp.tieugia969719.workers.dev";
const issuer = "https://qidianvp.cloudflareaccess.com";
const audience = "237815b1a08662e3681e9191e65d277d8c01dc6a1d50f0408bd6d84ec6607482";
const owner = "owner@example.com";
const resource = `${origin}/mcp`;
const callback = "https://client.example.com/callback";
const scopes = ["media:read", "media:write", "media:delete", "offline_access"];
const smallKey = "/assets/runtime-smoke/small-v1.png";
const fileKey = "/assets/runtime-smoke/file-v1.png";
const largeKey = "/assets/runtime-smoke/large-v1.png";
const MAX_BYTES = 10_000_000;

let stage = "runtime setup";
let passed = 0;
let failureCode;
let failureKind;
let runtimeErrors = 0;
let deniedOutbound = 0;
let mf;

function requireThat(condition) {
  if (!condition) throw new Error("smoke_assertion_failed");
}
async function check(name, action) {
  stage = name;
  await action();
  passed++;
}
function cookies(response) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get("Set-Cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}
function hiddenValue(html, name) {
  const value = new RegExp(`name="${name}" value="([A-Za-z0-9_-]+)"`).exec(html)?.[1];
  requireThat(typeof value === "string");
  return value;
}
async function json(response, status = 200) {
  if (response.status !== status) {
    failureCode = `HTTP_${response.status}`;
    const body = await response.text();
    if (/Invalid Host(?: header)?:/.test(body)) failureKind = "host_validation";
    else if (/origin/i.test(body)) failureKind = "origin_validation";
    else if (/insufficient_scope/.test(body)) failureKind = "insufficient_scope";
    else if (/invalid_token/.test(body)) failureKind = "invalid_token";
    else if (/legacy/i.test(body)) failureKind = "legacy_transport_rejection";
    else if (/too large|must not exceed/i.test(body)) failureKind = "request_body_limit";
    else if (/protocol|version/i.test(body)) failureKind = "protocol_version_rejection";
    else if (/Parse error/i.test(body)) failureKind = "json_parse_rejection";
    try {
      const rpcCode = JSON.parse(body).error?.code;
      if (Number.isInteger(rpcCode)) failureCode += `_RPC_${rpcCode}`;
    } catch { /* Only a static code is included in test output. */ }
    throw new Error("unexpected_http_status");
  }
  return response.json();
}
function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

try {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
  const jwk = { ...await exportJWK(publicKey), alg: "RS256", use: "sig", kid: "runtime-smoke-key" };
  const accessJwt = await new SignJWT({ email: owner, type: "app" })
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid }).setIssuer(issuer).setAudience(audience)
    .setSubject("local-runtime-owner").setIssuedAt().setExpirationTime("10m").sign(privateKey);
  const localProxySecret = randomBytes(32).toString("hex");

  mf = new Miniflare(convertV4MiniflareOptions({
    name: "phungha-media-mcp-runtime-smoke",
    modules: true,
    scriptPath: resolve(root, "dist/index.js"),
    compatibilityDate: "2026-11-06",
    compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
    kvNamespaces: ["MEDIA", "OAUTH_KV"],
    durableObjects: {
      MEDIA_COORDINATOR: { className: "MediaCoordinator", useSQLite: true },
      MCP_RUNTIME: { className: "McpRuntime", useSQLite: true },
    },
    bindings: {
      SERVER_ORIGIN: origin,
      CDN_BASE_URL: "https://cdn.phunghakorea.com",
      MAX_IMAGE_BYTES: String(MAX_BYTES),
      ACCESS_TEAM_DOMAIN: issuer,
      ACCESS_AUD: audience,
      ALLOWED_EMAIL: owner,
      DOWNLOAD_ALLOWED_HOSTS: "cdn.phunghakorea.com,files.oaiusercontent.com",
    },
    cf: false,
    telemetry: { enabled: false },
    unsafeRegisterWorker: false,
    unsafeProxySharedSecret: localProxySecret,
    log: new NoOpLog(),
    logRequests: false,
    handleStructuredLogs: (entry) => { if (entry.level === "error") runtimeErrors++; },
    handleUncaughtError: () => { runtimeErrors++; },
    outboundService: async (request, runtime) => {
      const url = new URL(request.url);
      if (url.href === `${issuer}/cdn-cgi/access/certs` && request.method === "GET") {
        return MiniflareResponse.json({ keys: [jwk] });
      }
      if (url.origin === "https://cdn.phunghakorea.com" && url.pathname.startsWith("/assets/") && ["GET", "HEAD"].includes(request.method)) {
        const localKv = await runtime.getKVNamespace("MEDIA");
        const item = await localKv.getWithMetadata(url.pathname, { type: "arrayBuffer" });
        if (item.value === null) return new MiniflareResponse(null, { status: 404 });
        const headers = {
          "Content-Type": item.metadata.contentType,
          "Content-Length": String(item.value.byteLength),
          ETag: item.metadata.etag,
          "Cache-Control": item.metadata.cacheControl,
        };
        return new MiniflareResponse(request.method === "HEAD" ? null : item.value, { headers });
      }
      deniedOutbound++;
      return new MiniflareResponse(null, { status: 502 });
    },
  }));
  await mf.ready;
  // Miniflare routes through a loopback transport and otherwise exposes that
  // loopback Host to the Worker. Its authenticated local-proxy mode reconstructs
  // Host from the original URL, as production HTTPS would. Production validation
  // is unchanged; the local proxy header is stripped before Worker dispatch.
  const dispatch = (path, init = {}) => mf.dispatchFetch(path.startsWith("https://") ? path : origin + path, {
    redirect: "manual", ...init, headers: { Host: new URL(origin).host, "MF-Proxy-Shared-Secret": localProxySecret, ...init.headers },
  });
  const browserHeaders = { "Cf-Access-Jwt-Assertion": accessJwt };

  await check("public health", async () => {
    requireThat((await json(await dispatch("/healthz"))).status === "ok");
  });
  await check("MCP authentication required", async () => {
    const response = await dispatch("/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    requireThat(response.status === 401 && !!response.headers.get("WWW-Authenticate"));
  });
  await check("forged internal identity cannot replace OAuth", async () => {
    const response = await dispatch("/mcp", { method: "POST", headers: {
      "Content-Type": "application/json", ...browserHeaders,
      "X-Phungha-Media-Identity": JSON.stringify({ subject: "local-runtime-owner", email: owner, scopes }),
    }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    requireThat(response.status === 401 && !!response.headers.get("WWW-Authenticate"));
  });
  await check("OAuth discovery", async () => {
    const authorization = await json(await dispatch("/.well-known/oauth-authorization-server"));
    const protectedResource = await json(await dispatch("/.well-known/oauth-protected-resource/mcp"));
    requireThat(authorization.authorization_endpoint === origin + "/authorize");
    requireThat(authorization.token_endpoint === origin + "/oauth/token");
    requireThat(protectedResource.resource === resource);
  });

  let client;
  await check("dynamic client registration", async () => {
    client = await json(await dispatch("/oauth/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        client_name: "Local runtime smoke", redirect_uris: [callback],
        grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none",
      }),
    }), 201);
    requireThat(typeof client.client_id === "string");
  });

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const oauthState = randomBytes(24).toString("base64url");
  const authorize = new URL(origin + "/authorize");
  authorize.search = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: callback,
    resource, scope: scopes.join(" "), state: oauthState, code_challenge: challenge, code_challenge_method: "S256" }).toString();

  await check("Access JWT enforced", async () => {
    requireThat((await dispatch(authorize.href, { headers: { "Cf-Access-Jwt-Assertion": "invalid" } })).status === 403);
  });

  let consentCookie;
  let handle;
  await check("signed Access identity and consent page", async () => {
    const response = await dispatch(authorize.href, { headers: browserHeaders });
    requireThat(response.status === 200);
    consentCookie = cookies(response);
    handle = hiddenValue(await response.text(), "handle");
    requireThat(!!consentCookie);
  });

  let code;
  await check("CSRF-bound consent and authorization code", async () => {
    const form = new URLSearchParams({ handle, decision: "approve" });
    scopes.forEach((scope) => form.append("scope", scope));
    const response = await dispatch("/authorize", { method: "POST", headers: {
      ...browserHeaders, Origin: origin, Cookie: consentCookie, "Content-Type": "application/x-www-form-urlencoded",
    }, body: form.toString() });
    requireThat(response.status === 302);
    const location = new URL(response.headers.get("Location"));
    requireThat(location.origin + location.pathname === callback && location.searchParams.get("state") === oauthState);
    code = location.searchParams.get("code");
    requireThat(!!code);
  });

  let token;
  await check("PKCE token exchange", async () => {
    token = await json(await dispatch("/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code,
        code_verifier: verifier, redirect_uri: callback, resource }).toString(),
    }));
    requireThat(typeof token.access_token === "string" && typeof token.refresh_token === "string");
  });
  await check("refresh grant", async () => {
    token = await json(await dispatch("/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: token.refresh_token, resource }).toString(),
    }));
    requireThat(typeof token.access_token === "string");
  });

  let rpcId = 1;
  let protocolVersion = "2025-06-18";
  async function rpc(method, params, options = {}) {
    const id = rpcId++;
    const response = await dispatch("/mcp", { method: "POST", headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...options.headers,
      Authorization: `Bearer ${options.bearer ?? token.access_token}`,
      "MCP-Protocol-Version": protocolVersion,
    }, body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }) });
    let body;
    if (response.status === 200 && response.headers.get("Content-Type")?.includes("text/event-stream")) {
      // The SDK's compatibility transport replies using SSE even when the
      // modern transport is configured for JSON. Exercise both legal forms.
      for (const frame of (await response.text()).split(/\r?\n\r?\n/)) {
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
        if (!data) continue;
        const message = JSON.parse(data);
        if (message.id === id) body = message;
      }
      if (!body) { failureKind = "missing_rpc_reply"; throw new Error("missing_rpc_reply"); }
    } else body = await json(response);
    if (body.error) { failureCode = `MCP_${Number(body.error.code)}`; throw new Error("mcp_error"); }
    requireThat(!!body.result);
    return body.result;
  }
  async function tool(name, args, allowError = false, options = {}) {
    const result = await rpc("tools/call", { name, arguments: args }, options);
    if (result.isError) {
      let code = "TOOL_ERROR";
      try {
        const candidate = JSON.parse(result.content.find((part) => part.type === "text")?.text ?? "{}").error?.code;
        if (typeof candidate === "string" && /^[A-Z_]{1,64}$/.test(candidate)) code = candidate;
      } catch { /* Never print a raw protocol payload. */ }
      if (allowError) return { error: code };
      failureCode = code;
      throw new Error("tool_failed");
    }
    requireThat(result.structuredContent && typeof result.structuredContent === "object");
    return result.structuredContent;
  }

  await check("MCP initialize", async () => {
    const result = await rpc("initialize", { protocolVersion, capabilities: {}, clientInfo: { name: "runtime-smoke", version: "1.0.0" } });
    requireThat(result.serverInfo.name === "phungha-media-mcp");
    protocolVersion = result.protocolVersion;
  });
  await check("six tools including native image download and write annotations", async () => {
    const { tools } = await rpc("tools/list");
    requireThat(tools.length === 6);
    requireThat(tools.find((tool) => tool.name === "upload_media")?.annotations.readOnlyHint === false);
    requireThat(tools.find((tool) => tool.name === "upload_media")?._meta?.["openai/fileParams"]?.[0] === "file");
    requireThat(tools.find((tool) => tool.name === "delete_media")?.annotations.destructiveHint === true);
    requireThat(["download_media", "verify_media", "get_media_metadata", "list_media"].every((name) => tools.find((tool) => tool.name === name)?.annotations.readOnlyHint === true));
    requireThat(JSON.stringify(tools.find((t) => t.name === "download_media")?._meta?.securitySchemes ?? []).includes("media:read"));
  });

  const small = pngFixture();
  const smallArgs = { key: smallKey, content_type: "image/png", base64: Buffer.from(small).toString("base64") };
  await check("JSON-RPC batch rejected before any write", async () => {
    const keys = ["/assets/runtime-smoke/batch-a.png", "/assets/runtime-smoke/batch-b.png"];
    const response = await dispatch("/mcp", { method: "POST", headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token.access_token}`,
      "MCP-Protocol-Version": protocolVersion,
    }, body: JSON.stringify(keys.map((key, index) => ({ jsonrpc: "2.0", id: index + 1, method: "tools/call",
      params: { name: "upload_media", arguments: { ...smallArgs, key } },
    }))) });
    requireThat(response.status === 400);
    const localKv = await mf.getKVNamespace("MEDIA");
    for (const key of keys) requireThat(await localKv.get(key, "arrayBuffer") === null);
  });
  let uploaded;
  await check("binary upload through real Durable Object and KV", async () => {
    uploaded = await tool("upload_media", smallArgs);
    requireThat(uploaded.sha256 === digest(small) && uploaded.byte_size === small.byteLength);
    const localKv = await mf.getKVNamespace("MEDIA");
    const stored = await localKv.getWithMetadata(smallKey, { type: "arrayBuffer" });
    requireThat(stored.value !== null && digest(new Uint8Array(stored.value)) === uploaded.sha256 && stored.metadata.sha256 === uploaded.sha256);
  });
  await check("download is native MCP image content with verified bytes", async () => {
    const result = await rpc("tools/call", {name: "download_media", arguments: {key: smallKey, expected_sha256: uploaded.sha256}});
    requireThat(result.isError !== true && result.structuredContent.sha256 === uploaded.sha256);
    const image = result.content?.find((part) => part.type === "image");
    requireThat(image?.mimeType === "image/png" && digest(Buffer.from(image.data, "base64")) === uploaded.sha256);
    requireThat(result.structuredContent.filename === "small-v1.png");
  });
  await check("download SHA-256 mismatch and absent object", async () => {
    requireThat((await tool("download_media", {key: smallKey, expected_sha256: "0".repeat(64)}, true)).error === "HASH_MISMATCH");
    requireThat((await tool("download_media", {key: "/assets/runtime-smoke/absent.png"}, true)).error === "MEDIA_NOT_FOUND");
    requireThat((await tool("download_media", {key: "/assets/../escape.png"}, true)).error === "INVALID_KEY");
  });

  await check("idempotent upload", async () => {
    requireThat(JSON.stringify(await tool("upload_media", smallArgs)) === JSON.stringify(uploaded));
  });
  await check("metadata-only tool", async () => {
    const result = await tool("get_media_metadata", { key: smallKey });
    requireThat(result.exists && result.sha256 === uploaded.sha256 && !Object.hasOwn(result, "base64"));
  });
  await check("bounded list tool", async () => {
    const result = await tool("list_media", { prefix: "/assets/runtime-smoke/", limit: 1 });
    requireThat(result.items.length === 1 && result.items[0].key === smallKey);
  });
  await check("public verification against local KV CDN simulator", async () => {
    const result = await tool("verify_media", { key: smallKey });
    requireThat(result.exists && result.publicly_available && result.integrity_ok && result.mismatches.length === 0);
  });
  await check("ChatGPT file reference upload", async () => {
    const result = await tool("upload_media", { key: fileKey, content_type: "image/png", file: {
      download_url: "https://cdn.phunghakorea.com" + smallKey, file_id: "runtime-file", mime_type: "image/png", file_name: "runtime.png",
    } });
    requireThat(result.sha256 === uploaded.sha256 && result.key === fileKey);
  });
  await check("no overwrite of immutable image", async () => {
    const result = await tool("upload_media", { ...smallArgs, base64: Buffer.from(pngFixture(200)).toString("base64") }, true);
    requireThat(result.error === "KEY_CONFLICT");
  });
  await check("MIME bytes mismatch rejected", async () => {
    const result = await tool("upload_media", { ...smallArgs, key: "/assets/runtime-smoke/wrong.webp", content_type: "image/webp" }, true);
    requireThat(result.error === "MIME_MISMATCH");
  });

  let readOnlyToken;
  await check("independent read-only OAuth grant", async () => {
    const readClient = await json(await dispatch("/oauth/register", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: "Read-only runtime smoke", redirect_uris: [callback],
        grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none" }),
    }), 201);
    const readVerifier = randomBytes(32).toString("base64url");
    const readAuthorization = new URL(origin + "/authorize");
    readAuthorization.search = new URLSearchParams({ response_type: "code", client_id: readClient.client_id, redirect_uri: callback,
      resource, scope: "media:read", state: randomBytes(24).toString("base64url"),
      code_challenge: createHash("sha256").update(readVerifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    const consent = await dispatch(readAuthorization.href, { headers: browserHeaders });
    requireThat(consent.status === 200);
    const readCookie = cookies(consent);
    const readHandle = hiddenValue(await consent.text(), "handle");
    const allowed = await dispatch("/authorize", { method: "POST", headers: {
      ...browserHeaders, Origin: origin, Cookie: readCookie, "Content-Type": "application/x-www-form-urlencoded",
    }, body: new URLSearchParams({ handle: readHandle, decision: "approve", scope: "media:read" }).toString() });
    requireThat(allowed.status === 302);
    const readCode = new URL(allowed.headers.get("Location")).searchParams.get("code");
    const grant = await json(await dispatch("/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: readClient.client_id, code: readCode,
        code_verifier: readVerifier, redirect_uri: callback, resource }).toString(),
    }));
    requireThat(typeof grant.access_token === "string");
    readOnlyToken = grant.access_token;
    requireThat((await tool("get_media_metadata", { key: smallKey }, false, { bearer: readOnlyToken })).exists);
  });
  await check("forged write scopes cannot elevate a read-only OAuth token", async () => {
    const blockedKey = "/assets/runtime-smoke/scope-bypass.png";
    const result = await tool("upload_media", { ...smallArgs, key: blockedKey }, true, {
      bearer: readOnlyToken,
      headers: { "X-Phungha-Media-Identity": JSON.stringify({ subject: "local-runtime-owner", email: owner, scopes }) },
    });
    requireThat(result.error === "INSUFFICIENT_SCOPE");
    const localKv = await mf.getKVNamespace("MEDIA");
    requireThat(await localKv.get(blockedKey, "arrayBuffer") === null);
  });

  let proposal;
  await check("delete requires browser approval", async () => {
    proposal = await tool("delete_media", { key: smallKey });
    requireThat(proposal.status === "confirmation_required" && !proposal.deleted && typeof proposal.approval_url === "string");
    const retry = await tool("delete_media", { key: smallKey, confirmation_token: proposal.confirmation_token });
    requireThat(retry.status === "confirmation_required" && !retry.deleted);
  });
  let csrf;
  let deleteCookie;
  await check("delete approval page validates Access identity", async () => {
    const response = await dispatch(proposal.approval_url, { headers: browserHeaders });
    requireThat(response.status === 200);
    deleteCookie = cookies(response);
    csrf = hiddenValue(await response.text(), "csrf");
  });
  await check("delete approval requires matching browser cookie", async () => {
    const response = await dispatch(proposal.approval_url, { method: "POST", headers: {
      ...browserHeaders, Origin: origin, "Content-Type": "application/x-www-form-urlencoded",
    }, body: new URLSearchParams({ csrf, decision: "approve" }).toString() });
    requireThat(response.status === 400);
  });
  await check("browser grants specific delete approval", async () => {
    const response = await dispatch(proposal.approval_url, { method: "POST", headers: {
      ...browserHeaders, Origin: origin, Cookie: deleteCookie, "Content-Type": "application/x-www-form-urlencoded",
    }, body: new URLSearchParams({ csrf, decision: "approve" }).toString() });
    requireThat(response.status === 200);
    const localKv = await mf.getKVNamespace("MEDIA");
    requireThat(await localKv.get(smallKey, "arrayBuffer") !== null);
  });
  await check("approved delete and retired key", async () => {
    const result = await tool("delete_media", { key: smallKey, confirmation_token: proposal.confirmation_token });
    requireThat(result.deleted && result.status === "deleted" && result.cdn_cache_may_remain);
    requireThat((await tool("get_media_metadata", { key: smallKey })).exists === false);
    requireThat((await tool("upload_media", smallArgs, true)).error === "KEY_RETIRED");
  });

  await check("10 MB image through HTTP, MCP, Durable Object RPC and KV", async () => {
    const overhead = pngFixture(0, "").byteLength;
    const large = pngFixture(0, "x".repeat(MAX_BYTES - overhead));
    requireThat(large.byteLength === MAX_BYTES);
    const result = await tool("upload_media", { key: largeKey, content_type: "image/png", base64: Buffer.from(large).toString("base64") });
    requireThat(result.byte_size === MAX_BYTES && result.sha256 === digest(large));
    const localKv = await mf.getKVNamespace("MEDIA");
    const stored = await localKv.getWithMetadata(largeKey, { type: "arrayBuffer" });
    requireThat(stored.value?.byteLength === MAX_BYTES && digest(new Uint8Array(stored.value)) === result.sha256);
  });
  await check("download exact 10 MB as MCP image through the response boundary", async () => {
    const result = await rpc("tools/call", {name: "download_media", arguments: {key: largeKey}});
    requireThat(result.isError !== true && result.structuredContent.byte_size === MAX_BYTES);
    const image = result.content?.find((part) => part.type === "image");
    requireThat(image?.mimeType === "image/png" && Buffer.from(image.data, "base64").length === MAX_BYTES);
    requireThat(digest(Buffer.from(image.data, "base64")) === result.structuredContent.sha256);
  });
  await check("10 MB plus one byte is rejected", async () => {
    const overhead = pngFixture(0, "").byteLength;
    const oversized = pngFixture(0, "x".repeat(MAX_BYTES + 1 - overhead));
    requireThat(oversized.byteLength === MAX_BYTES + 1);
    const result = await tool("upload_media", { key: "/assets/runtime-smoke/oversized-v1.png", content_type: "image/png", base64: Buffer.from(oversized).toString("base64") }, true);
    requireThat(result.error === "IMAGE_TOO_LARGE");
  });
  await check("no unexpected outbound requests or runtime errors", async () => {
    requireThat(deniedOutbound === 0 && runtimeErrors === 0);
  });

  console.log(JSON.stringify({ status: "passed", checks: passed }));
} catch {
  // Never stringify assertions, protocol bodies, errors or request headers:
  // any of those could contain in-memory OAuth credentials or base64 images.
  console.log(JSON.stringify({ status: "failed", checks: passed, stage, ...(failureCode ? { code: failureCode } : {}), ...(failureKind ? { kind: failureKind } : {}), runtime_errors: runtimeErrors, denied_outbound: deniedOutbound }));
  process.exitCode = 1;
} finally {
  if (mf) await mf.dispose();
}
