import { MediaError, validateKey, validateImage, detectImageMime, normalizeEtag, validateCacheControl, validatePrefix, keyFromInput } from "./validation";
import { readBoundedBody } from "./download";
import type { CoordinatorState, DeleteResult, MediaMetadata, MediaRepository, MediaResult, StateRepository, UploadOptions } from "./types";

export const CDN_BASE = "https://cdn.phunghakorea.com";
export const DEFAULT_MAX_BYTES = 10_000_000;

export function configuredMaxBytes(value?: string): number {
  if (!value) return DEFAULT_MAX_BYTES;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > DEFAULT_MAX_BYTES) throw new MediaError("INVALID_CONFIG", "Image limit must be between 1 and 10000000 bytes.");
  return n;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function mediaResult(key: string, metadata: MediaMetadata): MediaResult {
  return {key, cdn_url: CDN_BASE + key, content_type: metadata.contentType, byte_size: metadata.byteSize,
    sha256: metadata.sha256, etag: metadata.etag, uploaded_at: metadata.uploadedAt};
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function publicMetadata(key: string, value: unknown) {
  const m = metadataObject(value);
  const contentType = typeof m.contentType === "string" && /^image\/(webp|jpeg|png|avif)$/.test(m.contentType) ? m.contentType : null;
  const hash = typeof m.sha256 === "string" && /^[a-f0-9]{64}$/.test(m.sha256) ? m.sha256 : null;
  const size = typeof m.byteSize === "number" && Number.isSafeInteger(m.byteSize) && m.byteSize >= 0 ? m.byteSize : null;
  const etag = typeof m.etag === "string" && /^(?:W\/)?"[\x21\x23-\x7e]{1,128}"$/.test(m.etag) ? m.etag : null;
  const date = typeof m.uploadedAt === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(m.uploadedAt) ? m.uploadedAt : null;
  return {key, cdn_url: CDN_BASE + key, content_type: contentType, byte_size: size, sha256: hash, etag, uploaded_at: date};
}

export class MediaMutations {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private repository: MediaRepository, private state: StateRepository,
    private serverOrigin: string, private maxBytes = DEFAULT_MAX_BYTES, private now = () => new Date()) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation, operation);
    this.queue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async load(key: string): Promise<CoordinatorState> {
    validateKey(key);
    const stored = await this.state.get();
    if (stored && stored.key !== key) throw new MediaError("KEY_MISMATCH", "Coordinator key mismatch.");
    return stored ?? {key};
  }

  upload(key: string, bytes: Uint8Array, input: UploadOptions): Promise<MediaResult> {
    return this.serial(async () => {
      const state = await this.load(key);
      const mime = validateImage(bytes, input.content_type, this.maxBytes);
      const hash = await sha256(bytes);
      const requestedEtag = normalizeEtag(input.etag, hash);
      const cacheControl = validateCacheControl(input.cache_control);
      if (state.object?.status === "deleted") throw new MediaError("KEY_RETIRED", "This key was deleted. Use a new versioned key.");
      if (state.object?.status === "deleting") throw new MediaError("DELETE_IN_PROGRESS", "Deletion has already been approved for this key.");
      if (state.object && state.object.metadata.sha256 !== hash) throw new MediaError("KEY_CONFLICT", "This key contains different bytes. Use a new versioned key.");
      if (state.object?.status === "live") return mediaResult(key, state.object.metadata);

      if (!state.object) {
        const existing = await this.repository.read(key);
        if (existing.value !== null) {
          const existingHash = await sha256(existing.value);
          if (existingHash !== hash) throw new MediaError("KEY_CONFLICT", "This key contains different bytes. Use a new versioned key.");
          const old = publicMetadata(key, existing.metadata);
          // Preserve the existing ETag and cache policy. Backfill legacy metadata once.
          const metadata: MediaMetadata = {contentType: mime, sha256: hash, byteSize: bytes.byteLength,
            etag: old.etag ?? requestedEtag, uploadedAt: old.uploaded_at ?? this.now().toISOString(),
            cacheControl: typeof metadataObject(existing.metadata).cacheControl === "string" ? validateCacheControl(metadataObject(existing.metadata).cacheControl as string) : "public, max-age=86400"};
          const complete = old.content_type === mime && old.sha256 === hash && old.byte_size === bytes.byteLength && !!old.etag && !!old.uploaded_at;
          state.object = {status: complete ? "live" : "pending", metadata};
          await this.state.set(state);
          if (complete) return mediaResult(key, metadata);
        }
        state.object ??= {status: "pending", metadata: {contentType: mime, etag: requestedEtag, sha256: hash,
          byteSize: bytes.byteLength, uploadedAt: this.now().toISOString(), cacheControl}};
        // Persist the intent before external I/O. A retry resumes the same SHA and timestamp after a crash.
        await this.state.set(state);
      }
      await this.repository.put(key, bytes, state.object.metadata);
      state.object.status = "live";
      state.approval = undefined;
      await this.state.set(state);
      return mediaResult(key, state.object.metadata);
    });
  }

  private deleteResult(state: CoordinatorState, status: DeleteResult["status"]): DeleteResult {
    const a = state.approval;
    const pending = status === "confirmation_required" || status === "approved";
    return {key: state.key, cdn_url: CDN_BASE + state.key, status, deleted: status === "deleted",
      confirmation_token: pending && a ? a.ticket : null,
      approval_url: pending && a ? `${this.serverOrigin}/authorize/delete?key=${encodeURIComponent(state.key)}&ticket=${a.ticket}` : null,
      expected_sha256: a?.sha256 ?? state.object?.metadata.sha256 ?? null,
      expires_at: pending && a ? new Date(a.expiresAt).toISOString() : null,
      cdn_cache_may_remain: status === "deleted"};
  }

  delete(key: string, actor: string, ticket?: string): Promise<DeleteResult> {
    return this.serial(async () => {
      const state = await this.load(key);
      if (state.object?.status === "deleted") return this.deleteResult(state, "deleted");
      const existing = await this.repository.read(key);
      // An approved, durably recorded delete may have succeeded before a process restart.
      if (state.object?.status === "deleting") {
        const a = state.approval;
        if (!ticket || !a?.approved || a.ticket !== ticket || a.actor !== actor) throw new MediaError("INVALID_CONFIRMATION", "The original confirmation is required to resume deletion.");
        if (existing.value !== null && await sha256(existing.value) !== a.sha256) throw new MediaError("EXTERNAL_CHANGE", "Media changed outside this MCP. Review it before deleting.");
        if (existing.value !== null) await this.repository.delete(key);
        state.object.status = "deleted";
        state.approval = undefined;
        await this.state.set(state);
        return this.deleteResult(state, "deleted");
      }
      if (existing.value === null) return this.deleteResult(state, "not_found");
      const hash = await sha256(existing.value);
      if (state.object && state.object.metadata.sha256 !== hash) throw new MediaError("EXTERNAL_CHANGE", "Media changed outside this MCP. Review it before deleting.");
      if (!state.object) {
        const m = publicMetadata(key, existing.metadata);
        const contentType = detectImageMime(existing.value);
        state.object = {status: "live", metadata: {contentType, byteSize: existing.value.byteLength, sha256: hash,
          etag: m.etag ?? normalizeEtag(undefined, hash), uploadedAt: m.uploaded_at ?? this.now().toISOString(), cacheControl: "public, max-age=86400"}};
      }
      if (state.object.status === "pending") {state.object.status = "live"; await this.state.set(state);}
      const now = this.now().getTime();
      const a = state.approval;
      if (ticket) {
        if (!a || a.ticket !== ticket || a.actor !== actor || a.expiresAt <= now || a.sha256 !== hash) {
          throw new MediaError("INVALID_CONFIRMATION", "Confirmation is invalid, expired, or belongs to another user or revision.");
        }
        if (!a.approved) return this.deleteResult(state, "confirmation_required");
        state.object.status = "deleting";
        await this.state.set(state);
        await this.repository.delete(key);
        state.object.status = "deleted";
        state.approval = undefined;
        await this.state.set(state);
        return this.deleteResult(state, "deleted");
      }
      if (!a || a.actor !== actor || a.sha256 !== hash || a.expiresAt <= now) {
        state.approval = {ticket: crypto.randomUUID(), actor, sha256: hash, expiresAt: now + 600_000,
          csrf: crypto.randomUUID(), approved: false};
        await this.state.set(state);
      }
      return this.deleteResult(state, state.approval!.approved ? "approved" : "confirmation_required");
    });
  }

  approval(key: string, ticket: string, actor: string, csrf?: string) {
    return this.serial(async () => {
      const state = await this.load(key);
      const a = state.approval;
      if (!a || !state.object || a.ticket !== ticket || a.actor !== actor || a.expiresAt <= this.now().getTime() || state.object.status !== "live") {
        throw new MediaError("INVALID_CONFIRMATION", "Confirmation is unavailable or expired.");
      }
      if (csrf !== undefined) {
        if (a.csrf !== csrf) throw new MediaError("INVALID_CONFIRMATION", "Invalid confirmation request.");
        a.approved = true;
        await this.state.set(state);
      }
      return {key, sha256: a.sha256, byte_size: state.object.metadata.byteSize, csrf: a.csrf, approved: a.approved};
    });
  }
}

