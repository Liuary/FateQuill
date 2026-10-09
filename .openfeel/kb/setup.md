# 环境配置

> 记录环境搭建、构建流程、依赖管理。`[+]` 启用 / `[-]` 禁用。

## [+] 环境前置与版本锚定 (2026-10-08)

**Windows 环境硬前置**（执行/构建前须就绪）：

| 依赖 | 说明 | 检测命令 |
|------|------|----------|
| Rust stable | 经 rustup 安装；版本以仓库根 `rust-toolchain.toml` 为准 | `cargo --version` |
| MSVC Build Tools | 勾选「使用 C++ 的桌面开发」工作负载（Rust 链接器必需） | 见 VS Installer |
| WebView2 Runtime | Win10/11 通常内置，否则装 Evergreen Runtime | 见「应用与功能」 |
| Node.js | LTS；实际 Node 24 | `node -v` |
| pnpm | ≥ 9，经 corepack 启用；由 `packageManager` 固定 | `corepack pnpm -v` |

**版本锚定（防工具链漂移三件套）**：
- `packageManager = pnpm@12.10.1`
- `engines.node = ">=22"`（实际 Node 24，CI 固定 24）
- `rust-toolchain.toml` channel = `stable`
- 仓库**仅一份 `pnpm-lock.yaml`**（禁止 npm/yarn lockfile 混入）

**实测基线环境**：Node v24.18.1 / pnpm 12.10.1 / cargo & rustc 1.99.0(stable-msvc) / MSVC(VS Community) / WebView2 154 / git 2.55.0。

## [+] 构建 / 测试 / CI 命令与约定 (2026-10-08)

**常用命令**（PowerShell）：

```powershell
corepack pnpm install       # 安装依赖（CI 用 --frozen-lockfile）
corepack pnpm tauri dev     # 启动桌面应用（阻塞 GUI）
corepack pnpm build         # 前端生产构建（tsc + vite build）
corepack pnpm lint          # ESLint 静态检查（可选 pnpm format:check）
corepack pnpm test          # Vitest 单元测试
cargo test --manifest-path src-tauri/Cargo.toml   # Rust 测试
```

**CI**（`.github/workflows/ci.yml`）：
- runner = `windows-latest`（与开发平台一致，避免 Linux 的 `libwebkit2gtk` 等系统依赖）。
- 范围 = `pnpm lint` + Vitest + `pnpm build`（含 tsc）+ `cargo check` + `cargo test`；**不含 `tauri bundle`**（打包移至 stage-12）。
- 缓存：pnpm（setup-node cache）+ `Swatinem/rust-cache@v2`（workspaces: src-tauri）。

**仓库托管**：https://github.com/Liuary/FateQuill （`git remote origin`，main 分支）。

## [+] 数据存储位置与重置 (2026-10-09)

- 开发库位置：`sqlite:fatequill.db` → Windows `%APPDATA%\com.fatequill.app\fatequill.db`。
- **重置**：关闭应用后删除该 `fatequill.db` 文件，下次启动时插件 `preload` 迁移会重新建库与建表。
- 迁移由 `tauri-plugin-sql` 内置 sqlx migrator 管理（`_sqlx_migrations` 表），天然幂等；测试使用 `sqlite::memory:`，不触达开发库。

## [+] Rust 数据层测试：内存库隔离与迁移幂等 (2026-10-09)

- **隔离**：`cargo test` 一律使用 `sqlite::memory:`（`db::test_util::test_pool/test_pool_migrated` 共享 helper）：`foreign_keys(true)` + `max_connections(1)`，**禁止触达 AppData 开发库**；与运行中的 `tauri dev` 并发前先关闭 dev（否则争抢 `src-tauri/target` 构建锁 / 文件锁）。
- **迁移幂等断言**：`cargo test` 对内存库连续运行迁移两次，断言 `_sqlx_migrations` 计数为 1、5 张业务表齐备、`PRAGMA foreign_keys`=1；测试经 `sqlx::migrate!("./migrations")` 消费与生产**同源**的 `0001_init.sql`。
- **数据工厂**：`db::seed`（`#[cfg(test)]`）按参数生成 50 章 × 3000 字数据集；基准 `bench::seed_query_under_100ms` 断言单次查询 < 100ms。
- **命令**：`cargo test --manifest-path src-tauri/Cargo.toml`（基准耗时用 `-- --nocapture` 观测，写路径耗时仅观测不作门禁）。
- **当前基线**：`cargo test` 28/28、Vitest 36/36、`pnpm lint` 0 errors、`pnpm build` 通过。

