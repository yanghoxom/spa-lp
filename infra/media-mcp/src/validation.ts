/** Input validation shared by all media tools. Never include payloads in errors. */
export class MediaError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'MediaError';
  }
}

export const IMAGE_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
export const DEFAULT_MAX_BYTES = 10_000_000;
const MAX_KEY_BYTES = 512;
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function invalid(code: string, message: string): never {
  throw new MediaError(code, message);
}

function validatePath(value: string, prefix: boolean): string {
  const code = prefix ? 'INVALID_PREFIX' : 'INVALID_KEY';
  // Deliberately use a canonical ASCII alphabet. Rejecting '%' prevents both
  // encoded and multiply encoded traversal and avoids URL/KV decoding ambiguity.
  if (typeof value !== 'string' || !value.startsWith('/assets/') ||
      value.length > MAX_KEY_BYTES || !/^\/assets\/[A-Za-z0-9._/-]*$/.test(value)) {
    return invalid(code, 'Use a canonical path inside /assets/ with ASCII letters, digits, dots, hyphens and underscores; maximum 512 bytes.');
  }
  const rest = value.slice('/assets/'.length);
  if (!prefix && (!rest || rest.endsWith('/'))) {
    return invalid(code, 'A media key must name one file inside /assets/.');
  }
  const segments = rest.split('/');
  if (prefix && segments.at(-1) === '') segments.pop();
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..')) {
    return invalid(code, 'Empty path segments and dot traversal segments are not allowed.');
  }
  return value;
}

export function validateKey(key: string): string {
  return validatePath(key, false);
}

export function validatePrefix(prefix: string): string {
  return validatePath(prefix, true);
}

export function keyFromInput(
  input: { key?: string; cdn_url?: string },
  cdnBase = 'https://cdn.phunghakorea.com',
): string {
  if ((input.key !== undefined) === (input.cdn_url !== undefined)) {
    return invalid('INVALID_INPUT', 'Provide exactly one of key or cdn_url.');
  }
  if (input.key !== undefined) return validateKey(input.key);
  let base: URL;
  let url: URL;
  try {
    base = new URL(cdnBase);
    url = new URL(input.cdn_url!);
  } catch {
    return invalid('INVALID_CDN_URL', 'Provide a canonical HTTPS URL on the configured CDN.');
  }
  if (base.protocol !== 'https:' || base.username || base.password ||
      base.pathname !== '/' || base.search || base.hash ||
      url.protocol !== 'https:' || url.origin !== base.origin ||
      url.username || url.password || url.search || url.hash) {
    return invalid('INVALID_CDN_URL', 'Provide a canonical HTTPS URL on the configured CDN.');
  }
  const key = validateKey(url.pathname);
  // URL parsing silently normalizes dot segments, backslashes, whitespace,
  // default ports and host casing. Compare the original spelling as well.
  if (input.cdn_url !== `${base.origin}${key}`) {
    return invalid('INVALID_CDN_URL', 'CDN URLs must use their exact canonical spelling without encoded or normalized segments.');
  }
  return key;
}

function checkLimit(maxBytes: number): void {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    invalid('INVALID_LIMIT', 'The image byte limit must be a positive integer.');
  }
}

export function decodeBase64(value: string, maxBytes = DEFAULT_MAX_BYTES): Uint8Array {
  checkLimit(maxBytes);
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0) {
    return invalid('INVALID_BASE64', 'Provide nonempty canonical base64 without a data URL or whitespace.');
  }
  if (value.length > 4 * Math.ceil(maxBytes / 3)) {
    return invalid('IMAGE_TOO_LARGE', 'The image exceeds the configured byte limit.');
  }
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const byteLength = (value.length / 4) * 3 - padding;
  if (byteLength > maxBytes) return invalid('IMAGE_TOO_LARGE', 'The image exceeds the configured byte limit.');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < value.length - padding; i++) {
    const char = value.charCodeAt(i);
    if (!((char >= 65 && char <= 90) || (char >= 97 && char <= 122) ||
          (char >= 48 && char <= 57) || char === 43 || char === 47)) {
      return invalid('INVALID_BASE64', 'Provide canonical base64 without a data URL or whitespace.');
    }
  }
  const last = alphabet.indexOf(value[value.length - padding - 1]!);
  if ((padding === 2 && (last & 15) !== 0) || (padding === 1 && (last & 3) !== 0)) {
    return invalid('INVALID_BASE64', 'Base64 padding bits must be zero.');
  }
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return invalid('INVALID_BASE64', 'The base64 payload could not be decoded.');
  }
}

