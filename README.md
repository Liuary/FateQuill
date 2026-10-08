# FateQuill（命笔）

> FateQuill（中文名「命笔」）是一款跨平台桌面创作工具，致力于在保留创作者个人风格的同时，以可插拔的 Agent 编排能力提升长篇写作效率。

## 技术栈

- **桌面外壳**：Tauri 2（Rust 后端 + WebView2）
- **前端**：React 19 + Vite + TypeScript（strict）
- **样式**：TailwindCSS v4（CSS-first）+ shadcn/ui（组件源码入库）
- **状态管理**：Zustand（于 stage-04 接入，当前阶段未安装）
- **测试与质量**：ESLint + Prettier + Vitest（Testing Library）+ `cargo test`

## 环境前置

开发前需准备以下环境（Windows）：

| 依赖             | 说明                                                                                                                                                             | 检测命令          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Rust stable      | 经 [rustup](https://rustup.rs/) 安装；具体版本以仓库根 `rust-toolchain.toml` 为准                                                                                | `cargo --version` |
| MSVC Build Tools | 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 并勾选「使用 C++ 的桌面开发」工作负载（Windows 上 Rust 链接器必需） | 见 VS Installer   |
| WebView2 Runtime | Windows 10/11 通常已内置；否则从 [Microsoft 官网](https://developer.microsoft.com/microsoft-edge/webview2/) 安装 Evergreen Runtime                               | 见「应用与功能」  |
| Node.js LTS      | 从 [nodejs.org](https://nodejs.org/) 安装 LTS 版本                                                                                                               | `node -v`         |
| pnpm ≥ 9         | 经 corepack 启用：`corepack enable`（仓库已通过 `packageManager` 固定 pnpm 版本）                                                                                | `pnpm -v`         |

快速自检（PowerShell）：

```powershell
node -v            # 预期 v24.x
corepack pnpm -v   # 预期 12.x
cargo --version    # 输出 stable 版本号（如 cargo 1.xx.0）；具体版本以 rust-toolchain.toml 为准，本 README 不写死小版本
```

## 安装

依赖经 pnpm（由 corepack 提供）安装：

```powershell
corepack pnpm install
```

> 若提示 pnpm 不可用，先执行 `corepack enable` 启用 corepack 提供的包管理器。

## 开发（dev）

启动桌面应用（Tauri dev，自动拉起 Vite 开发服务器）：

```powershell
corepack pnpm tauri dev
```

## 构建（build）

前端生产构建（`tsc` 类型检查 + `vite build`）：

```powershell
corepack pnpm build
```

## 代码检查（lint）

ESLint 静态检查（可选：`corepack pnpm format:check` 校验 Prettier 格式）：

```powershell
corepack pnpm lint
corepack pnpm format:check   # 可选
```

## 测试（test）

前端单元测试（Vitest）与 Rust 测试：

```powershell
corepack pnpm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## 更多文档

- 目录分层与路径别名约定：[`docs/structure.md`](docs/structure.md)
- IPC 通道（命令/事件流）约定：[`docs/ipc.md`](docs/ipc.md)