## [+] 密钥链（keyring） (2026-10-09)

- crate：`keyring = "4"`（默认 `v1` feature 自动选择平台后端）。
- Windows 后端 = **凭据管理器（Credential Manager）**；条目：`service = fatequill`、`account = {provider}/{label}`（如 `fatequill/openai-compatible/default`）。
- 调试 / 重置：Windows「凭据管理器 → Windows 凭据」删除 `fatequill/*` 条目。
- 前端**无 `keyring_get`**：Key 仅经 `keyring_set`/`keyring_delete`/`keyring_exists` 管理，永不回传前端。

## [+] 测试凭据清理与 keyring roundtrip 卫生 (2026-10-09)

- **keyring roundtrip 测试**：`set → get → delete` 用**唯一 label**（如 `test/{uuid}`），测试结束前删除条目，避免系统凭据库残留。
- **人工核验残留**：Windows `cmdkey /list` 应无 `fatequill`/`test-provider` 命中。
- **临时库文件**：「Key 不落库」测试使用的临时 SQLite 文件须 `remove_file` 清理（temp 目录不留 `fatequill_np_*`）。
- **凭据重置**：Windows「凭据管理器 → Windows 凭据」删除 `fatequill/*` 条目（见上方「密钥链（keyring）」节）。

## [+] 编辑器依赖版本表（精确，stage-04 T1） (2026-10-09)

| 包 | 精确版本 | 用途 |
|----|----------|------|
| `@tiptap/react` | 3.31.4 | React 绑定（peer `react ^19`） |
| `@tiptap/core` | 3.31.4 | 核心（headless `Editor`） |
| `@tiptap/pm` | 3.31.4 | ProseMirror 依赖 |
| `@tiptap/starter-kit` | 3.31.4 | 基础扩展包（含 `@tiptap/extensions` 的 `undoRedo`） |
| `@tiptap/markdown` | 3.31.4 | 官方 Markdown 解析/序列化（依赖 `marked ^17`） |
| `zustand` | 5.0.15 | 状态管理（stage-04 接入） |
| `@dnd-kit/core` | 6.3.1 | 拖拽排序基础 |
| `@dnd-kit/sortable` | 10.0.0 | 列表排序 |
| `@dnd-kit/utilities` | 3.2.2 | dnd-kit 工具 |

- 安装方式：`pnpm add -E`（**禁止 `^`/`~`**，统一精确版本；可复现性由提交的 `pnpm-lock.yaml` 保证）。
- 编辑器扩展配置见 `src/features/editor/editor-extensions.ts`（StarterKit h1–h3 + `undoRedo.newGroupDelay=5000` + Markdown）。

## [+] 长文性能基准 BenchPanel 用法（人工协验） (2026-10-10)

- **落点**：`src/features/editor/perf/` —— `seed.ts`（生成 5000 字 HTML 载荷）、`editor-bench.ts`（`dispatch→DOM` 耗时采样 + `p95`）、`BenchPanel.tsx`（**仅 DEV**，`import.meta.env.DEV` 守卫，`App.tsx` 挂载）、`README.md`（操作手册 + 实测记录表）。
- **用法**：`pnpm tauri dev` → 打开 BenchPanel → 执行 → 读 **P95**（目标 < 16ms）/ 连续切 20 章后 `.ProseMirror` 实例数（须 =1）/ `performance.memory.usedJSHeapSize` 堆增幅（< 20%），回填 `README.md` 实测记录表。
- **口径**：**真实 WebView**（jsdom 无布局，**不可用于延迟测量**）；IME `composition` 期间延迟单独统计/排除；BenchPanel 自身含一个 `.ProseMirror`，实例计数须**排除面板子树**。
- **自动化部分**（seed/p95 逻辑/边界测试）可在 jsdom 单测；延迟与内存实测为**人工协验项**。

## [+] 真机冒烟检查单用法（v0.1 收口） (2026-10-10)

