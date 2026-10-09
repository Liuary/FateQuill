#!/usr/bin/env node
/**
 * 版本号一致性校验（stage-12 T5）
 *
 * 断言 `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 三处版本**完全一致**；
 * 不一致 → 打印差异并以退出码 1 结束（供 CI / Release workflow 前置校验）。
 *
 * 用法：`node scripts/check-version.mjs`（或 `pnpm version:check`）
 */

import { readVersions } from "./sync-version.mjs";

const versions = readVersions();
const unique = new Set(versions.map((entry) => entry.version));

for (const entry of versions) {
  console.log(`${entry.path}: ${entry.version ?? "（缺失）"}`);
}

if (unique.size !== 1 || unique.has(null)) {
  console.error("✖ 版本号三处不一致（或缺失）——请运行 `pnpm version:sync` 同步");
  process.exit(1);
}

console.log(`✔ 版本号三处一致：${[...unique][0]}`);
