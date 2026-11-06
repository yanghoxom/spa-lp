import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_BYTES,
  MediaError,
  decodeBase64,
  detectImageMime,
  keyFromInput,
  normalizeEtag,
  validateCacheControl,
  validateImage,
  validateKey,
  validatePrefix,
} from '../src/validation.js';

// Generate container fixtures in memory. No image files or base64 payloads are
// stored in the repository. Compressed image decoding is outside these tests.
const text = (value: string) => new TextEncoder().encode(value);
function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function number32(value: number, little = false): Uint8Array {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value, little);
  return result;
}
function pngChunk(type: string, payload: Uint8Array): Uint8Array {
  const body = concat(text(type), payload);
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return concat(number32(payload.length), body, number32((crc ^ 0xffffffff) >>> 0));
}
function png(): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1); // width
  view.setUint32(4, 1); // height
  header[8] = 8; // 8-bit RGB
  header[9] = 2;
  const scanline = new Uint8Array(4); // Filter + black RGB pixel.
  const signature = concat(new Uint8Array([137]), text('PNG'), new Uint8Array([13, 10, 26, 10]));
  return concat(signature, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scanline)), pngChunk('IEND', new Uint8Array()));
}
function jpegSegment(marker: number, data: Uint8Array): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = 0xff;
  header[1] = marker;
  new DataView(header.buffer).setUint16(2, data.length + 2);
  return concat(header, data);
}
function jpeg(): Uint8Array {
  const frame = new Uint8Array(9);
  frame[0] = 8;
  const frameView = new DataView(frame.buffer);
  frameView.setUint16(1, 1);
  frameView.setUint16(3, 1);
  frame[5] = 1;
  frame[6] = 1;
  frame[7] = 0x11;
  const scan = new Uint8Array(6);
  scan[0] = 1;
  scan[1] = 1;
  scan[4] = 63;
  return concat(new Uint8Array([0xff, 0xd8]), jpegSegment(0xc0, frame), jpegSegment(0xda, scan), new Uint8Array([0, 0xff, 0xd9]));
}
function riffChunk(type: string, data: Uint8Array): Uint8Array {
  return concat(text(type), number32(data.length, true), data, new Uint8Array(data.length & 1));
}
function webpChunks(...chunks: Uint8Array[]): Uint8Array {
  const body = concat(text('WEBP'), ...chunks);
  return concat(text('RIFF'), number32(body.length, true), body);
}
function losslessChunk(): Uint8Array {
  const data = new Uint8Array(6);
  data[0] = 0x2f;
  return riffChunk('VP8L', data);
}
function webp(): Uint8Array { return webpChunks(losslessChunk()); }
function animatedWebp(): Uint8Array {
  const extended = new Uint8Array(10);
  extended[0] = 2;
  return webpChunks(riffChunk('VP8X', extended), riffChunk('ANIM', new Uint8Array(6)), riffChunk('ANMF', concat(new Uint8Array(16), losslessChunk())));
}
function box(type: string, data: Uint8Array): Uint8Array {
  return concat(number32(data.length + 8), text(type), data);
}
function avif(): Uint8Array {
  const type = box('ftyp', concat(text('avif'), number32(0), text('mif1'), text('avif')));
  const metadata = box('meta', concat(number32(0), ...['hdlr', 'pitm', 'iloc', 'iinf', 'iprp'].map(name => box(name, new Uint8Array(4)))));
  return concat(type, metadata, box('mdat', new Uint8Array(1)));
}
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}
function errorCode(action: () => unknown): string | undefined {
  try { action(); } catch (error) { if (error instanceof MediaError) return error.code; throw error; }
  return undefined;
}

describe('canonical media keys and prefixes', () => {
  it('accepts canonical nested and versioned image keys', () => {
    expect(validateKey('/assets/articles/serum-v2-960.webp')).toBe('/assets/articles/serum-v2-960.webp');
    expect(validateKey('/assets/product_480.v3.avif')).toBe('/assets/product_480.v3.avif');
  });
  it.each([
    '/other/a.webp', 'assets/a.webp', '//assets/a.webp', '/assets', '/assets/',
    '/assets/a/', '/assets//a.webp', '/assets/./a.webp', '/assets/a/../b.webp',
    '/assets/%2e%2e/a.webp', '/assets/%252e%252e/a.webp', '/assets/%2Fa.webp',
    '/assets/a\\b.webp', '/assets/a.webp?x=1', '/assets/a.webp#x',
    '/assets/a\u0000.webp', '/assets/a\r\n.webp', '/assets/a b.webp', '/assets/mỹ-phẩm.webp',
    '/assets/a;b.webp', '/assets/*', '/assets/https:evil.webp',
  ])('rejects unsafe key %s', key => {
    expect(errorCode(() => validateKey(key))).toBe('INVALID_KEY');
  });
  it('enforces the KV key byte bound at the exact boundary', () => {
    const exact = `/assets/${'a'.repeat(504)}`;
    expect(validateKey(exact)).toHaveLength(512);
    expect(errorCode(() => validateKey(`${exact}a`))).toBe('INVALID_KEY');
  });
  it('allows safe directory and partial prefixes', () => {
    expect(validatePrefix('/assets/')).toBe('/assets/');
    expect(validatePrefix('/assets/articles/')).toBe('/assets/articles/');
    expect(validatePrefix('/assets/products/serum-')).toBe('/assets/products/serum-');
  });
  it.each(['/assets//', '/', '/assets/../', '/assets/%2e', '/assets/foo//bar'])('rejects unsafe prefix %s', prefix => {
    expect(errorCode(() => validatePrefix(prefix))).toBe('INVALID_PREFIX');
  });
});

