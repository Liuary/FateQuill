# 依赖许可清单（`docs/dependency-licenses.md`）

> 生成方式：`pnpm licenses:gen`（工具化，**勿手改**）｜生成日期：2026-10-10｜项目发布许可：**MIT**
> 工具：`license-checker`（npm，**devDependency，不入 runtime bundle**）+ `cargo license`（Rust，未装则跳过并标注）

## 一、判定口径

- **MIT 兼容白名单**：`MIT`、`MIT*`、`ISC`、`Apache-2.0`、`Apache-2.0 WITH LLVM-exception`、`BSD-2-Clause`、`BSD-3-Clause`、`0BSD`、`Unlicense`、`CC0-1.0`、`BlueOak-1.0.0`、`Zlib`、`Python-2.0`、`WTFPL`（宽松许可，可随 MIT 项目分发）；
- **例外**：白名单外一律进入下方「例外清单」，须**逐条登记理由**（弱 copyleft 需人工确认；强 copyleft 不可分发）。

## 二、npm 运行时依赖（共 21 项；`dependencies`，随包分发）

| 包 | 版本 | 许可 | MIT 兼容 |
| -- | ---- | ---- | -------- |
| `@dnd-kit/core` | 6.3.1 | MIT | ✅ |
| `@dnd-kit/sortable` | 10.0.0 | MIT | ✅ |
| `@dnd-kit/utilities` | 3.2.2 | MIT | ✅ |
| `@fontsource-variable/geist` | 5.3.0 | OFL-1.1 | ⚠️ 见例外 |
| `@tauri-apps/api` | 2.12.1 | Apache-2.0 OR MIT | ✅ |
| `@tiptap/core` | 3.31.4 | MIT | ✅ |
| `@tiptap/markdown` | 3.31.4 | MIT | ✅ |
| `@tiptap/pm` | 3.31.4 | MIT | ✅ |
| `@tiptap/react` | 3.31.4 | MIT | ✅ |
| `@tiptap/starter-kit` | 3.31.4 | MIT | ✅ |
| `class-variance-authority` | 0.7.1 | Apache-2.0 | ✅ |
| `clsx` | 2.1.1 | MIT | ✅ |
| `i18next` | 26.4.2 | MIT | ✅ |
| `i18next-browser-languagedetector` | 8.2.1 | MIT | ✅ |
| `lucide-react` | 1.53.0 | ISC | ✅ |
| `radix-ui` | 1.7.0 | MIT | ✅ |
| `react` | 19.3.0 | MIT | ✅ |
| `react-dom` | 19.3.0 | MIT | ✅ |
| `react-i18next` | 17.0.16 | MIT | ✅ |
| `tailwind-merge` | 3.7.0 | MIT | ✅ |
| `zustand` | 5.0.15 | MIT | ✅ |

## 三、例外清单（非白名单许可；逐条登记）

| 包 | 版本 | 许可 | 登记理由 |
| -- | ---- | ---- | -------- |
| `@fontsource-variable/geist` | 5.3.0 | OFL-1.1 | SIL Open Font License：**字体许可，允许随应用嵌入/分发**（保留版权声明、不改字体名）——保留登记 |

> devDependencies（构建/测试工具，**不随包分发**）不在本清单核查范围；其中 `license-checker` 为**本清单的生成工具**，
> 属本项目**唯一显式新增的依赖**（仅 dev，见 `package.json`）。

## 四、Rust 依赖（`src-tauri/Cargo.toml`）

```
（**跳过**：`cargo license` 未安装或执行失败 —— Error: Command failed: cargo license --tsv）
```

> `cargo license` 未安装时本节仅有跳过标注：可运行 `cargo install cargo-license` 后重跑 `pnpm licenses:gen` 回填。

## 五、结论

- **判定**：存在 **1** 项例外（均已登记理由），须人工复核后方可发布。
