export interface MediaMetadata {
  contentType: string;
  etag: string;
  sha256: string;
  byteSize: number;
  uploadedAt: string;
  cacheControl: string;
}

export interface MediaResult {
  key: string;
  cdn_url: string;
  content_type: string;
  byte_size: number;
  sha256: string;
  etag: string;
  uploaded_at: string;
}

export interface UploadOptions {
  content_type: string;
  etag?: string;
  cache_control?: string;
}

export interface OpenAIFile {
  download_url: string;
  file_id: string;
  mime_type?: string;
  file_name?: string;
}

export interface MediaRepository {
  metadata(key: string): Promise<{exists: boolean; metadata: unknown}>;
  read(key: string): Promise<{value: Uint8Array | null; metadata: unknown}>;
  put(key: string, bytes: Uint8Array, metadata: MediaMetadata): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string, limit: number, cursor?: string): Promise<{
    keys: {name: string; metadata?: unknown}[];
    complete: boolean;
    cursor?: string;
  }>;
}

export interface ObjectRecord {
  status: "pending" | "live" | "deleting" | "deleted";
  metadata: MediaMetadata;
}

export interface Approval {
  ticket: string;
  actor: string;
  sha256: string;
  expiresAt: number;
  csrf: string;
  approved: boolean;
}

export interface CoordinatorState {
  key: string;
  object?: ObjectRecord;
  approval?: Approval;
}

export interface StateRepository {
  get(): Promise<CoordinatorState | undefined>;
  set(value: CoordinatorState): Promise<void>;
}

export type DeleteResult = {
  key: string;
  cdn_url: string;
  status: "confirmation_required" | "approved" | "deleted" | "not_found";
  deleted: boolean;
  confirmation_token: string | null;
  approval_url: string | null;
  expected_sha256: string | null;
  expires_at: string | null;
  cdn_cache_may_remain: boolean;
};

export type RpcResult<T> = {ok: true; value: T} | {ok: false; error: {code: string; message: string}};