function ascii(bytes: Uint8Array, offset: number, count: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + count));
}

function u32(bytes: Uint8Array, offset: number, littleEndian = false): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, littleEndian);
}

function u16(bytes: Uint8Array, offset: number, littleEndian = false): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, littleEndian);
}

function badImage(): never {
  return invalid('INVALID_IMAGE', 'The image signature or container is invalid or truncated.');
}

// PNG CRC-32 is validated without decoding pixels or inflating compressed data.
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function checkPng(bytes: Uint8Array): void {
  let offset = 8;
  let sawHeader = false;
  let sawData = false;
  let dataEnded = false;
  let indexed = false;
  let sawPalette = false;
  while (offset + 12 <= bytes.length) {
    const length = u32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const data = offset + 8;
    const end = data + length;
    if (length > 0x7fffffff || end + 4 > bytes.length || !/^[A-Za-z]{4}$/.test(type) ||
        crc32(bytes, offset + 4, end) !== u32(bytes, end)) badImage();
    if (!sawHeader) {
      if (type !== 'IHDR' || length !== 13 || u32(bytes, data) === 0 || u32(bytes, data + 4) === 0 ||
          u32(bytes, data) > 0x7fffffff || u32(bytes, data + 4) > 0x7fffffff) badImage();
      const bitDepth = bytes[data + 8]!;
      const color = bytes[data + 9]!;
      const validDepths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (!validDepths[color]?.includes(bitDepth) || bytes[data + 10] !== 0 ||
          bytes[data + 11] !== 0 || bytes[data + 12]! > 1) badImage();
      sawHeader = true;
      indexed = color === 3;
    } else if (type === 'IHDR') {
      badImage();
    } else if (type === 'PLTE') {
      if (sawData || sawPalette || length === 0 || length > 768 || length % 3 !== 0) badImage();
      sawPalette = true;
    } else if (type === 'IDAT') {
      if (dataEnded || (indexed && !sawPalette)) badImage();
      if (length > 0) sawData = true;
    } else if (type === 'IEND') {
      if (!sawData || length !== 0 || end + 4 !== bytes.length) badImage();
      return;
    } else {
      // Unknown critical chunks change image interpretation; ancillary chunks
      // (including APNG and metadata) are allowed when structurally valid.
      if (type[0] === type[0]!.toUpperCase()) badImage();
      if (sawData) dataEnded = true;
    }
    offset = end + 4;
  }
  badImage();
}

function checkJpeg(bytes: Uint8Array): void {
  let offset = 2;
  let sawFrame = false;
  let sawScan = false;
  let sawEntropy = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) badImage();
    while (offset < bytes.length && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.length) badImage();
    const marker = bytes[offset++]!;
    if (marker === 0xd9) {
      if (!sawFrame || !sawScan || !sawEntropy || offset !== bytes.length) badImage();
      return;
    }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) badImage();
    if (marker === 0x01) continue; // TEM has no length field.
    if (offset + 2 > bytes.length) badImage();
    const length = u16(bytes, offset);
    if (length < 2 || offset + length > bytes.length) badImage();
    const data = offset + 2;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame) {
      if (length < 8 || u16(bytes, data + 1) === 0 || u16(bytes, data + 3) === 0 ||
          bytes[data + 5] === 0 || length !== 8 + 3 * bytes[data + 5]!) badImage();
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame || length < 6 || bytes[data] === 0 || length !== 6 + 2 * bytes[data]!) badImage();
      sawScan = true;
    }
    offset += length;
    if (marker === 0xda) {
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { sawEntropy = true; offset++; continue; }
        let markerOffset = offset + 1;
        while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset++;
        if (markerOffset >= bytes.length) badImage();
        const next = bytes[markerOffset]!;
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          if (next === 0x00) sawEntropy = true;
          offset = markerOffset + 1;
        } else {
          break; // Continue parsing markers, including progressive JPEG scans.
        }
      }
    }
  }
  badImage();
}

function checkWebpImage(bytes: Uint8Array, type: string, data: number, length: number): void {
  if (type === 'VP8 ') {
    if (length <= 10 || (bytes[data]! & 1) !== 0 || ascii(bytes, data + 3, 3) !== '\x9d\x01\x2a' ||
        (u16(bytes, data + 6, true) & 0x3fff) === 0 || (u16(bytes, data + 8, true) & 0x3fff) === 0) badImage();
  } else if (length <= 5 || bytes[data] !== 0x2f || (bytes[data + 4]! & 0xe0) !== 0) {
    badImage();
  }
}

