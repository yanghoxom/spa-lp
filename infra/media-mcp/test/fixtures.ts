import { deflateSync } from "node:zlib";

// Construct small real PNGs in memory. The repository contains neither image
// binaries nor encoded image payloads; tests derive scanlines, CRCs and DEFLATE.
function join(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.byteLength; }
  return result;
}

function bigEndian(value: number): Uint8Array {
  const result = new Uint8Array(4);
  new DataView(result.buffer).setUint32(0, value);
  return result;
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const bytes = join(new TextEncoder().encode(type), payload);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return join(bigEndian(payload.byteLength), bytes, bigEndian((crc ^ 0xffffffff) >>> 0));
}

export function pngFixture(red = 0, description?: string): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 1);
  view.setUint32(4, 1);
  header[8] = 8;
  header[9] = 2;
  const scanline = new Uint8Array(4);
  scanline[1] = red;
  const signature = join(new Uint8Array([137]), new TextEncoder().encode("PNG"), new Uint8Array([13, 10, 26, 10]));
  const annotation = description === undefined ? new Uint8Array() : chunk("tEXt", new TextEncoder().encode(`Description\0${description}`));
  return join(signature, chunk("IHDR", header), annotation, chunk("IDAT", deflateSync(scanline)), chunk("IEND", new Uint8Array()));
}
