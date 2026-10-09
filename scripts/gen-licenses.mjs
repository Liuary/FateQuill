#!/usr/bin/env node
/**
 * 依赖许可清单生成（stage-12 T5，**工具化**）
 *
 * - **npm（运行时依赖，随包分发）**：`license-checker`（devDependency，**不入 runtime bundle**）
 * - **Rust**：`cargo license`（未安装则**跳过并显式标注**，附手动登记指引）
 * - 输出：`docs/dependency-licenses.md`（清单 + **MIT 兼容白名单判定** + **例外清单**）
 *
 * 用法：`pnpm licenses:gen`
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ROOT } from "./sync-version.mjs";

/** MIT 兼容白名单（宽松许可）：命中即视为兼容；其余进入**例外清单**（需显式登记） */
const PERMISSIVE = new Set([
  "MIT",
  "MIT*",
  "ISC",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
  "BlueOak-1.0.0",
  "Zlib",
  "Python-2.0",
  "WTFPL",
]);

/** 已知非宽松 / 需人工确认的许可（显式登记理由） */
const KNOWN_EXCEPTIONS = new Map([
  ["MPL-2.0", "弱 copyleft（文件级），仅作依赖使用、未修改源码，判定可用；保留登记待法务复核"],
  ["LGPL-3.0", "弱 copyleft：仅动态链接式使用方可，**须人工确认**"],
  ["GPL-3.0", "强 copyleft：**与 MIT 发布不兼容**，须替换依赖"],
  [
    "OFL-1.1",
    "SIL Open Font License：**字体许可，允许随应用嵌入/分发**（保留版权声明、不改字体名）——保留登记",
  ],
  ["UNKNOWN", "许可未识别：须人工核实来源与许可"],
  ["UNLICENSED", "未声明许可：默认保留全部权利，须人工核实"],
]);

/** 是否 MIT 兼容：支持 SPDX `OR` 表达式（任一分支宽松即兼容，如 `Apache-2.0 OR MIT`） */
function isPermissive(license) {
  return license
    .split(/\s+OR\s+/i)
    .map((part) => part.trim())
    .some((part) => PERMISSIVE.has(part));
}

function npmLicenses() {
  const require = createRequire(import.meta.url);
  const checker = require("license-checker");
  return new Promise((resolvePromise, reject) => {
    checker.init(
      { start: ROOT, production: true, excludePrivatePackages: true, json: true },
      (error, packages) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise(packages);
      },
    );
  });
}

function rustLicenses() {
  try {
    return execFileSync("cargo", ["license", "--tsv"], { cwd: resolve(ROOT, "src-tauri") })
      .toString()
      .trim();
  } catch (error) {
    return `（**跳过**：\`cargo license\` 未安装或执行失败 —— ${String(error).split("\n")[0]}）`;
  }
}

const packages = await npmLicenses();
const rows = Object.entries(packages).map(([nameVersion, info]) => {
  const at = nameVersion.lastIndexOf("@");
  const name = nameVersion.slice(0, at);
  const version = nameVersion.slice(at + 1);
  const license = String(info.licenses ?? "UNKNOWN");
  return { name, version, license };
});
rows.sort((a, b) => a.name.localeCompare(b.name));

const exceptions = rows.filter((row) => !isPermissive(row.license));
const unknownExceptions = exceptions.filter((row) => !KNOWN_EXCEPTIONS.has(row.license));

const rust = rustLicenses();
const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const lines = [
  "# 依赖许可清单（`docs/dependency-licenses.md`）",
  "",
  `> 生成方式：\`pnpm licenses:gen\`（工具化，**勿手改**）｜生成日期：${stamp}｜项目发布许可：**MIT**`,
  "> 工具：`license-checker`（npm，**devDependency，不入 runtime bundle**）+ `cargo license`（Rust，未装则跳过并标注）",
  "",
  "## 一、判定口径",
  "",
  "- **MIT 兼容白名单**：" +
    [...PERMISSIVE].map((item) => `\`${item}\``).join("、") +
    "（宽松许可，可随 MIT 项目分发）；",
  "- **例外**：白名单外一律进入下方「例外清单」，须**逐条登记理由**（弱 copyleft 需人工确认；强 copyleft 不可分发）。",
  "",
  `## 二、npm 运行时依赖（共 ${rows.length} 项；\`dependencies\`，随包分发）`,
  "",
  "| 包 | 版本 | 许可 | MIT 兼容 |",
  "| -- | ---- | ---- | -------- |",
  ...rows.map(
    (row) =>
      `| \`${row.name}\` | ${row.version} | ${row.license} | ${isPermissive(row.license) ? "✅" : "⚠️ 见例外"} |`,
  ),
  "",
  "## 三、例外清单（非白名单许可；逐条登记）",
  "",
];

if (exceptions.length === 0) {
  lines.push("**无例外**：全部运行时依赖均命中 MIT 兼容白名单。", "");
} else {
  lines.push("| 包 | 版本 | 许可 | 登记理由 |", "| -- | ---- | ---- | -------- |");
  for (const row of exceptions) {
    const reason = KNOWN_EXCEPTIONS.get(row.license) ?? "未登记：**须人工核实**";
    lines.push(`| \`${row.name}\` | ${row.version} | ${row.license} | ${reason} |`);
  }
  lines.push("");
}

lines.push(
  "> devDependencies（构建/测试工具，**不随包分发**）不在本清单核查范围；其中 `license-checker` 为**本清单的生成工具**，",
  "> 属本项目**唯一显式新增的依赖**（仅 dev，见 `package.json`）。",
  "",
  "## 四、Rust 依赖（`src-tauri/Cargo.toml`）",
  "",
  "```",
  rust,
  "```",
  "",
  "> `cargo license` 未安装时本节仅有跳过标注：可运行 `cargo install cargo-license` 后重跑 `pnpm licenses:gen` 回填。",
  "",
  "## 五、结论",
  "",
  exceptions.length === 0
    ? "- **判定**：npm 运行时依赖**全部 MIT 兼容**，可随 MIT 项目分发（Rust 侧见上节）。"
    : `- **判定**：存在 **${exceptions.length}** 项例外${unknownExceptions.length > 0 ? `（其中 **${unknownExceptions.length}** 项未登记，须人工核实）` : "（均已登记理由）"}，须人工复核后方可发布。`,
  "",
);

writeFileSync(resolve(ROOT, "docs/dependency-licenses.md"), lines.join("\n"), "utf8");
console.log(
  `✔ 已生成 docs/dependency-licenses.md（npm 运行时依赖 ${rows.length} 项；例外 ${exceptions.length} 项，未登记 ${unknownExceptions.length} 项）`,
);
