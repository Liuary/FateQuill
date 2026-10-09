import { invokeCommand } from "@/ipc/client";

/** 写入/更新密钥（Rust → OS 密钥链；Key 永不回传前端） */
export async function keyringSet(provider: string, label: string, key: string): Promise<void> {
  await invokeCommand<void>("keyring_set", { provider, label, key });
}

/** 删除密钥 */
export async function keyringDelete(provider: string, label: string): Promise<void> {
  await invokeCommand<void>("keyring_delete", { provider, label });
}

/** 查询密钥是否存在（不返回 Key 本身） */
export async function keyringExists(provider: string, label: string): Promise<boolean> {
  return invokeCommand<boolean>("keyring_exists", { provider, label });
}
