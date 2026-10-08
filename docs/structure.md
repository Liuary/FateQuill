# 目录结构约定（FateQuill / 命笔）

> 本文档为前端与后端的分层目录、路径别名、状态管理与 IPC 边界的**权威约定**。
> 归属阶段：v0.1.0-stage-01（T3）。后续阶段新增目录须在此登记。

## 1. 分层目录职责

| 目录 | 职责 |
|------|------|
| `src/app/` | 应用入口与全局装配（`main.tsx`、`App.tsx`、i18n 初始化、Provider 等） |
| `src/components/` | 应用级组合组件（自建） |
| `src/components/ui/` | shadcn/ui 源码组件（由 shadcn CLI 管理，落库为可编辑源码） |
| `src/ui/` | 通用可复用 UI 层（布局、非 shadcn 组合组件） |
| `src/features/` | 面向用户的功能模块（按功能内聚） |
| `src/domain/` | 纯 TS 领域模型与业务规则（无 UI、无网络） |
| `src/orchestration/` | Agent 编排引擎（可插拔） |
| `src/ipc/` | 前端 IPC 封装（`invoke` 包装） |
| `src/store/` | 状态管理目录（Zustand 于 stage-04 接入） |
| `src/lib/` | 通用工具（如 `cn`） |
| `src/locales/` | i18n 资源（zh-CN / en） |
| `src-tauri/` | Rust 后端（网络 / 密钥 / SQLite 边界） |

> 空目录以 `.gitkeep` 占位，保证纳入版本管理。

## 2. `ui` 层映射与通用层区分（plan v3 定稿）

plan v3 技术约束中的目录集为 `src/{app,components,features,domain,orchestration,ipc,store}`，其中：

- **plan v3 的 `ui` 层映射为 `src/components/`**；shadcn/ui 组件源码落于 **`src/components/ui/`**（满足阶段计划 T2 与 REV-007③）。
- 另设**通用可复用 UI 组合层 `src/ui/`**（布局、非 shadcn 组合组件，如 op-008 的语言切换器），以显式目录名区别于 plan v3 的 `ui` 层语义。

**理由**：shadcn CLI 默认约定组件落点为 `@/components/ui`（见 `components.json` 的 `aliases.ui`），保持与 CLI 一致可避免后续 `shadcn add` 路径漂移；同时以独立 `src/ui/` 承载自建的通用组合组件，避免与 shadcn 生成物混放。

## 3. 路径别名约定

- 别名：`@/*` → `src/*`。
- **双端同步**（缺一不可）：
  - `tsconfig.json`：`"paths": { "@/*": ["./src/*"] }`（相对 tsconfig 所在地解析）。
  - `vite.config.ts`：`resolve.alias["@"] = fileURLToPath(new URL("./src", import.meta.url))`。
- **禁止**使用 `path.resolve(__dirname, "./src")`：项目 `package.json` 为 `"type": "module"`，ESM 下 `__dirname` 未定义，会导致 `ReferenceError` 与 `pnpm build` 失败（统一采用 ESM 写法，REV-010）。

## 4. 状态管理（`src/store/`）初始化时机与 Zustand 归属

- 本阶段（v0.1.0-stage-01）**不安装 Zustand**，仅建立 `src/store/` 目录。
- **Zustand 首个接入阶段 = stage-04**（编辑器态 `editorStore`）；**stage-05** 新增 `generationStore`。
- stage-03 的模型配置态如需状态管理，复用 stage-04 引入的 Zustand。

## 5. IPC 边界

- 所有**外部 HTTP**、**密钥**、**SQLite** 访问**仅经 Rust 侧**（`src-tauri/`）；前端**只经 `@/ipc`** 封装的 `invoke` 调用后端。
- 前端不得直接发起外部网络请求；IPC 封装的命令通道约定见 `docs/ipc.md`（T5 落地）。