describe('key and CDN URL inputs', () => {
  it('accepts either a key or its exact public CDN URL', () => {
    expect(keyFromInput({ key: '/assets/a.webp' })).toBe('/assets/a.webp');
    expect(keyFromInput({ cdn_url: 'https://cdn.phunghakorea.com/assets/a.webp' })).toBe('/assets/a.webp');
  });
  it.each([
    'http://cdn.phunghakorea.com/assets/a.webp',
    'https://evil.example/assets/a.webp',
    'https://cdn.phunghakorea.com.evil.example/assets/a.webp',
    'https://cdn.phunghakorea.com@evil.example/assets/a.webp',
    'https://user@cdn.phunghakorea.com/assets/a.webp',
    'https://cdn.phunghakorea.com:444/assets/a.webp',
    'https://cdn.phunghakorea.com:443/assets/a.webp',
    'https://CDN.phunghakorea.com/assets/a.webp',
    'https://cdn.phunghakorea.com/assets/x/../a.webp',
    'https://cdn.phunghakorea.com/assets/%2e%2e/assets/a.webp',
    'https://cdn.phunghakorea.com/assets/%252e%252e/a.webp',
    'https://cdn.phunghakorea.com/assets/a.webp?token=hidden',
    'https://cdn.phunghakorea.com/assets/a.webp#fragment',
    ' https://cdn.phunghakorea.com/assets/a.webp',
    'https://cdn.phunghakorea.com/assets\\a.webp',
  ])('rejects cross-origin, encoded or normalized URL %s', cdn_url => {
    expect(() => keyFromInput({ cdn_url })).toThrow(MediaError);
  });
  it('requires exactly one locator', () => {
    expect(errorCode(() => keyFromInput({}))).toBe('INVALID_INPUT');
    expect(errorCode(() => keyFromInput({ key: '/assets/a.webp', cdn_url: 'https://cdn.phunghakorea.com/assets/a.webp' }))).toBe('INVALID_INPUT');
  });
});

describe('actual image MIME and container checks', () => {
  it.each([
    ['image/png', png], ['image/jpeg', jpeg], ['image/webp', webp], ['image/avif', avif],
  ] as const)('identifies %s without a file extension', (mime, fixture) => {
    expect(detectImageMime(fixture())).toBe(mime);
    expect(validateImage(fixture(), mime)).toBe(mime);
  });
  it('supports structurally valid animated WebP', () => {
    expect(validateImage(animatedWebp(), 'image/webp')).toBe('image/webp');
  });
  it('rejects mismatched declared MIME and unsupported MIME values', () => {
    expect(errorCode(() => validateImage(png(), 'image/webp'))).toBe('MIME_MISMATCH');
    for (const type of ['image/svg+xml', 'text/html', 'application/octet-stream', 'image/png; charset=utf-8']) {
      expect(errorCode(() => validateImage(png(), type))).toBe('UNSUPPORTED_MIME');
    }
  });
  it('rejects SVG, HTML and signatures without valid image containers', () => {
    for (const bytes of [text('<svg xmlns="http://www.w3.org/2000/svg"/>'), text('<html>not an image</html>'), text('RIFF0000WEBP'), new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), new Uint8Array()]) {
      expect(() => validateImage(bytes, 'image/png')).toThrow(MediaError);
    }
  });
  it.each([png, jpeg, webp, avif])('rejects truncation and trailing garbage', fixture => {
    const valid = fixture();
    expect(() => detectImageMime(valid.subarray(0, valid.length - 1))).toThrow(MediaError);
    expect(() => detectImageMime(concat(valid, text('<script>')))).toThrow(MediaError);
  });
  it('rejects corrupt PNG CRC and invalid dimensions', () => {
    const corrupt = png();
    corrupt[29] ^= 1;
    expect(errorCode(() => detectImageMime(corrupt))).toBe('INVALID_IMAGE');
    const header = new Uint8Array(13);
    header[8] = 8;
    header[9] = 2;
    const invalid = concat(png().subarray(0, 8), pngChunk('IHDR', header), png().subarray(33));
    expect(errorCode(() => detectImageMime(invalid))).toBe('INVALID_IMAGE');
  });
  it('rejects RIFF length mismatch and WebP without coded image data', () => {
    const invalid = webp();
    invalid[4] ^= 2;
    expect(errorCode(() => detectImageMime(invalid))).toBe('INVALID_IMAGE');
    expect(errorCode(() => detectImageMime(webpChunks(riffChunk('VP8X', new Uint8Array(10)))))).toBe('INVALID_IMAGE');
  });
  it('rejects generic HEIF/MP4 brands and AVIF headers without media data', () => {
    const generic = avif();
    generic.set(text('heic'), 8);
    generic.set(text('mif1'), 20);
    expect(errorCode(() => detectImageMime(generic))).toBe('INVALID_IMAGE');
    const justType = box('ftyp', concat(text('avif'), number32(0)));
    expect(errorCode(() => detectImageMime(justType))).toBe('INVALID_IMAGE');
  });
  it('enforces size before parsing and accepts the exact configured limit', () => {
    const image = png();
    expect(validateImage(image, 'image/png', image.length)).toBe('image/png');
    expect(errorCode(() => validateImage(image, 'image/png', image.length - 1))).toBe('IMAGE_TOO_LARGE');
    expect(errorCode(() => validateImage(new Uint8Array(DEFAULT_MAX_BYTES + 1), 'image/png'))).toBe('IMAGE_TOO_LARGE');
  });
});

