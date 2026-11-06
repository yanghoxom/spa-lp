import { afterEach, expect, test, vi } from "vitest";
import worker from "../infra/media-worker.mjs";

afterEach(() => vi.unstubAllGlobals());

function fixture(result) {
  const entries = new Map();
  vi.stubGlobal("caches", { default: {
    match: async request => entries.get(request.url)?.clone(),
    put: async (request, response) => { entries.set(request.url, response); },
  } });
  const pending = [];
  const env = { MEDIA: { getWithMetadata: vi.fn().mockResolvedValue(result) } };
  return { env, ctx: { waitUntil: promise => pending.push(promise) }, pending };
}

test("CDN is read-only and never fetches an origin when media is missing", async () => {
  const f = fixture({ value: null, metadata: null });
  const origin = vi.fn();
  vi.stubGlobal("fetch", origin);
  expect((await worker.fetch(new Request("https://cdn.phunghakorea.com/a.webp", { method: "POST" }), f.env, f.ctx)).status).toBe(405);
  expect(f.env.MEDIA.getWithMetadata).not.toHaveBeenCalled();
  const missing = await worker.fetch(new Request("https://cdn.phunghakorea.com/a.webp"), f.env, f.ctx);
  expect(missing.status).toBe(404);
  expect(missing.headers.get("Cache-Control")).toBe("no-store");
  expect(origin).not.toHaveBeenCalled();
});

test("CDN caches media independently of query strings and supports conditional GET and HEAD", async () => {
  const bytes = new Uint8Array([82, 73, 70, 70]);
  const f = fixture({ value: bytes, metadata: { contentType: "image/webp", etag: '"v2"' } });
  const first = await worker.fetch(new Request("https://cdn.phunghakorea.com/a.webp?v=1"), f.env, f.ctx);
  expect(first.headers.get("Content-Type")).toBe("image/webp");
  expect(first.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes);
  await Promise.all(f.pending);
  const unchanged = await worker.fetch(new Request("https://cdn.phunghakorea.com/a.webp?v=2", { headers: { "If-None-Match": '"v1", "v2"' } }), f.env, f.ctx);
  expect(unchanged.status).toBe(304);
  expect(await unchanged.text()).toBe("");
  const head = await worker.fetch(new Request("https://cdn.phunghakorea.com/a.webp", { method: "HEAD" }), f.env, f.ctx);
  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");
  expect(head.headers.get("ETag")).toBe('"v2"');
  expect(f.env.MEDIA.getWithMetadata).toHaveBeenCalledTimes(1);
});
