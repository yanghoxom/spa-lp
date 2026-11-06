import { z } from "zod";

const key = z.string().min(9).max(512).describe("Canonical versioned path under /assets/, for example /assets/serum-v2-960.webp.");
const mime = z.enum(["image/webp", "image/jpeg", "image/png", "image/avif"]);
const hash = z.string().regex(/^[a-f0-9]{64}$/);

export const openAIFile = z.object({
  download_url: z.string().max(16_384),
  file_id: z.string().min(1).max(1024),
  mime_type: z.string().max(128).optional(),
  file_name: z.string().max(512).optional(),
}).strict();

export const uploadInput = z.object({
  key,
  file: openAIFile.optional().describe("ChatGPT file reference. The host of download_url must be on the operator's exact allowlist."),
  base64: z.string().max(13_333_336).optional().describe("Plain canonical base64 supplied programmatically; do not put images into GitHub or invent this value."),
  content_type: mime,
  etag: z.string().max(140).optional(),
  cache_control: z.string().max(256).optional(),
}).strict();

export const uploadOutput = z.object({key, cdn_url: z.string(), content_type: mime,
  byte_size: z.number().int().positive(), sha256: hash, etag: z.string(), uploaded_at: z.string()});

export const locatorInput = z.object({key: key.optional(), cdn_url: z.string().max(1024).optional()}).strict();
export const keyInput = z.object({key}).strict();
export const metadataShape = {
  key, cdn_url: z.string(), content_type: mime.nullable(), byte_size: z.number().int().nonnegative().nullable(),
  sha256: hash.nullable(), etag: z.string().nullable(), uploaded_at: z.string().nullable(),
};
export const metadataOutput = z.object({exists: z.boolean(), ...metadataShape});
export const listInput = z.object({prefix: z.string().max(512).default("/assets/"),
  limit: z.number().int().min(1).max(100).default(25), cursor: z.string().max(2048).optional()}).strict();
export const listOutput = z.object({items: z.array(z.object(metadataShape)), prefix: z.string(),
  limit: z.number().int(), list_complete: z.boolean(), cursor: z.string().nullable()});
export const verifyOutput = z.object({exists: z.boolean(), publicly_available: z.boolean(), cdn_url: z.string(),
  content_type: z.string().nullable(), byte_size: z.number().nullable(), sha256: hash.nullable(), etag: z.string().nullable(),
  integrity_ok: z.boolean(), mismatches: z.array(z.string()), cdn: z.object({
    head_status: z.number().nullable(), get_status: z.number().nullable(), content_type: z.string().nullable(),
    byte_size: z.number().nullable(), sha256: hash.nullable(), etag: z.string().nullable(),
  })});
export const deleteInput = z.object({key, confirmation_token: z.string().uuid().optional()
  .describe("Returned by the first delete_media call. It works only after the owner approves the browser page.")}).strict();
export const deleteOutput = z.object({key, cdn_url: z.string(), status: z.enum(["confirmation_required", "approved", "deleted", "not_found"]),
  deleted: z.boolean(), confirmation_token: z.string().nullable(), approval_url: z.string().nullable(),
  expected_sha256: hash.nullable(), expires_at: z.string().nullable(), cdn_cache_may_remain: z.boolean()});

export const toolSchemas = {
  upload_media: {input: uploadInput, output: uploadOutput},
  verify_media: {input: locatorInput, output: verifyOutput},
  get_media_metadata: {input: keyInput, output: metadataOutput},
  list_media: {input: listInput, output: listOutput},
  delete_media: {input: deleteInput, output: deleteOutput},
};