export async function getMediaMetadata(repository: MediaRepository, key: string) {
  validateKey(key);
  const entry = await repository.metadata(key);
  return {exists: entry.exists, ...publicMetadata(key, entry.metadata)};
}

export async function listMedia(repository: MediaRepository, input: {prefix?: string; limit?: number; cursor?: string}) {
  const prefix = validatePrefix(input.prefix ?? "/assets/");
  const limit = input.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new MediaError("INVALID_LIMIT", "List limit must be between 1 and 100.");
  if (input.cursor && (input.cursor.length > 2048 || !/^[\x21-\x7e]+$/.test(input.cursor))) throw new MediaError("INVALID_CURSOR", "Invalid pagination cursor.");
  const page = await repository.list(prefix, limit, input.cursor);
  const items = page.keys.filter(item => {try {return validateKey(item.name).startsWith(prefix);} catch {return false;}})
    .map(item => publicMetadata(item.name, item.metadata));
  return {items, prefix, limit, list_complete: page.complete, cursor: page.complete ? null : page.cursor ?? null};
}

export async function verifyMedia(repository: MediaRepository, input: {key?: string; cdn_url?: string},
  fetcher: typeof fetch = fetch, maxBytes = DEFAULT_MAX_BYTES) {
  const key = keyFromInput(input, CDN_BASE);
  const item = await repository.read(key);
  const meta = publicMetadata(key, item.metadata);
  const exists = item.value !== null;
  const kvHash = item.value ? await sha256(item.value) : null;
  const kvSize = item.value?.byteLength ?? null;
  const mismatches: string[] = [];
  let kvMime: string | null = null;
  if (item.value) {
    try {kvMime = detectImageMime(item.value); if (meta.content_type && meta.content_type !== kvMime) mismatches.push("kv_mime");} catch {mismatches.push("kv_mime");}
    if (meta.sha256 && meta.sha256 !== kvHash) mismatches.push("kv_sha256");
    if (meta.byte_size !== null && meta.byte_size !== kvSize) mismatches.push("kv_byte_size");
  }
  let publicAvailable = false;
  let headStatus: number | null = null;
  let getStatus: number | null = null;
  let cdnHash: string | null = null;
  let cdnSize: number | null = null;
  let cdnMime: string | null = null;
  let cdnEtag: string | null = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const boundedFetch = (target: string, options: RequestInit): Promise<Response> => new Promise((resolve, reject) => {
    const abort = () => reject(new MediaError("CDN_TIMEOUT", "The CDN verification timed out."));
    controller.signal.addEventListener("abort", abort, {once: true});
    fetcher(target, options).then(response => {
      controller.signal.removeEventListener("abort", abort);
      if (controller.signal.aborted) {void response.body?.cancel().catch(() => undefined); abort();} else resolve(response);
    }, error => {controller.signal.removeEventListener("abort", abort); reject(error);});
    if (controller.signal.aborted) abort();
  });
  try {
    const options = {redirect: "manual" as const, signal: controller.signal, headers: {"Accept": "image/webp,image/avif,image/png,image/jpeg", "Accept-Encoding": "identity"}};
    let head: Response | undefined;
    try {
      head = await boundedFetch(CDN_BASE + key, {...options, method: "HEAD"});
      headStatus = head.status;
      void head.body?.cancel().catch(() => undefined);
    } catch {if (controller.signal.aborted) throw new MediaError("CDN_TIMEOUT", "The CDN verification timed out.");}
    const response = await boundedFetch(CDN_BASE + key, {...options, method: "GET"});
    getStatus = response.status;
    if (response.status !== 200) {
      void response.body?.cancel().catch(() => undefined);
      mismatches.push("cdn_http_status");
    } else {
      const bytes = await readBoundedBody(response, maxBytes, controller.signal);
      cdnSize = bytes.byteLength;
      cdnHash = await sha256(bytes);
      cdnMime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? null;
      cdnEtag = response.headers.get("ETag");
      try {validateImage(bytes, cdnMime ?? "", maxBytes); publicAvailable = true;} catch {mismatches.push("cdn_mime");}
      if (exists) {
        if (cdnHash !== kvHash) mismatches.push("sha256");
        if (cdnSize !== kvSize) mismatches.push("byte_size");
        if (cdnMime !== kvMime) mismatches.push("content_type");
        if (meta.etag && cdnEtag !== meta.etag) mismatches.push("etag");
      } else mismatches.push("kv_missing");
      const responseLength = response.headers.get("Content-Length");
      if (responseLength !== null && Number(responseLength) !== cdnSize) mismatches.push("cdn_content_length");
      if (head && head.status >= 200 && head.status < 300) {
        const hl = head.headers.get("Content-Length");
        const hm = head.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
        const he = head.headers.get("ETag");
        if (hl !== null && Number(hl) !== cdnSize) mismatches.push("head_byte_size");
        if (hm && hm !== cdnMime) mismatches.push("head_content_type");
        if (he && he !== cdnEtag) mismatches.push("head_etag");
      }
    }
  } catch {mismatches.push("cdn_unavailable");} finally {clearTimeout(timer);}
  return {exists, publicly_available: publicAvailable, cdn_url: CDN_BASE + key,
    content_type: kvMime ?? meta.content_type, byte_size: kvSize, sha256: kvHash, etag: meta.etag,
    integrity_ok: exists && publicAvailable && mismatches.length === 0,
    mismatches: [...new Set(mismatches)], cdn: {head_status: headStatus, get_status: getStatus,
      content_type: cdnMime, byte_size: cdnSize, sha256: cdnHash, etag: cdnEtag}};
}