- **落点**：`docs/smoke-check-v0.1.md`——表格化检查单（列：步骤 / 预期 / 实际 / 结果），承载 M1 全流程的**真机（Tauri 窗口）人工协验**；自动化部分对应对应 `pnpm test`（Vitest mock 全链路）+ `cargo test`（数据层往返）。
- **用法**：`corepack pnpm tauri dev` → 按 M1~M10 逐项操作并填写「实际 / 结果」两列（含「关窗重开 → 内容 / 设定卡仍在」重启不丢项，以及无 Key 引导、停止/失败草稿保留等）。
- **口径**：v0.1 **不引入 tauri-driver**（成本/收益低，留 v0.2+ 评估）；「重启不丢」由检查单一条手测承载；延迟/内存口径见 `src/features/editor/perf/README.md`（真实 WebView 基准）。
- **结果汇总**：通过项 __/10 + 环境（OS/WebView2/日期/操作者）；未通过项须记录现象。

## [+] v0.2 冒烟检查单用法（研究 / 审查流程，人工协验） (2026-10-10)

- **落点**：`docs/smoke-check-v0.2.md`（表格：步骤 / 预期 / 实际 / 结果），承载 v0.2 的**真机（Tauri 窗口）人工协验**，与 `docs/smoke-check-v0.1.md` 并列。
  - **审查流程（R1–R10）**：配置模型 → 生成章节 → 触发四维审查 → 查看分数/理由 → 改判 → 触发重写（产物入池不自动替换）→ 采纳版本（`replaceContent` 单条撤销）→ 审查记录可回溯（`list_review_records`）。
  - **研究流程（S1–S5）**：模型勾选采样 → 交叉判断 → 待确认队列 → 用户标注入库 → skill 归纳 → **回注度量（skill 注入前后四维对比）**。
  - **性能（P1–P3）**：REV-014 perf 回填（P95<16ms / 20 章 `.ProseMirror`==1 / 堆增幅<20%）。
- **用法**：`corepack pnpm tauri dev` 后逐项操作并填写「实际/结果」两列；**需真实 WebView/真实 Key 的项**（AI 不可替代）如实标注 **BLOCKED（执行主体=用户/feel-tester）**，**严禁伪造数值**。
- **联动**：T6 度量实验落点 `src/features/research/experiments/report.md`（**数据状态字段**：已回填/待回填）与检查单 S5 **同一检查单闭环**；无 GUI 会话时 `report.md` 允许「待回填」占位但须如实标注。
- **判定**：BLOCKED 项**非失败、非通过**，不构成缺陷阻塞；闭合后随对应 REV（如 REV-009/014）一并 closed。测试基线（v0.2 收官）：`cargo test` **52/52**、Vitest **295/295**（64 文件）、lint 0 error、build 通过。

## [+] 发布流程（bundle / 许可 / Release / tag 人工） (2026-10-10)

- **版本同步**：`node scripts/sync-version.mjs 0.6.0` → `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 三处同步；`node scripts/check-version.mjs`（`pnpm version:check`）校验三处一致（不一致退出码 1）。
- **许可清单**：`corepack pnpm licenses:gen`（= `scripts/gen-licenses.mjs`）→ 生成 `docs/dependency-licenses.md`（npm 运行时依赖 + MIT 兼容白名单 + 例外登记）；Rust 侧需先 `cargo install cargo-license`（未装则跳过并标注回填指引）。
- **打包**：`corepack pnpm tauri build --bundles nsis`（Windows 为主；产物 `src-tauri/target/release/bundle/nsis/*.exe`）；`tauri.conf.json` `bundle.targets=["nsis"]` + `bundle.windows.webviewInstallMode={type:"downloadBootstrapper"}`（WebView2 在线引导；离线改 `offlineInstaller`）。
- **CI / Release**：`.github/workflows/ci.yml`（lint + test + build + cargo，**不含 bundle**）；`.github/workflows/release.yml`（`workflow_dispatch` + `push: tags v*` → verify + bundle(windows-latest) + release(附产物, body 取 CHANGELOG)）。
- **发布动作（用户人工执行）**：`git tag v0.6.0` + 推送 + 触发 Release workflow（GitHub Release 附 nsis 产物）——**AI 不代打 tag / 不代发布**；真机 bundle **可安装启动**为人工协验项。
- **CHANGELOG**：`CHANGELOG.md`（Keep a Changelog）随版本维护。
- **自动化门禁基线（v0.6 收官）**：`pnpm test` **670/670**（127 文件）、`cargo test` **62/62**、lint 0 error、build 0、`format:check` 通过、`version:check` 通过。
