import { DurableObject } from "cloudflare:workers";
import { MediaMutations, configuredMaxBytes } from "./media";
import { KvMediaRepository } from "./repository";
import { rpcResult } from "./errors";
import type { CoordinatorState, UploadOptions } from "./types";

/** One SQLite-backed object per image key. Stores metadata/approval state, never image bytes. */
export class MediaCoordinator extends DurableObject<Env> {
  private operations: MediaMutations;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.operations = new MediaMutations(new KvMediaRepository(env.MEDIA, configuredMaxBytes(env.MAX_IMAGE_BYTES)), {
      get: () => ctx.storage.get<CoordinatorState>("state"),
      set: value => ctx.storage.put("state", value),
    }, env.SERVER_ORIGIN, configuredMaxBytes(env.MAX_IMAGE_BYTES));
  }

  async upload(key: string, bytes: Uint8Array, input: UploadOptions) {
    return rpcResult(() => this.operations.upload(key, bytes, input));
  }

  async deleteMedia(key: string, actor: string, ticket?: string) {
    return rpcResult(() => this.operations.delete(key, actor, ticket));
  }

  async approve(key: string, ticket: string, actor: string, csrf?: string) {
    return rpcResult(() => this.operations.approval(key, ticket, actor, csrf));
  }
}
