import { invoke } from "@tauri-apps/api/core";
import { parseIpcError } from "./errors";

/** 统一命令调用：失败时抛出归一化的 IpcError */
export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    throw parseIpcError(err);
  }
}
