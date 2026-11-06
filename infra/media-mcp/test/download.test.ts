import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImage, readBoundedBody, validateDownloadUrl } from "../src/download";

const HOST = "files.example.com";
const URL = `https://${HOST}/image?signature=private-token`;

function streamResponse(chunks: number[][], headers: Record<string, string> = {}) {
  let next = 0;
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next === chunks.length) controller.close();
      else controller.enqueue(Uint8Array.from(chunks[next++]));
    },
    cancel,
  }, { highWaterMark: 0 });
  return { response: new Response(stream, { headers }), cancel };
}

function mockFetch(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("validateDownloadUrl", () => {
  it("accepts exact allowed HTTPS hosts, a signed query and the default TLS port", () => {
    expect(validateDownloadUrl(URL, [HOST]).hostname).toBe(HOST);
    expect(validateDownloadUrl(`HTTPS://${HOST.toUpperCase()}:443/a`, [HOST]).href).toBe(`https://${HOST}/a`);
  });

  it.each([
    `http://${HOST}/a`,
    `https://${HOST}:444/a`,
    `https://user:password@${HOST}/a`,
    `https://@${HOST}/a`,
    `https://${HOST}/a#fragment`,
    `https://${HOST}/a#`,
    `https://%66iles.example.com/a`,
    `https://${HOST}./a`,
    `https:///${HOST}/a`,
    `https://fıles.example.com/a`,
    `https://xn--files-xya.example.com/a`,
    ` https://${HOST}/a`,
    `https://${HOST}/a\n`,
    `https://${HOST}\\@169.254.169.254/a`,
    "https://127.0.0.1/a",
    "https://2130706433/a",
    "https://0x7f000001/a",
    "https://0177.0.0.1/a",
    "https://[::1]/a",
    "https://[::ffff:127.0.0.1]/a",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/a",
    "https://metadata.local/a",
    "https://service.internal/a",
    "file:///etc/passwd",
    "data:image/png,example",
    "/relative/image",
  ])("rejects unsafe or ambiguous URL %s", (url) => {
    expect(() => validateDownloadUrl(url, [HOST])).toThrow();
  });

  it.each([
    "https://files.example.com.attacker.net/a",
    "https://attacker.files.example.com/a",
    "https://files-example.com/a",
    "https://example.com/a",
  ])("does not expand an allowlist entry to %s", (url) => {
    expect(() => validateDownloadUrl(url, [HOST])).toThrow("allowlist");
  });

  it("denies URL downloads if no hosts have been configured", () => {
    expect(() => validateDownloadUrl(URL, [])).toThrow("allowlist");
  });

  it.each(["*.example.com", "https://files.example.com", "files.example.com:443", "files.example.com/path", "127.0.0.1", "localhost"])(
    "rejects unsafe allowlist configuration %s", (host) => {
      expect(() => validateDownloadUrl(URL, [host, HOST])).toThrow("configured correctly");
    },
  );

  it("does not include signed URL parameters in validation errors", () => {
    try { validateDownloadUrl(`${URL}#invalid`, [HOST]); } catch (error) {
      expect(String(error)).not.toContain("private-token");
      expect(String(error)).not.toContain(HOST);
      return;
    }
    throw new Error("Expected URL validation failure");
  });
});

describe("readBoundedBody", () => {
  it("collects chunks and accepts the exact limit", async () => {
    const { response } = streamResponse([[1, 2], [3, 4]], { "Content-Length": "4" });
    expect(await readBoundedBody(response, 4)).toEqual(Uint8Array.from([1, 2, 3, 4]));
  });

  it("cancels an object whose identity Content-Length already exceeds the cap", async () => {
    const { response, cancel } = streamResponse([[1]], { "Content-Length": "100" });
    await expect(readBoundedBody(response, 4)).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([undefined, "1", "nonsense"])("counts the stream even with missing or untrustworthy length %s", async (length) => {
    const { response, cancel } = streamResponse([[1, 2], [3, 4, 5]], length ? { "Content-Length": length } : {});
    await expect(readBoundedBody(response, 4)).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });

  it("uses actual bytes when a declared size is smaller but the body remains within the cap", async () => {
    const { response } = streamResponse([[1, 2, 3]], { "Content-Length": "1" });
    expect((await readBoundedBody(response, 4)).byteLength).toBe(3);
  });

  it("does not compare compressed Content-Length with delivered bytes", async () => {
    const { response } = streamResponse([[1, 2, 3]], { "Content-Encoding": "gzip", "Content-Length": "100" });
    expect((await readBoundedBody(response, 4)).byteLength).toBe(3);
  });

  it("still caps a decoded/compressed stream independently of its reported compressed length", async () => {
    const { response, cancel } = streamResponse([[1, 2, 3, 4, 5]], { "Content-Encoding": "br", "Content-Length": "1" });
    await expect(readBoundedBody(response, 4)).rejects.toMatchObject({ code: "IMAGE_TOO_LARGE" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("returns an empty buffer when the response has no body", async () => {
    expect((await readBoundedBody(new Response(null), 4)).byteLength).toBe(0);
  });

  it.each([0, -1, Number.NaN, Infinity, 1.5])("rejects invalid size limit %s", async (limit) => {
    await expect(readBoundedBody(new Response(null), limit)).rejects.toMatchObject({ code: "INVALID_SIZE_LIMIT" });
  });

  it("replaces stream exception details with a safe static error", async () => {
    const response = new Response(new ReadableStream({
      pull(controller) { controller.error(new Error("secret upstream token")); },
    }));
    const error = await readBoundedBody(response, 4).catch((value: Error) => value);
    expect(error).toMatchObject({ code: "DOWNLOAD_FAILED" });
    expect(String(error)).not.toContain("secret upstream token");
    expect(response.body?.locked).toBe(false);
  });
});

describe("fetchImage", () => {
  it("sends only the allowlisted URL and image headers, omitting credentials and redirects", async () => {
    const fetcher = mockFetch(streamResponse([[1, 2, 3]]).response);
    expect(await fetchImage(URL, [HOST], 4, fetcher)).toEqual(Uint8Array.from([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(URL);
    expect(options).toMatchObject({ method: "GET", redirect: "manual" });
    const headers = new Headers(options?.headers);
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.has("Cookie")).toBe(false);
    expect(headers.has("Referer")).toBe(false);
    expect(headers.get("Accept-Encoding")).toBe("identity");
  });

  it("never makes a request for a rejected URL", async () => {
    const fetcher = mockFetch(new Response(null));
    await expect(fetchImage("https://169.254.169.254/a", [HOST], 4, fetcher)).rejects.toMatchObject({ code: "INVALID_DOWNLOAD_URL" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a fetch adapter that already followed a redirect", async () => {
    const response = streamResponse([[1]]).response;
    Object.defineProperty(response, "redirected", { value: true });
    await expect(fetchImage(URL, [HOST], 4, mockFetch(response))).rejects.toMatchObject({ code: "REDIRECT_NOT_ALLOWED" });
  });

  it.each([301, 302, 303, 307, 308])("rejects HTTP %s without following its Location", async (status) => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }), {
      status,
      headers: { Location: "http://169.254.169.254/latest/meta-data?token=private-token" },
    });
    const fetcher = mockFetch(response);
    const error = await fetchImage(URL, [HOST], 4, fetcher).catch((value: Error) => value);
    expect(error).toMatchObject({ code: "REDIRECT_NOT_ALLOWED" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(String(error)).not.toContain("private-token");
  });

  it.each([204, 206, 400, 401, 403, 404, 500])("rejects HTTP %s without reading or exposing its error body", async (status) => {
    const body = status === 204 ? null : "secret upstream access token";
    const response = new Response(body, { status });
    const fetcher = mockFetch(response);
    const error = await fetchImage(URL, [HOST], 100, fetcher).catch((value: Error) => value);
    expect(error).toMatchObject({ code: "DOWNLOAD_FAILED" });
    expect(String(error)).not.toContain("secret");
    expect(String(error)).not.toContain("private-token");
  });

  it("replaces fetch exception details with a safe error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error(`failed ${URL}, bearer secret-token`));
    const error = await fetchImage(URL, [HOST], 4, fetcher).catch((value: Error) => value);
    expect(error).toMatchObject({ code: "DOWNLOAD_FAILED" });
    expect(String(error)).not.toContain("token");
    expect(String(error)).not.toContain(HOST);
  });

  it("enforces the deadline even if fetch itself ignores AbortSignal", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => undefined));
    const pending = fetchImage(URL, [HOST], 4, fetcher).catch((value: Error) => value);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ code: "DOWNLOAD_TIMEOUT" });
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("cancels a stalled stream within the same overall deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const response = new Response(new ReadableStream<Uint8Array>({
      pull: () => new Promise(() => undefined),
      cancel,
    }, { highWaterMark: 0 }));
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      return response;
    });
    const pending = fetchImage(URL, [HOST], 4, fetcher).catch((value: Error) => value);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ code: "DOWNLOAD_TIMEOUT" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(response.body?.locked).toBe(false);
  });

  it("does not allow a hanging cancellation promise to extend the deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn(() => new Promise<void>(() => undefined));
    const response = new Response(new ReadableStream<Uint8Array>({
      pull: () => new Promise(() => undefined),
      cancel,
    }, { highWaterMark: 0 }));
    const pending = fetchImage(URL, [HOST], 4, mockFetch(response)).catch((value: Error) => value);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await pending).toMatchObject({ code: "DOWNLOAD_TIMEOUT" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