function checkWebp(bytes: Uint8Array): void {
  if (bytes.length < 26 || u32(bytes, 4, true) !== bytes.length - 8) badImage();
  let offset = 12;
  let imageCount = 0;
  let frameCount = 0;
  let extended = false;
  let animated = false;
  let animationHeader = false;
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4);
    const length = u32(bytes, offset + 4, true);
    const data = offset + 8;
    const end = data + length;
    const paddedEnd = end + (length & 1);
    if (paddedEnd > bytes.length || ((length & 1) && bytes[end] !== 0)) badImage();
    if (type === 'VP8X') {
      if (offset !== 12 || length !== 10 || (bytes[data]! & 0xc1) !== 0 ||
          bytes[data + 1] !== 0 || bytes[data + 2] !== 0 || bytes[data + 3] !== 0) badImage();
      extended = true;
      animated = (bytes[data]! & 0x02) !== 0;
    } else if (type === 'VP8 ' || type === 'VP8L') {
      checkWebpImage(bytes, type, data, length);
      imageCount++;
    } else if (type === 'ANIM') {
      if (!animated || animationHeader || length !== 6 || frameCount > 0) badImage();
      animationHeader = true;
    } else if (type === 'ANMF') {
      if (!animationHeader || length < 24 || (bytes[data + 15]! & 0xfc) !== 0) badImage();
      let inner = data + 16;
      let frames = 0;
      while (inner + 8 <= end) {
        const innerType = ascii(bytes, inner, 4);
        const innerLength = u32(bytes, inner + 4, true);
        const innerData = inner + 8;
        const innerEnd = innerData + innerLength;
        if (innerEnd + (innerLength & 1) > end || ((innerLength & 1) && bytes[innerEnd] !== 0)) badImage();
        if (innerType === 'VP8 ' || innerType === 'VP8L') {
          checkWebpImage(bytes, innerType, innerData, innerLength);
          frames++;
        }
        inner = innerEnd + (innerLength & 1);
      }
      if (inner !== end || frames !== 1) badImage();
      frameCount++;
    } else if (!extended) {
      badImage();
    }
    offset = paddedEnd;
  }
  if (offset !== bytes.length || (animated ? (frameCount === 0 || imageCount !== 0) : (imageCount !== 1 || frameCount !== 0))) badImage();
}

type Box = { type: string; data: number; end: number };

function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;
  while (offset < end) {
    if (offset + 8 > end) badImage();
    let length = u32(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    let header = 8;
    if (length === 1) {
      if (offset + 16 > end) badImage();
      const high = u32(bytes, offset + 8);
      // Accepted images are far smaller than 4 GiB. Reject oversized 64-bit boxes.
      if (high !== 0) badImage();
      length = u32(bytes, offset + 12);
      header = 16;
    } else if (length === 0) {
      length = end - offset;
    }
    if (length < header || offset + length > end || !/^[\x20-\x7e]{4}$/.test(type)) badImage();
    boxes.push({ type, data: offset + header, end: offset + length });
    if (boxes.length > 4096) badImage();
    offset += length;
  }
  return boxes;
}

function checkAvif(bytes: Uint8Array): void {
  const boxes = readBoxes(bytes, 0, bytes.length);
  const fileType = boxes[0];
  if (!fileType || fileType.type !== 'ftyp' || fileType.end - fileType.data < 8 ||
      (fileType.end - fileType.data) % 4 !== 0 || boxes.filter(b => b.type === 'ftyp').length !== 1) badImage();
  const brands = [ascii(bytes, fileType.data, 4)];
  for (let p = fileType.data + 8; p < fileType.end; p += 4) brands.push(ascii(bytes, p, 4));
  if (!brands.includes('avif') && !brands.includes('avis')) badImage();
  let dataPresent = boxes.some(b => b.type === 'mdat' && b.end > b.data);
  let structurePresent = false;
  for (const box of boxes) {
    if (box.type === 'meta') {
      if (box.end - box.data < 4 || u32(bytes, box.data) !== 0) badImage();
      const children = readBoxes(bytes, box.data + 4, box.end);
      const types = new Set(children.map(child => child.type));
      // Item metadata is required for AVIF still images. Coded pixel payloads
      // are deliberately not decoded by this MIME/container validator.
      if (!['hdlr', 'pitm', 'iloc', 'iinf', 'iprp'].every(type => types.has(type))) badImage();
      dataPresent ||= children.some(b => b.type === 'idat' && b.end > b.data);
      structurePresent = true;
    } else if (box.type === 'moov' && brands.includes('avis')) {
      const children = readBoxes(bytes, box.data, box.end);
      if (!children.some(b => b.type === 'mvhd') || !children.some(b => b.type === 'trak')) badImage();
      structurePresent = true;
    }
  }
  if (!dataPresent || !structurePresent) badImage();
}