describe('strict base64 decoding', () => {
  it('decodes a generated payload without altering its bytes', () => {
    const bytes = png();
    expect(decodeBase64(encode(bytes))).toEqual(bytes);
  });
  it.each(['', 'abc', 'A===', '====', 'AA A', 'AA\nA', 'AA-_', 'AB==', 'AAF=', 'data:image/png;base64,AA=='])('rejects malformed or noncanonical base64 %s', value => {
    expect(errorCode(() => decodeBase64(value))).toBe('INVALID_BASE64');
  });
  it('enforces exact decoded byte size including padding', () => {
    const one = new Uint8Array(1);
    const two = new Uint8Array(2);
    expect(decodeBase64(encode(one), 1)).toEqual(one);
    expect(errorCode(() => decodeBase64(encode(two), 1))).toBe('IMAGE_TOO_LARGE');
    expect(errorCode(() => decodeBase64('A'.repeat(4 * Math.ceil(DEFAULT_MAX_BYTES / 3) + 4)))).toBe('IMAGE_TOO_LARGE');
  });
  it('rejects invalid limit configuration', () => {
    for (const limit of [0, -1, Infinity, NaN, 1.5]) {
      expect(errorCode(() => decodeBase64(encode(new Uint8Array(1)), limit))).toBe('INVALID_LIMIT');
    }
  });
});

describe('safe ETag and cache policy', () => {
  it('derives a stable strong ETag and preserves caller entity tags', () => {
    const hash = 'a'.repeat(64);
    expect(normalizeEtag(undefined, hash)).toBe(`"${hash}"`);
    expect(normalizeEtag('release-v2')).toBe('"release-v2"');
    expect(normalizeEtag('"release-v2"')).toBe('"release-v2"');
    expect(normalizeEtag('W/"release-v2"')).toBe('W/"release-v2"');
  });
  it.each(['', 'a\r\nSet-Cookie: x', 'a\\b', 'a"b', 'W/unquoted', 'a'.repeat(129)])('rejects unsafe ETag %s', etag => {
    expect(errorCode(() => normalizeEtag(etag))).toBe('INVALID_ETAG');
  });
  it('rejects an invalid hash when deriving an ETag', () => {
    expect(errorCode(() => normalizeEtag())).toBe('INVALID_ETAG');
    expect(errorCode(() => normalizeEtag(undefined, 'invalid'))).toBe('INVALID_ETAG');
  });
  it('normalizes a safe cache-control policy', () => {
    expect(validateCacheControl()).toBe('public, max-age=31536000, immutable');
    expect(validateCacheControl('PUBLIC, max-age = 3600, stale-while-revalidate=60')).toBe('public, max-age=3600, stale-while-revalidate=60');
    expect(validateCacheControl('no-store')).toBe('no-store');
  });
  it.each(['', 'public\r\nX-Injected: true', 'public, private', 'max-age=-1', 'max-age=31536001', 'max-age=1, max-age=2', 'public,', 'unknown=1', 'private="Authorization"'])('rejects unsafe cache policy %s', policy => {
    expect(errorCode(() => validateCacheControl(policy))).toBe('INVALID_CACHE_CONTROL');
  });
  it('does not echo private input in errors', () => {
    const secret = 'secret-token-do-not-echo';
    try { keyFromInput({ cdn_url: `https://evil.example/assets/a.webp?token=${secret}` }); }
    catch (error) { expect((error as Error).message).not.toContain(secret); }
  });
});
