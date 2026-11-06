import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CDN_BASE, MediaMutations, configuredMaxBytes, downloadMedia, getMediaMetadata, listMedia, sha256, verifyMedia,
} from "../src/media";
import type { CoordinatorState, MediaMetadata, MediaRepository, StateRepository } from "../src/types";
import { pngFixture } from "./fixtures";

const KEY = "/assets/tests/image-v1.png";
const ACTOR = "owner@example.com";
const ORIGIN = "https://media-mcp.example.com";
const START = Date.UTC(2026, 10, 7, 1, 0, 0);

class MemoryMedia implements MediaRepository {
  objects = new Map<string, { value: Uint8Array; metadata: unknown }>();
  metadata = vi.fn<MediaRepository["metadata"]>(async (key) => {
    const item = this.objects.get(key);
    return { exists: !!item, metadata: item ? structuredClone(item.metadata) : null };
  });
  read = vi.fn<MediaRepository["read"]>(async (key) => {
    const item = this.objects.get(key);
    return item ? { value: item.value.slice(), metadata: structuredClone(item.metadata) } : { value: null, metadata: null };
  });
  put = vi.fn<MediaRepository["put"]>(async (key, bytes, metadata) => {
    this.objects.set(key, { value: bytes.slice(), metadata: structuredClone(metadata) });
  });
  delete = vi.fn<MediaRepository["delete"]>(async (key) => { this.objects.delete(key); });
  list = vi.fn<MediaRepository["list"]>(async (prefix, limit, cursor) => {
    const keys = [...this.objects.keys()].filter((key) => key.startsWith(prefix)).sort();
    const offset = cursor ? Number(cursor) : 0;
    const page = keys.slice(offset, offset + limit).map((name) => ({ name, metadata: structuredClone(this.objects.get(name)!.metadata) }));
    const complete = offset + limit >= keys.length;
    return { keys: page, complete, ...(complete ? {} : { cursor: String(offset + limit) }) };
  });
}

class MemoryState implements StateRepository {
  value?: CoordinatorState;
  get = vi.fn<StateRepository["get"]>(async () => structuredClone(this.value));
  set = vi.fn<StateRepository["set"]>(async (value) => { this.value = structuredClone(value); });
}

function harness(maxBytes?: number) {
  const repository = new MemoryMedia();
  const state = new MemoryState();
  let time = START;
  const now = () => new Date(time);
  const mutations = new MediaMutations(repository, state, ORIGIN, maxBytes, now);
  return { repository, state, mutations, now, advance: (ms: number) => { time += ms; } };
}

async function metadataFor(bytes: Uint8Array, overrides: Partial<MediaMetadata> = {}): Promise<MediaMetadata> {
  const hash = createHash("sha256").update(bytes).digest("hex");
  return { contentType: "image/png", etag: `"${hash}"`, sha256: hash, byteSize: bytes.byteLength,
    uploadedAt: new Date(START).toISOString(), cacheControl: "public, max-age=86400", ...overrides };
}

