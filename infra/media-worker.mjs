// Public media only. Uploads use the authenticated Cloudflare API, never this endpoint.
const CONTENT_TYPES = {
  webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif", gif: "image/gif",
};

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
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Content-Type-Options": "nosniff",
      };
      if (metadata?.etag) headers.ETag = metadata.etag;
      if (extension === "svg") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
      response = new Response(value, { headers });
      ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    }
    const etag = response.headers.get("ETag");
    if (etag && request.headers.get("If-None-Match")?.split(/\s*,\s*/).includes(etag)) {
      return new Response(null, { status: 304, headers: response.headers });
    }
    return request.method === "HEAD" ? new Response(null, { headers: response.headers }) : response;
  },
};
