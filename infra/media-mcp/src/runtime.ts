import { DurableObject } from "cloudflare:workers";
import { createMcpHandler } from "agents/mcp/server";
import type { AuthProps } from "./auth";
import { createMediaServer } from "./mcp";
import { readBoundedBody } from "./download";
import { configuredMaxBytes } from "./media";

export const IDENTITY_HEADER = "X-Phungha-Media-Identity";

function internalIdentity(request: Request, allowedEmail: string): AuthProps | null {
  try {
    const header = request.headers.get(IDENTITY_HEADER);
    if (!header || header.length > 4096) return null;
    const value = JSON.parse(header);
    if (typeof value.subject !== "string" || !value.subject || value.subject.length > 256
      || value.email !== allowedEmail.toLowerCase() || !Array.isArray(value.scopes)
      || value.scopes.length > 4 || !value.scopes.includes("media:read")
      || value.scopes.some((s: unknown) => typeof s !== "string" || !["media:read", "media:write", "media:delete", "offline_access"].includes(s))) return null;
    return {subject: value.subject, email: value.email, scopes: value.scopes};
  } catch {return null;}
}

/**
 * Private per-owner runtime: the public Worker authenticates before forwarding
 * the raw body through this binding. This class has no public route. It uses the
 * supported Durable Object CPU budget on Workers Free, and admits one bounded
 * MCP exchange at a time so simultaneous large images do not multiply buffers.
 * No tokens, image bytes or protocol sessions are persisted here.
 */
export class McpRuntime extends DurableObject<Env> {
  private queue: Promise<unknown> = Promise.resolve();
  private pending = 0;

  async fetch(request: Request): Promise<Response> {
    const identity = internalIdentity(request, this.env.ALLOWED_EMAIL);
    if (!identity || new URL(request.url).origin !== this.env.SERVER_ORIGIN || new URL(request.url).pathname !== "/mcp") {
      return Response.json({error: "invalid_internal_request"}, {status: 403});
    }
    if (request.method !== "POST") return new Response(null, {status: 405, headers: {Allow: "POST"}});
    if (this.pending >= 8) return Response.json({error: "server_busy"}, {status: 503, headers: {"Retry-After": "2"}});
    this.pending++;
    const next = this.queue.then(() => this.handle(request, identity), () => this.handle(request, identity));
    this.queue = next.then(() => undefined, () => undefined);
    try {return await next;} finally {this.pending--;}
  }

  private async handle(request: Request, identity: AuthProps): Promise<Response> {
    if (request.signal.aborted) return new Response(null, {status: 499});
    const timeout = new AbortController();
    const deadline = setTimeout(() => timeout.abort(), 45_000);
    try {
      if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
        return Response.json({error: "unsupported_media_type"}, {status: 415});
      }
      const maxRequestBytes = Math.ceil(configuredMaxBytes(this.env.MAX_IMAGE_BYTES) / 3) * 4 + 65536;
      let parsedBody: unknown;
      try {
        const bytes = await readBoundedBody(new Response(request.body, {headers: request.headers}), maxRequestBytes, timeout.signal);
        const first = bytes.find(byte => ![9, 10, 13, 32].includes(byte));
        if (first !== 123) return Response.json({error: "one_json_rpc_object_required"}, {status: 400});
        // agents 0.33's legacy classifier otherwise applies a separate 4 MiB cap.
        try {parsedBody = JSON.parse(new TextDecoder().decode(bytes));}
        catch {return Response.json({error: "invalid_json"}, {status: 400});}
      } catch {return Response.json({error: "invalid_or_oversized_request"}, {status: timeout.signal.aborted ? 408 : 413});}

      const response = await createMcpHandler(() => createMediaServer(this.env, identity), {
        route: "/mcp", responseMode: "json", legacy: "stateless", corsOptions: false,
        maxRequestBodySize: maxRequestBytes, authContext: {props: {...identity}},
        allowedHostnames: [new URL(this.env.SERVER_ORIGIN).hostname],
        allowedOriginHostnames: [new URL(this.env.SERVER_ORIGIN).hostname, "chatgpt.com", "chat.openai.com", "platform.openai.com"],
        onerror: () => { /* Never log data, credentials, signed URLs or raw errors. */ },
      }).fetch(request, {parsedBody});
      // Legacy SDK replies use finite SSE streams. Finish each exchange before
      // admitting another large input; all five tool outputs are metadata only.
      if (!response.body) return response;
      const body = await readBoundedBody(response, 1_000_000, timeout.signal);
      return new Response(body, {status: response.status, headers: response.headers});
    } catch {
      return Response.json({error: "media_runtime_unavailable"}, {status: 503});
    } finally {clearTimeout(deadline);}
  }
}
