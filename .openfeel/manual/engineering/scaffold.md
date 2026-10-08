# 模块手册：工程脚手架（engineering/scaffold）

## 职责

FateQuill（命笔）的可运行、可构建、可测试、可复现的跨平台桌面工程基座，为后续所有阶段提供承载。建立于 **v0.1.0-stage-01**。

## 技术栈

- **桌面外壳**：Tauri 2（Rust 后端 + WebView2），identifier `com.fatequill.app`，productName `FateQuill`。
- **前端**：React 19 + Vite + TypeScript（strict）。
- **样式**：TailwindCSS v4（CSS-first）+ shadcn/ui（组件源码入库于 `src/components/ui/`）。
- **i18n**：i18next + react-i18next（默认 zh-CN，可切 en，缺 en 回退 zh-CN）。
- **质量**：ESLint（flat config）+ Prettier + Vitest（Testing Library/jsdom）+ `cargo test`。
- **数据存储**：SQLite 经 `tauri-plugin-sql` v2（**仅 Rust 侧**），db 位置 `sqlite:fatequill.db`（Tauri AppData）；迁移内置（sqlx `_sqlx_migrations`，幂等）。
- **包管理**：pnpm（corepack 提供，`packageManager` 固定 12.10.1）。

## 目录结构

```
src/
├── app/             # 应用入口与全局装配（main.tsx、App.tsx、i18n.ts）
├── components/      # 应用级组合组件；ui 层映射，shadcn 落 ui/
├── ui/              # 通用可复用 UI 组合层（布局、非 shadcn 组合组件）
├── features/        # 面向用户的功能模块
├── domain/          # 纯 TS 领域模型与业务规则
├── orchestration/   # Agent 编排引擎（可插拔）
├── ipc/             # 前端 IPC 封装（invoke 包装）
├── store/           # 状态管理目录（Zustand 于 stage-04 接入）
├── lib/             # 通用工具（cn）
├── locales/         # i18n 资源 {zh-CN,en}/{common,editor,settings}.json
└── test/            # 测试 setup
src-tauri/           # Rust 后端（网络 / 密钥 / SQLite 边界）
docs/                # structure.md / ipc.md / i18n.md
.github/workflows/   # ci.yml
```

## 核心约定

- **路径别名**：`@/*` → `src/*`，tsconfig 与 vite 双端一致；TS 6 下**不使用 `baseUrl`**（已弃用）。
- **IPC 边界（C-04）**：外部 HTTP / 密钥 / SQLite 仅在 Rust 侧；前端统一经 `src/ipc/*.ts` 封装 `invoke`，组件不直连（示例命令 `ping` → `pong`）。
- **状态隔离归属**：Zustand 于 stage-04 接入（`editorStore`），stage-05 增 `generationStore`；流式/节流约定归属 stage-03 / stage-05。
- **i18n**：`src/app/i18n.ts` 初始化，localStorage key `fatequill.lang`，init 后同步 `<html lang>`；创作向内容不本地化（C-11）。
- **版本锚定**：`packageManager` + `engines.node` + `rust-toolchain.toml` 三件套；仓库仅一份 `pnpm-lock.yaml`。
- **提交规范**：`<type>(scope): <desc> (T#)`。

## 构建 / 测试 / CI

| 操作 | 命令 |
|------|------|
| 安装 | `corepack pnpm install`（CI：`--frozen-lockfile`） |
| 开发 | `corepack pnpm tauri dev` |
| 构建 | `corepack pnpm build`（tsc + vite） |
| 检查 | `corepack pnpm lint` / `corepack pnpm format:check` |
| 测试 | `corepack pnpm test` / `cargo test --manifest-path src-tauri/Cargo.toml` |

- CI：`.github/workflows/ci.yml`，runner `windows-latest`，范围 lint + Vitest + build + cargo check + cargo test；**不含 tauri bundle**（移 stage-12）。
- 仓库：https://github.com/Liuary/FateQuill

## 关联文档

- 目录约定：`docs/structure.md`｜IPC 约定：`docs/ipc.md`｜i18n 约定：`docs/i18n.md`｜开发者说明：`README.md`
- 知识库：`.openfeel/kb/architecture.md`、`patterns.md`、`troubleshooting.md`、`setup.md`
- 阶段计划：`.openfeel/plan/v0/stage-01/plan.md`
