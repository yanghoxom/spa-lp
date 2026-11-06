import { readBoundedBody } from "./download";
import type { MediaMetadata, MediaRepository } from "./types";

export class KvMediaRepository implements MediaRepository {
  constructor(private kv: KVNamespace, private maxBytes: number) {}

  async metadata(key: string) {
    const item = await this.kv.getWithMetadata(key, {type: "stream"});
    if (item.value) await item.value.cancel();
    return {exists: item.value !== null, metadata: item.metadata};
  }

  async read(key: string) {
    const item = await this.kv.getWithMetadata(key, {type: "stream"});
    return {
      value: item.value === null ? null : await readBoundedBody(new Response(item.value), this.maxBytes),
      metadata: item.metadata,
    };
  }

  async put(key: string, bytes: Uint8Array, metadata: MediaMetadata) {
    await this.kv.put(key, bytes, {metadata});
  }

  async delete(key: string) { await this.kv.delete(key); }

  async list(prefix: string, limit: number, cursor?: string) {
    const page = await this.kv.list({prefix, limit, ...(cursor ? {cursor} : {})});
    return {keys: page.keys, complete: page.list_complete, cursor: page.list_complete ? undefined : page.cursor};
  }
}
