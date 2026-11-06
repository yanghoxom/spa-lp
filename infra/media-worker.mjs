// Public media only. Uploads use the authenticated Cloudflare API, never this endpoint.
const CONTENT_TYPES = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif", gif: "image/gif",
};

// The MCP writer stores a bounded cache policy with each image. Preserve the
// previous one-day policy for legacy entries and reject unsafe header values.
function imageCacheControl(value) {
  if (typeof value !== "string" || value.length > 256 || /[\r\n]/.test(value)) return "public, max-age=86400";
  const directives = value.split(",").map(part => part.trim());
  const safe = directives.length > 0 && directives.every(part => {
    if (["public", "private", "immutable", "no-cache", "no-store", "no-transform", "must-revalidate", "proxy-revalidate"].includes(part)) return true;
    const match = /^(?:max-age|s-maxage|stale-while-revalidate|stale-if-error)=(\d+)$/.exec(part);
    return match !== null && Number(match[1]) <= 31536000;
  });
  return safe ? directives.join(", ") : "public, max-age=86400";
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    const extension = url.pathname.split(".").pop();
    if (!CONTENT_TYPES[extension]) return new Response("Not found", { status: 404 });
    const cacheKey = new Request(url.origin + url.pathname);
    let response = await caches.default.match(cacheKey);
    if (!response) {
      const { value, metadata } = await env.MEDIA.getWithMetadata(url.pathname, { type: "stream" });
      if (value === null) {
        return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
      }
      const headers = {
        "Content-Type": metadata?.contentType || CONTENT_TYPES[extension],
        "Cache-Control": imageCacheControl(metadata?.cacheControl),
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      };
      if (metadata?.etag) headers.ETag = metadata.etag;
      if (extension === "svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      response = new Response(value, { headers });
      if (!/(?:^|,)\s*(?:private|no-store|no-cache)(?:,|$)/.test(headers["Cache-Control"])) {
        ctx.waitUntil(caches.default.put(cacheKey, response.clone()).catch(() => undefined));
      }
    }
    const etag = response.headers.get("ETag");
    if (etag && request.headers.get("If-None-Match")?.split(/\s*,\s*/).includes(etag)) {
      return new Response(null, { status: 304, headers: response.headers });
    }
    return request.method === "HEAD" ? new Response(null, { headers: response.headers }) : response;
  },
};
