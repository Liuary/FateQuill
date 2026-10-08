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
