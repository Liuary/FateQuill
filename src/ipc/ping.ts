import { invoke } from "@tauri-apps/api/core";

/** 调用 Rust 侧 ping 命令，返回 "pong" */
export async function ping(): Promise<string> {
  return invoke<string>("ping");
}