/**
 * Detect format from signatures plus bounded container parsing, not extension.
 * This is intentionally not an antivirus, full codec decoder, or pixel check.
 */
export function detectImageMime(bytes: Uint8Array): ImageMime {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) {
    checkPng(bytes);
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    checkJpeg(bytes);
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    checkWebp(bytes);
    return 'image/webp';
  }
  if (bytes.length >= 16 && ascii(bytes, 4, 4) === 'ftyp') {
    checkAvif(bytes);
    return 'image/avif';
  }
  return invalid('UNSUPPORTED_MIME', 'Only valid WebP, JPEG, PNG and AVIF image containers are accepted.');
}

export function validateImage(bytes: Uint8Array, contentType: string, maxBytes = DEFAULT_MAX_BYTES): ImageMime {
  checkLimit(maxBytes);
  if (bytes.byteLength > maxBytes) return invalid('IMAGE_TOO_LARGE', 'The image exceeds the configured byte limit.');
  if (!IMAGE_MIME_TYPES.includes(contentType as ImageMime)) {
    return invalid('UNSUPPORTED_MIME', 'content_type must be image/webp, image/jpeg, image/png or image/avif.');
  }
  const detected = detectImageMime(bytes);
  if (detected !== contentType) return invalid('MIME_MISMATCH', 'content_type does not match the actual image container.');
  return detected;
}

export function normalizeEtag(value?: string, sha256?: string): string {
  if (value === undefined) {
    if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) return invalid('INVALID_ETAG', 'A valid SHA-256 is required to derive the ETag.');
    return `"${sha256}"`;
  }
  if (typeof value !== 'string') return invalid('INVALID_ETAG', 'ETag must be a safe, bounded HTTP entity tag.');
  const weak = value.startsWith('W/');
  let opaque = weak ? value.slice(2) : value;
  if (opaque.startsWith('"') && opaque.endsWith('"')) {
    opaque = opaque.slice(1, -1);
  } else if (weak) {
    return invalid('INVALID_ETAG', 'Weak ETags must contain a quoted entity tag.');
  }
  if (!/^[\x21\x23-\x5b\x5d-\x7e]{1,128}$/.test(opaque)) {
    return invalid('INVALID_ETAG', 'ETag must be a safe, bounded HTTP entity tag.');
  }
  return `${weak ? 'W/' : ''}"${opaque}"`;
}

export function validateCacheControl(value?: string): string {
  if (value === undefined) return DEFAULT_CACHE_CONTROL;
  if (typeof value !== 'string' || value.length === 0 || value.length > 256 || !/^[\x20-\x7e]+$/.test(value)) {
    return invalid('INVALID_CACHE_CONTROL', 'Cache-Control must be a safe, bounded HTTP cache policy.');
  }
  const flags = new Set(['public', 'private', 'no-cache', 'no-store', 'immutable', 'no-transform', 'must-revalidate', 'proxy-revalidate']);
  const timed = new Set(['max-age', 's-maxage', 'stale-while-revalidate', 'stale-if-error']);
  const seen = new Set<string>();
  const directives: string[] = [];
  for (const part of value.split(',')) {
    const match = /^([a-z-]+)(?: *= *(\d+))?$/.exec(part.trim().toLowerCase());
    if (!match) return invalid('INVALID_CACHE_CONTROL', 'Cache-Control contains an unsupported directive.');
    const name = match[1]!;
    const seconds = match[2];
    if (seen.has(name)) return invalid('INVALID_CACHE_CONTROL', 'Duplicate cache directives are not allowed.');
    seen.add(name);
    if (flags.has(name) && seconds === undefined) directives.push(name);
    else if (timed.has(name) && seconds !== undefined && Number.isSafeInteger(Number(seconds)) && Number(seconds) <= 31_536_000) {
      directives.push(`${name}=${Number(seconds)}`);
    } else return invalid('INVALID_CACHE_CONTROL', 'Cache-Control contains an unsupported directive or duration.');
  }
  if (seen.has('public') && seen.has('private')) return invalid('INVALID_CACHE_CONTROL', 'A cache policy cannot be both public and private.');
  return directives.join(', ');
}
