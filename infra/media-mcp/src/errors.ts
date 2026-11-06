import { MediaError } from "./validation";
import type { RpcResult } from "./types";

export function safeError(error: unknown): {code: string; message: string} {
  return error instanceof MediaError
    ? {code: error.code, message: error.message}
    : {code: "SERVICE_UNAVAILABLE", message: "The media service is temporarily unavailable. Retry the same request."};
}

export async function rpcResult<T>(operation: () => Promise<T>): Promise<RpcResult<T>> {
  try { return {ok: true, value: await operation()}; } catch (error) { return {ok: false, error: safeError(error)}; }
}

export function unwrap<T>(result: RpcResult<T>): T {
  if (!result.ok) throw new MediaError(result.error.code, result.error.message);
  return result.value;
}
