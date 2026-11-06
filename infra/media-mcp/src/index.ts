import { createOAuthHandler, isAuthConfigured } from "./auth";
import { authorizeDelete } from "./delete-approval";
import { configuredMaxBytes } from "./media";
import { IDENTITY_HEADER } from "./runtime";
export { MediaCoordinator } from "./coordinator";
export { McpRuntime } from "./runtime";

const oauth = createOAuthHandler<Env>({
  async fetch(request, env, ctx) {
    if (!ctx.auth.clientId) return Response.json({error: "invalid_client_identity"}, {status: 401});
    const headers = new Headers(request.headers);
    // Overwrite every caller-supplied identity value after OAuth verification.
    // This header is trusted only inside the private Durable Object binding.
    headers.set(IDENTITY_HEADER, JSON.stringify({subject: ctx.props.subject, email: ctx.props.email, scopes: [...ctx.auth.scope]}));
    headers.delete("Authorization");
    headers.delete("Cf-Access-Jwt-Assertion");
    headers.delete("Cookie");
    return env.MCP_RUNTIME.getByName(ctx.props.subject).fetch(new Request(request, {headers}));
  },
}, {authorizeDelete});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.origin !== env.SERVER_ORIGIN) return new Response(null, {status: 404});
      if (url.pathname === "/healthz" && (request.method === "GET" || request.method === "HEAD")) {
        configuredMaxBytes(env.MAX_IMAGE_BYTES);
        const ready = isAuthConfigured(env) && !!env.MEDIA && !!env.MEDIA_COORDINATOR && !!env.MCP_RUNTIME && env.CDN_BASE_URL === "https://cdn.phunghakorea.com";
        return new Response(request.method === "HEAD" ? null : JSON.stringify({status: ready ? "ok" : "not_ready", service: "phungha-media-mcp", version: "1.0.0"}), {
          status: ready ? 200 : 503, headers: {"Content-Type": "application/json", "Cache-Control": "no-store"},
        });
      }
      if (url.pathname === "/") return Response.json({service: "Phùng Hà Korea Media MCP", endpoint: "/mcp", authentication: "OAuth 2.1", health: "/healthz"});
      return await oauth.fetch(request, env, ctx);
    } catch {
      return Response.json({error: "service_unavailable"}, {status: 503, headers: {"Cache-Control": "no-store"}});
    }
  },
} satisfies ExportedHandler<Env>;
