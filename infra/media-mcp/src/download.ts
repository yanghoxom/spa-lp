import { MediaError } from "./validation";

const DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_URL_LENGTH = 16_384;

/** An operator-controlled, exact DNS hostname. Never accept suffix wildcards. */
function isPublicHostname(hostname: string): boolean {
  if (
    hostname.length > 253 ||
    hostname !== hostname.toLowerCase() ||
    !/^[a-z0-9.-]+$/.test(hostname) ||
    /^[0-9.]+$/.test(hostname)
  ) return false;

  const labels = hostname.split(".");
  if (labels.length < 2 || !/[a-z]/.test(labels[labels.length - 1])) return false;
  if (labels.some((label) =>
    label.length < 1 || label.length > 63 ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label) ||
    label.startsWith("xn--")
  )) return false;

  return !["localhost", "local", "internal", "home", "lan"].some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
}

/**
 * Validate before fetching. The allowlist must contain exact trusted hosts,
 * without a scheme, path, port, wildcard, or Unicode hostname.
 *
 * Only allowlist hosts whose DNS and URL endpoints the operator trusts. Workers
 * fetch does not expose a DNS-resolution-and-address-pinning API; allowing an
 * attacker-controlled host would defeat this application-level SSRF boundary.
 */
export function validateDownloadUrl(url: string, allowedHosts: string[]): URL {
  const invalid = () => new MediaError("INVALID_DOWNLOAD_URL", "The file URL is not an allowed HTTPS URL.");
  if (
    typeof url !== "string" || url.length === 0 || url.length > MAX_URL_LENGTH ||
    /[\u0000-\u0020\u007f-\u009f\\]/.test(url)
  ) throw invalid();

  // Reject parser normalization of empty authority, encoded hostnames, or an
  // empty userinfo segment before URL() could turn it into an accepted URL.
  const authority = /^https:\/\/([^/?#]+)/i.exec(url)?.[1];
  if (!authority || /[%@]|[^\x21-\x7e]/.test(authority)) throw invalid();

  let parsed: URL;
  try { parsed = new URL(url); } catch { throw invalid(); }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password ||
    parsed.port || parsed.hash || url.includes("#") || !isPublicHostname(parsed.hostname)
  ) throw invalid();

  if (!Array.isArray(allowedHosts) || allowedHosts.some((host) =>
    typeof host !== "string" || !isPublicHostname(host)
  )) {
    throw new MediaError("INVALID_ALLOWLIST", "The download host allowlist is not configured correctly.");
  }
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new MediaError("HOST_NOT_ALLOWED", "The file host is not on the download allowlist.");
  }
  return parsed;
}

function assertLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new MediaError("INVALID_SIZE_LIMIT", "The image size limit is not configured correctly.");
  }
}

function timeoutError(): MediaError {
  return new MediaError("DOWNLOAD_TIMEOUT", "The image download exceeded its time limit.");
}

function downloadError(): MediaError {
  return new MediaError("DOWNLOAD_FAILED", "The image could not be downloaded.");
}

function cancelBody(response: Response): void {
  // Cancellation is best effort. Do not let a malicious/hung stream's cancel
  // promise extend the download deadline, and never expose its error text.
  try {
    if (response.body && !response.body.locked) void response.body.cancel().catch(() => undefined);
  } catch { /* No content or upstream exception is logged. */ }
}

function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(timeoutError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (error) => { signal.removeEventListener("abort", onAbort); reject(error); },
    );
    if (signal.aborted) onAbort();
  });
}

async function readBody(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  assertLimit(maxBytes);
  if (signal?.aborted) { cancelBody(response); throw timeoutError(); }

  const encoding = response.headers.get("Content-Encoding")?.trim().toLowerCase();
  const declaredLength = response.headers.get("Content-Length");
  // Fetch may decode a compressed body while retaining its compressed length.
  // Only use an identity Content-Length for early rejection; actual streamed
  // bytes, rather than the header, always determine the returned size.
  if ((!encoding || encoding === "identity") && declaredLength && /^\d+$/.test(declaredLength)) {
    if (Number(declaredLength) > maxBytes) {
      cancelBody(response);
      throw new MediaError("IMAGE_TOO_LARGE", "The image exceeds the configured byte limit.");
    }
  }
  if (!response.body) return new Uint8Array(0);

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try { reader = response.body.getReader(); } catch { throw downloadError(); }
  const cancelReader = () => { try { void reader.cancel().catch(() => undefined); } catch { /* best effort */ } };
  signal?.addEventListener("abort", cancelReader, { once: true });
  let byteSize = 0;

  try {
    // One bounded buffer also caps bookkeeping overhead if a response arrives in
    // millions of tiny chunks. Keeping an array per chunk would not bound memory.
    const bytes = new Uint8Array(maxBytes);
    while (true) {
      const { done, value } = await abortable(reader.read(), signal);
      if (signal?.aborted) throw timeoutError();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw downloadError();
      if (value.byteLength > maxBytes - byteSize) {
        throw new MediaError("IMAGE_TOO_LARGE", "The image exceeds the configured byte limit.");
      }
      bytes.set(value, byteSize);
      byteSize += value.byteLength;
    }
    return byteSize === maxBytes ? bytes : bytes.slice(0, byteSize);
  } catch (error) {
    cancelReader();
    if (signal?.aborted) throw timeoutError();
    if (error instanceof MediaError) throw error;
    throw downloadError();
  } finally {
    signal?.removeEventListener("abort", cancelReader);
    try { reader.releaseLock(); } catch { /* Pending reads have been cancelled. */ }
  }
}

/** Read a body without any unbounded text()/arrayBuffer() buffering. */
export async function readBoundedBody(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array> {
  return readBody(response, maxBytes, signal);
}

/** Download only from an exact allowlisted HTTPS host, with a whole-operation deadline. */
export async function fetchImage(
  url: string,
  allowedHosts: string[],
  maxBytes = 10_000_000,
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  assertLimit(maxBytes);
  const target = validateDownloadUrl(url, allowedHosts);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let response: Response | undefined;

  try {
    const pendingResponse = fetcher(target.href, {
      method: "GET",
      redirect: "manual",
      // This is a fresh server-side request. Workers has no ambient cookie jar;
      // never clone incoming headers, cookies, Authorization, or Referer here.
      headers: {
        Accept: "image/webp, image/jpeg, image/png, image/avif",
        "Accept-Encoding": "identity",
      },
      signal: controller.signal,
    }).then((received) => {
      // Also clean up if an injected/misbehaving fetch implementation resolves
      // after the deadline instead of respecting AbortSignal.
      if (controller.signal.aborted) cancelBody(received);
      return received;
    });
    response = await abortable(pendingResponse, controller.signal);
    if (response.redirected || (response.status >= 300 && response.status < 400)) {
      throw new MediaError("REDIRECT_NOT_ALLOWED", "Redirects are not allowed for image downloads.");
    }
    // A partial object is never a valid full upload, and error bodies may
    // contain credentials or private provider details. Do not read those bodies.
    if (response.status !== 200) throw downloadError();
    return await readBody(response, maxBytes, controller.signal);
  } catch (error) {
    if (response) cancelBody(response);
    if (controller.signal.aborted) throw timeoutError();
    if (error instanceof MediaError) throw error;
    throw downloadError();
  } finally {
    clearTimeout(deadline);
  }
}