function cdnFetch(bytes: Uint8Array, metadata: MediaMetadata, overrides: Record<string, string> = {}) {
  const headers = { "Content-Type": metadata.contentType, "Content-Length": String(bytes.byteLength), ETag: metadata.etag, ...overrides };
  return vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
    return new Response(options?.method === "HEAD" ? null : bytes.slice(), { status: 200, headers });
  });
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("media upload and durable idempotence", () => {
  it("computes standard SHA-256 rather than trusting the caller's metadata", async () => {
    expect(await sha256(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("stores binary bytes and complete metadata in one KV write", async () => {
    const { repository, state, mutations } = harness();
    const bytes = pngFixture();
    const result = await mutations.upload(KEY, bytes, { content_type: "image/png" });
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(result).toEqual({ key: KEY, cdn_url: CDN_BASE + KEY, content_type: "image/png", byte_size: bytes.byteLength,
      sha256: hash, etag: `"${hash}"`, uploaded_at: new Date(START).toISOString() });
    expect(repository.put).toHaveBeenCalledExactlyOnceWith(KEY, bytes, expect.objectContaining({
      contentType: "image/png", byteSize: bytes.byteLength, sha256: hash, etag: `"${hash}"`,
      uploadedAt: result.uploaded_at, cacheControl: "public, max-age=31536000, immutable",
    }));
    expect(repository.objects.get(KEY)?.value).toEqual(bytes);
    expect(state.value?.object?.status).toBe("live");
  });

  it("serializes concurrent identical uploads and preserves the original result", async () => {
    const { repository, mutations } = harness();
    const bytes = pngFixture();
    const results = await Promise.all(Array.from({ length: 8 }, () => mutations.upload(KEY, bytes, { content_type: "image/png" })));
    expect(results.every((value) => JSON.stringify(value) === JSON.stringify(results[0]))).toBe(true);
    expect(repository.put).toHaveBeenCalledTimes(1);
    expect(repository.read).toHaveBeenCalledTimes(1);
  });

  it("treats unchanged key and SHA as a no-op even if requested metadata changes", async () => {
    const { repository, state, mutations, advance, now } = harness();
    const bytes = pngFixture();
    const original = await mutations.upload(KEY, bytes, { content_type: "image/png", etag: "first", cache_control: "public, max-age=3600" });
    advance(60_000);
    const restarted = new MediaMutations(repository, state, ORIGIN, undefined, now);
    const repeat = await restarted.upload(KEY, bytes, { content_type: "image/png", etag: "second", cache_control: "no-store" });
    expect(repeat).toEqual(original);
    expect(repository.put).toHaveBeenCalledTimes(1);
    expect(repository.objects.get(KEY)?.metadata).toMatchObject({ etag: '"first"', cacheControl: "public, max-age=3600" });
  });

  it("persists an intent before KV I/O and resumes it after a failed write", async () => {
    const { repository, state, mutations, advance, now } = harness();
    repository.put.mockImplementationOnce(async () => {
      expect(state.value?.object?.status).toBe("pending");
      throw new Error("simulated temporary storage failure");
    });
    const bytes = pngFixture();
    await expect(mutations.upload(KEY, bytes, { content_type: "image/png", etag: "first" })).rejects.toThrow("temporary storage");
    const intent = structuredClone(state.value!.object!);
    advance(60_000);
    const restarted = new MediaMutations(repository, state, ORIGIN, undefined, now);
    const result = await restarted.upload(KEY, bytes, { content_type: "image/png", etag: "second" });
    expect(result.etag).toBe(intent.metadata.etag);
    expect(result.uploaded_at).toBe(intent.metadata.uploadedAt);
    expect(repository.put).toHaveBeenCalledTimes(2);
    expect(state.value?.object?.status).toBe("live");
  });

  it("does not let another hash replace a pending intent", async () => {
    const { repository, state, mutations, now } = harness();
    repository.put.mockRejectedValueOnce(new Error("temporary failure"));
    await expect(mutations.upload(KEY, pngFixture(), { content_type: "image/png" })).rejects.toThrow();
    const restarted = new MediaMutations(repository, state, ORIGIN, undefined, now);
    await expect(restarted.upload(KEY, pngFixture(200), { content_type: "image/png" })).rejects.toMatchObject({ code: "KEY_CONFLICT" });
    expect(repository.put).toHaveBeenCalledTimes(1);
    expect(state.value?.object?.status).toBe("pending");
  });

  it("backfills identical legacy metadata once while preserving the bytes and original ETag", async () => {
    const { repository, state, mutations } = harness();
    const bytes = pngFixture();
    repository.objects.set(KEY, { value: bytes, metadata: { etag: '"legacy"' } });
    const result = await mutations.upload(KEY, bytes, { content_type: "image/png", etag: "new" });
    expect(result.sha256).toBe(await sha256(bytes));
    expect(result.etag).toBe('"legacy"');
    expect(repository.put).toHaveBeenCalledExactlyOnceWith(KEY, bytes, expect.objectContaining({
      contentType: "image/png", sha256: result.sha256, byteSize: bytes.byteLength, etag: '"legacy"', cacheControl: "public, max-age=86400",
    }));
    expect(await mutations.upload(KEY, bytes, { content_type: "image/png", etag: "ignored-on-retry" })).toEqual(result);
    expect(repository.put).toHaveBeenCalledTimes(1);
    expect(state.value?.object?.status).toBe("live");
  });

  it("adopts an existing entry with complete matching metadata without any KV write", async () => {
    const { repository, mutations } = harness();
    const bytes = pngFixture();
    repository.objects.set(KEY, { value: bytes, metadata: await metadataFor(bytes) });
    const result = await mutations.upload(KEY, bytes, { content_type: "image/png" });
    expect(result.byte_size).toBe(bytes.byteLength);
    expect(repository.put).not.toHaveBeenCalled();
  });

  it.each([true, false])("refuses different bytes under an existing key (coordinated: %s)", async (coordinated) => {
    const { repository, mutations } = harness();
    const bytes = pngFixture();
    if (coordinated) await mutations.upload(KEY, bytes, { content_type: "image/png" });
    else repository.objects.set(KEY, { value: bytes, metadata: await metadataFor(bytes) });
    const writes = repository.put.mock.calls.length;
    await expect(mutations.upload(KEY, pngFixture(200), { content_type: "image/png" })).rejects.toMatchObject({ code: "KEY_CONFLICT" });
    expect(repository.put).toHaveBeenCalledTimes(writes);
    expect(repository.objects.get(KEY)?.value).toEqual(bytes);
  });

  it("validates MIME and size before creating durable state or KV writes", async () => {
    const bytes = pngFixture();
    const { repository, state, mutations } = harness(bytes.byteLength - 1);
    await expect(mutations.upload(KEY, bytes, { content_type: "image/png" })).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
    const second = harness();
    await expect(second.mutations.upload(KEY, bytes, { content_type: "image/webp" })).rejects.toMatchObject({ code: "MIME_MISMATCH" });
    expect(repository.put).not.toHaveBeenCalled();
    expect(state.set).not.toHaveBeenCalled();
    expect(second.repository.put).not.toHaveBeenCalled();
    expect(second.state.set).not.toHaveBeenCalled();
  });

  it("keeps one coordinator bound to its canonical object key", async () => {
    const { repository, mutations } = harness();
    await mutations.upload(KEY, pngFixture(), { content_type: "image/png" });
    await expect(mutations.upload("/assets/tests/other-v1.png", pngFixture(), { content_type: "image/png" })).rejects.toMatchObject({ code: "KEY_MISMATCH" });
    expect(repository.put).toHaveBeenCalledTimes(1);
  });

  it("does not allow configured limits to exceed the default 10 MB maximum", () => {
    expect(configuredMaxBytes()).toBe(10_000_000);
    expect(configuredMaxBytes("1000")).toBe(1000);
    for (const value of ["0", "-1", "1.5", "10000001", "NaN", "Infinity"]) expect(() => configuredMaxBytes(value)).toThrow();
  });
});

describe("metadata-only reads and pagination", () => {
  it("gets exact-key metadata without reading any binary value", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata: { ...metadata, secret: "never-return-this", binary: "never-return-this" } });
    const result = await getMediaMetadata(repository, KEY);
    expect(result).toMatchObject({ exists: true, key: KEY, byte_size: bytes.byteLength, sha256: metadata.sha256 });
    expect(repository.metadata).toHaveBeenCalledExactlyOnceWith(KEY);
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.read).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("never-return-this");
  });

  it("does not mistake a longer prefix match for the requested object", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    repository.objects.set(`${KEY}.extra`, { value: bytes, metadata: await metadataFor(bytes) });
    expect(await getMediaMetadata(repository, KEY)).toMatchObject({ exists: false, sha256: null, byte_size: null });
    expect(repository.read).not.toHaveBeenCalled();
  });

  it("paginates only the requested safe prefix and never reads binary values", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    for (const name of ["/assets/tests/a.png", "/assets/tests/b.png", "/assets/other/c.png"]) repository.objects.set(name, { value: bytes, metadata });
    const first = await listMedia(repository, { prefix: "/assets/tests/", limit: 1 });
    expect(first.items.map((item) => item.key)).toEqual(["/assets/tests/a.png"]);
    expect(first.list_complete).toBe(false);
    expect(first.cursor).toBeTypeOf("string");
    const second = await listMedia(repository, { prefix: "/assets/tests/", limit: 1, cursor: first.cursor! });
    expect(second.items.map((item) => item.key)).toEqual(["/assets/tests/b.png"]);
    expect(second.list_complete).toBe(true);
    expect(second.cursor).toBeNull();
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.put).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("filters malformed upstream keys and keeps the cursor for an incomplete page", async () => {
    const repository = new MemoryMedia();
    repository.list.mockResolvedValueOnce({ keys: [{ name: "/outside/secret" }, { name: "/assets/../secret" }], complete: false, cursor: "next-page" });
    expect(await listMedia(repository, {})).toEqual({ items: [], prefix: "/assets/", limit: 25, list_complete: false, cursor: "next-page" });
  });

  it("rejects invalid pagination bounds and paths before KV access", async () => {
    const repository = new MemoryMedia();
    for (const limit of [0, 101, 1.5]) await expect(listMedia(repository, { limit })).rejects.toMatchObject({ code: "INVALID_LIMIT" });
    await expect(listMedia(repository, { prefix: "/" })).rejects.toMatchObject({ code: "INVALID_PREFIX" });
    await expect(listMedia(repository, { cursor: "bad\nvalue" })).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe("verify_media checks bytes in KV and public CDN", () => {
  it("verifies MIME, size, SHA and ETag and remains idempotent/read-only", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata });
    const fetcher = cdnFetch(bytes, metadata);
    const first = await verifyMedia(repository, { key: KEY }, fetcher);
    const second = await verifyMedia(repository, { cdn_url: CDN_BASE + KEY }, fetcher);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ exists: true, publicly_available: true, integrity_ok: true,
      content_type: "image/png", byte_size: bytes.byteLength, sha256: metadata.sha256, etag: metadata.etag,
      mismatches: [], cdn: { head_status: 200, get_status: 200, sha256: metadata.sha256 } });
    expect(fetcher.mock.calls.map(([, options]) => options?.method)).toEqual(["HEAD", "GET", "HEAD", "GET"]);
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).toBe(CDN_BASE + KEY);
      expect(options?.redirect).toBe("manual");
    }
    expect(repository.put).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("uses actual KV bytes when stored size or SHA metadata is incorrect", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata: { ...metadata, sha256: "a".repeat(64), byteSize: bytes.byteLength + 5 } });
    const result = await verifyMedia(repository, { key: KEY }, cdnFetch(bytes, metadata));
    expect(result).toMatchObject({ exists: true, publicly_available: true, integrity_ok: false, sha256: metadata.sha256, byte_size: bytes.byteLength });
    expect(result.mismatches).toEqual(expect.arrayContaining(["kv_sha256", "kv_byte_size"]));
  });

  it("detects MIME and hash from legacy bytes when stored metadata is incomplete", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata: { etag: metadata.etag } });
    const result = await verifyMedia(repository, { key: KEY }, cdnFetch(bytes, metadata));
    expect(result).toMatchObject({ exists: true, publicly_available: true, integrity_ok: true,
      content_type: "image/png", sha256: metadata.sha256, byte_size: bytes.byteLength, mismatches: [] });
    expect(repository.put).not.toHaveBeenCalled();
  });

  it("separates a public but stale CDN image from matching integrity", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    const cached = pngFixture(120, "previous revision cached at edge");
    repository.objects.set(KEY, { value: bytes, metadata });
    const result = await verifyMedia(repository, { key: KEY }, cdnFetch(cached, metadata, { ETag: '"old"' }));
    expect(result).toMatchObject({ exists: true, publicly_available: true, integrity_ok: false });
    expect(result.mismatches).toEqual(expect.arrayContaining(["sha256", "byte_size", "etag"]));
  });

  it("rejects a public MIME header that disagrees with the real bytes", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata });
    const result = await verifyMedia(repository, { key: KEY }, cdnFetch(bytes, metadata, { "Content-Type": "image/jpeg" }));
    expect(result).toMatchObject({ publicly_available: false, integrity_ok: false });
    expect(result.mismatches).toContain("cdn_mime");
  });

  it("reports a missing CDN image while retaining successful KV existence", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    repository.objects.set(KEY, { value: bytes, metadata: await metadataFor(bytes) });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, { status: 404 }));
    const result = await verifyMedia(repository, { key: KEY }, fetcher);
    expect(result).toMatchObject({ exists: true, publicly_available: false, integrity_ok: false, cdn: { get_status: 404 } });
    expect(result.mismatches).toContain("cdn_http_status");
  });

  it("reports a cached public object after its KV object has disappeared", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const result = await verifyMedia(repository, { key: KEY }, cdnFetch(bytes, await metadataFor(bytes)));
    expect(result).toMatchObject({ exists: false, publicly_available: true, integrity_ok: false, sha256: null, byte_size: null });
    expect(result.mismatches).toContain("kv_missing");
  });

  it("falls back to GET when HEAD is unsupported", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata });
    const fetcher = cdnFetch(bytes, metadata).mockResolvedValueOnce(new Response(null, { status: 405 }));
    expect(await verifyMedia(repository, { key: KEY }, fetcher)).toMatchObject({ publicly_available: true, integrity_ok: true, cdn: { head_status: 405, get_status: 200 } });
  });

  it("still performs GET when HEAD fails at the transport layer", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata });
    const fetcher = cdnFetch(bytes, metadata).mockRejectedValueOnce(new Error("HEAD not supported by upstream transport"));
    expect(await verifyMedia(repository, { key: KEY }, fetcher)).toMatchObject({ publicly_available: true, integrity_ok: true, cdn: { head_status: null, get_status: 200 } });
  });

  it("compares GET and HEAD headers independently of delivered bytes", async () => {
    const repository = new MemoryMedia();
    const bytes = pngFixture();
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, { value: bytes, metadata });
    const fetcher = cdnFetch(bytes, metadata, { "Content-Length": String(bytes.byteLength + 1) }).mockResolvedValueOnce(new Response(null, {
      headers: { "Content-Length": "1", "Content-Type": "image/jpeg", ETag: '"head-is-old"' },
    }));
    const result = await verifyMedia(repository, { key: KEY }, fetcher);
    expect(result.integrity_ok).toBe(false);
    expect(result.mismatches).toEqual(expect.arrayContaining(["cdn_content_length", "head_byte_size", "head_content_type", "head_etag"]));
  });

  it("does not follow public CDN redirects or expose response bodies", async () => {
    const repository = new MemoryMedia();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(null, {
      status: 302, headers: { Location: "http://169.254.169.254/?token=secret-value" },
    }));
    const result = await verifyMedia(repository, { key: KEY }, fetcher);
    expect(result.publicly_available).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("returns safe verification status after a CDN authentication/network error", async () => {
    const repository = new MemoryMedia();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null)).mockRejectedValueOnce(new Error("Authorization: Bearer secret-value"));
    const result = await verifyMedia(repository, { key: KEY }, fetcher);
    expect(result).toMatchObject({ publicly_available: false, integrity_ok: false });
    expect(result.mismatches).toContain("cdn_unavailable");
    expect(JSON.stringify(result)).not.toContain("secret-value");
    expect(repository.put).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("terminates verification when fetch does not respect AbortSignal", async () => {
    vi.useFakeTimers();
    const repository = new MemoryMedia();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined));
    let outcome: Awaited<ReturnType<typeof verifyMedia>> | undefined;
    void verifyMedia(repository, { key: KEY }, fetcher).then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(20_001);
    expect(outcome).toMatchObject({ publicly_available: false, integrity_ok: false });
    expect(outcome?.mismatches).toContain("cdn_unavailable");
  });

  it("cancels stalled GET bodies within the verification deadline", async () => {
    vi.useFakeTimers();
    const repository = new MemoryMedia();
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull: () => new Promise(() => undefined), cancel }, { highWaterMark: 0 });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null)).mockResolvedValueOnce(new Response(body, { headers: { "Content-Type": "image/png" } }));
    let outcome: Awaited<ReturnType<typeof verifyMedia>> | undefined;
    void verifyMedia(repository, { key: KEY }, fetcher).then((value) => { outcome = value; });
    await vi.advanceTimersByTimeAsync(20_001);
    expect(outcome).toMatchObject({ publicly_available: false, integrity_ok: false });
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("delete_media requires separate human browser approval", () => {
  it("keeps delete as a proposal until an authenticated browser approves and the tool retries", async () => {
    const { repository, mutations } = harness();
    await mutations.upload(KEY, pngFixture(), { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    expect(proposal).toMatchObject({ status: "confirmation_required", deleted: false, cdn_cache_may_remain: false });
    expect(proposal.approval_url).toContain(`${ORIGIN}/authorize/delete?`);
    expect(proposal.confirmation_token).toBeTypeOf("string");
    expect(repository.delete).not.toHaveBeenCalled();
    expect(await mutations.delete(KEY, ACTOR, proposal.confirmation_token!)).toMatchObject({ status: "confirmation_required", deleted: false });
    const page = await mutations.approval(KEY, proposal.confirmation_token!, ACTOR);
    expect(page.approved).toBe(false);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(await mutations.approval(KEY, proposal.confirmation_token!, ACTOR, page.csrf)).toMatchObject({ approved: true });
    expect(repository.delete).not.toHaveBeenCalled();
    const result = await mutations.delete(KEY, ACTOR, proposal.confirmation_token!);
    expect(result).toMatchObject({ status: "deleted", deleted: true, confirmation_token: null, approval_url: null, cdn_cache_may_remain: true });
    expect(repository.delete).toHaveBeenCalledExactlyOnceWith(KEY);
    expect(repository.objects.has(KEY)).toBe(false);
  });

  it("is safe to repeat a proposal and a completed deletion", async () => {
    const { repository, mutations } = harness();
    await mutations.upload(KEY, pngFixture(), { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    expect(await mutations.delete(KEY, ACTOR)).toEqual(proposal);
    const page = await mutations.approval(KEY, proposal.confirmation_token!, ACTOR);
    await mutations.approval(KEY, proposal.confirmation_token!, ACTOR, page.csrf);
    const result = await mutations.delete(KEY, ACTOR, proposal.confirmation_token!);
    expect(await mutations.delete(KEY, ACTOR, proposal.confirmation_token!)).toEqual(result);
    expect(repository.delete).toHaveBeenCalledTimes(1);
  });

  it("binds approval to actor, exact ticket, CSRF, and expiration", async () => {
    const { repository, mutations, advance } = harness();
    await mutations.upload(KEY, pngFixture(), { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    const ticket = proposal.confirmation_token!;
    const page = await mutations.approval(KEY, ticket, ACTOR);
    for (const operation of [
      () => mutations.delete(KEY, "other@example.com", ticket),
      () => mutations.delete(KEY, ACTOR, "wrong-ticket"),
      () => mutations.approval(KEY, ticket, "other@example.com", page.csrf),
      () => mutations.approval(KEY, "wrong-ticket", ACTOR, page.csrf),
      () => mutations.approval(KEY, ticket, ACTOR, "wrong-csrf"),
    ]) await expect(operation()).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    advance(600_001);
    await expect(mutations.approval(KEY, ticket, ACTOR, page.csrf)).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    await expect(mutations.delete(KEY, ACTOR, ticket)).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.objects.has(KEY)).toBe(true);
  });

  it("refuses to delete a different revision even after the earlier revision was approved", async () => {
    const { repository, mutations } = harness();
    await mutations.upload(KEY, pngFixture(), { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    const page = await mutations.approval(KEY, proposal.confirmation_token!, ACTOR);
    await mutations.approval(KEY, proposal.confirmation_token!, ACTOR, page.csrf);
    const replacement = pngFixture(200);
    repository.objects.set(KEY, { value: replacement, metadata: await metadataFor(replacement) });
    await expect(mutations.delete(KEY, ACTOR, proposal.confirmation_token!)).rejects.toMatchObject({ code: "EXTERNAL_CHANGE" });
    expect(repository.delete).not.toHaveBeenCalled();
    expect(repository.objects.get(KEY)?.value).toEqual(replacement);
  });

  it("retires a deleted key so cached content cannot be confused with a new upload", async () => {
    const { repository, mutations } = harness();
    const bytes = pngFixture();
    await mutations.upload(KEY, bytes, { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    const page = await mutations.approval(KEY, proposal.confirmation_token!, ACTOR);
    await mutations.approval(KEY, proposal.confirmation_token!, ACTOR, page.csrf);
    await mutations.delete(KEY, ACTOR, proposal.confirmation_token!);
    for (const image of [bytes, pngFixture(200)]) await expect(mutations.upload(KEY, image, { content_type: "image/png" })).rejects.toMatchObject({ code: "KEY_RETIRED" });
    expect(repository.put).toHaveBeenCalledTimes(1);
    expect(repository.objects.has(KEY)).toBe(false);
  });

  it("recovers a deletion that succeeded in KV before the durable tombstone could be saved", async () => {
    const { repository, state, mutations, now } = harness();
    const bytes = pngFixture();
    await mutations.upload(KEY, bytes, { content_type: "image/png" });
    const proposal = await mutations.delete(KEY, ACTOR);
    const ticket = proposal.confirmation_token!;
    const page = await mutations.approval(KEY, ticket, ACTOR);
    await mutations.approval(KEY, ticket, ACTOR, page.csrf);
    state.set.mockImplementationOnce(async (value) => { state.value = structuredClone(value); })
      .mockRejectedValueOnce(new Error("simulated restart before saving tombstone"));
    await expect(mutations.delete(KEY, ACTOR, ticket)).rejects.toThrow("restart");
    expect(state.value?.object?.status).toBe("deleting");
    expect(repository.objects.has(KEY)).toBe(false);
    const restarted = new MediaMutations(repository, state, ORIGIN, undefined, now);
    await expect(restarted.delete(KEY, ACTOR)).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    await expect(restarted.delete(KEY, "other@example.com", ticket)).rejects.toMatchObject({ code: "INVALID_CONFIRMATION" });
    expect(await restarted.delete(KEY, ACTOR, ticket)).toMatchObject({ status: "deleted", deleted: true });
    expect(repository.delete).toHaveBeenCalledTimes(1);
    expect(state.value?.object?.status).toBe("deleted");
    await expect(restarted.upload(KEY, bytes, { content_type: "image/png" })).rejects.toMatchObject({ code: "KEY_RETIRED" });
  });

  it("can request approval for an upload whose bytes reached KV before its acknowledgement was lost", async () => {
    const { repository, state, mutations } = harness();
    const bytes = pngFixture();
    repository.put.mockImplementationOnce(async (key, data, metadata) => {
      repository.objects.set(key, { value: data.slice(), metadata: structuredClone(metadata) });
      throw new Error("lost acknowledgement after write");
    });
    await expect(mutations.upload(KEY, bytes, { content_type: "image/png" })).rejects.toThrow("acknowledgement");
    expect(state.value?.object?.status).toBe("pending");
    const proposal = await mutations.delete(KEY, ACTOR);
    expect(proposal.status).toBe("confirmation_required");
    expect(state.value?.object?.status).toBe("live");
    expect(await mutations.approval(KEY, proposal.confirmation_token!, ACTOR)).toMatchObject({ approved: false });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it("does not delete any object for a missing key or directory/bulk key", async () => {
    const { repository, mutations } = harness();
    expect(await mutations.delete(KEY, ACTOR)).toMatchObject({ status: "not_found", deleted: false });
    await expect(mutations.delete("/assets/", ACTOR)).rejects.toMatchObject({ code: "INVALID_KEY" });
    await expect(mutations.delete("/assets/*", ACTOR)).rejects.toMatchObject({ code: "INVALID_KEY" });
    expect(repository.delete).not.toHaveBeenCalled();
  });
});

describe("read-only download_media KV image validation", () => {
  it("returns validated binary bytes and metadata without writes or CDN calls", async () => {
    const {repository} = harness();
    const bytes = pngFixture(25);
    const metadata = await metadataFor(bytes);
    repository.objects.set(KEY, {value: bytes, metadata});
    const result = await downloadMedia(repository, {key: KEY, expected_sha256: metadata.sha256});
    expect(result.bytes).toEqual(bytes);
    expect(result.metadata).toEqual({
      key: KEY, cdn_url: CDN_BASE + KEY, filename: "image-v1.png",
      content_type: "image/png", byte_size: bytes.length, sha256: metadata.sha256,
      etag: metadata.etag, last_modified: metadata.uploadedAt,
    });
    expect(repository.read).toHaveBeenCalledWith(KEY);
    expect(repository.put).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it.each(["/assets/../secret.png", "/assets/%2e%2e/secret.png", "/private/x.png", "/assets/other\\\\path.png"])(
    "rejects path traversal or invalid key %s", async key => {
      const {repository} = harness();
      await expect(downloadMedia(repository, {key})).rejects.toMatchObject({code: "INVALID_KEY"});
      expect(repository.read).not.toHaveBeenCalled();
    },
  );

  it("returns MEDIA_NOT_FOUND for absent object", async () => {
    const {repository} = harness();
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "MEDIA_NOT_FOUND"});
  });

  it("detects forged and unsupported MIME independently of KV metadata", async () => {
    const {repository} = harness();
    const bytes = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    repository.objects.set(KEY, {value: bytes, metadata: {contentType: "image/png"}});
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "UNSUPPORTED_MIME"});
    repository.objects.set(KEY, {value: pngFixture(), metadata: {contentType: "image/webp"}});
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "UNSUPPORTED_MIME"});
  });

  it("rejects oversized KV bytes and maps bounded stream errors to FILE_TOO_LARGE", async () => {
    const {repository} = harness();
    repository.objects.set(KEY, {value: new Uint8Array(10_000_001), metadata: null});
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "FILE_TOO_LARGE"});
    repository.read.mockRejectedValueOnce(Object.assign(new Error("bounded"), {code: "IMAGE_TOO_LARGE"}));
    // Non-MediaError is always redacted as a generic backend failure.
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "DOWNLOAD_FAILED"});
  });

  it("rejects hash mismatch, maps KV outages, and handles missing legacy metadata", async () => {
    const {repository} = harness();
    const bytes = pngFixture(8);
    repository.objects.set(KEY, {value: bytes, metadata: null});
    await expect(downloadMedia(repository, {key: KEY, expected_sha256: "0".repeat(64)}))
      .rejects.toMatchObject({code: "HASH_MISMATCH"});
    const result = await downloadMedia(repository, {key: KEY});
    expect(result.metadata.etag).toBeNull();
    expect(result.metadata.last_modified).toBeNull();
    repository.read.mockRejectedValueOnce(new Error("secret backend detail"));
    await expect(downloadMedia(repository, {key: KEY})).rejects.toMatchObject({code: "DOWNLOAD_FAILED"});
  });
});
