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
