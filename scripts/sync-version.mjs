#!/usr/bin/env node
/**
 * 版本号三处同步（stage-12 T5）
 *
 * 将 `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 的 `version`
 * 统一写为目标版本（入参或默认 `0.6.0`）。**纯 Node、零依赖**。
 *
 * 用法：`node scripts/sync-version.mjs [x.y.z]`（或 `pnpm version:sync`）
 * 校验：`node scripts/check-version.mjs`（三处一致则退出码 0）
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_VERSION = "0.6.0";
export const SEMVER = /^\d+\.\d+\.\d+$/;

/** 三处版本文件（顺序 = 报告顺序） */
export const VERSION_TARGETS = [
  { path: "package.json", pattern: /("version"\s*:\s*")([^"]+)(")/ },
  { path: "src-tauri/tauri.conf.json", pattern: /("version"\s*:\s*")([^"]+)(")/ },
  { path: "src-tauri/Cargo.toml", pattern: /(^version\s*=\s*")([^"]+)(")/m },
];

/** 读取三处当前版本（`[{ path, version }]`） */
export function readVersions(root = ROOT) {
  return VERSION_TARGETS.map(({ path, pattern }) => {
    const content = readFileSync(resolve(root, path), "utf8");
    const matched = content.match(pattern);
    return { path, version: matched ? matched[2] : null };
  });
}

/** 写入三处版本；非法目标版本 → 抛错（不静默） */
export function writeVersions(version, root = ROOT) {
  if (!SEMVER.test(version)) {
    throw new Error(`版本号非法：${version}（应为 x.y.z）`);
  }
  const changes = [];
  for (const { path, pattern } of VERSION_TARGETS) {
    const file = resolve(root, path);
    const content = readFileSync(file, "utf8");
    const matched = content.match(pattern);
    if (!matched) {
      throw new Error(`未找到版本字段：${path}`);
    }
    if (matched[2] === version) {
      changes.push({ path, from: matched[2], to: version, changed: false });
      continue;
    }
    writeFileSync(file, content.replace(pattern, `$1${version}$3`), "utf8");
    changes.push({ path, from: matched[2], to: version, changed: true });
  }
  return changes;
}

// 直接执行（非 import）时才写入
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const target = process.argv[2] ?? DEFAULT_VERSION;
  const changes = writeVersions(target);
  for (const change of changes) {
    console.log(
      `${change.changed ? "更新" : "已是"} ${change.path}: ${change.from} → ${change.to}`,
    );
  }
  console.log(`✔ 版本号三处同步完成：${target}`);
}
