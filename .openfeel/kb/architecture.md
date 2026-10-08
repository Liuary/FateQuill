# 架构决策

> 记录项目的架构决策、设计理由与技术选型。`[+]` 启用 / `[-]` 禁用。
> 对应的正式决策记录另见 `.openfeel/dev/decisions.md`（ADR）。

## [+] 技术栈定稿：Tauri 2 + React 19 + Tailwind v4 + shadcn 源码型 + i18next (2026-10-08)

- **桌面外壳**：Tauri 2（Rust 后端 + WebView2），充分利用系统 WebView、产物体积小。
- **前端**：React 19 + Vite + TypeScript（strict）；React 19 为 create-tauri-app 官方模板默认版本。
- **样式**：TailwindCSS v4（CSS-first，无 `tailwind.config.js`）+ shadcn/ui **组件源码入库**于 `src/components/ui/`（非黑盒运行时依赖，满足可改可审查，约束 C-06）。
- **i18n**：i18next + react-i18next，界面双语（默认 zh-CN，可切 en，英文缺失回退中文）；**创作向内容不本地化**（约束 C-11，大计划 §1.5）。
- **版本锚定三件套**（纯 AICoding 防工具链漂移的关键，缺一不可）：`package.json.packageManager = pnpm@12.10.1`、`engines.node = ">=22"`（CI 固定 Node 24 双锚定）、`rust-toolchain.toml` channel = stable；仓库**仅一份 `pnpm-lock.yaml`**。
- **状态管理**：Zustand **不在 stage-01 安装**；首个接入阶段 = **stage-04**（`editorStore`），stage-05 增 `generationStore`，stage-03 复用。避免为未确定需求提前引入依赖（过度设计）。

## [+] 目录分层与状态隔离约定 (2026-10-08)

分层目录 `src/{app,components,features,domain,orchestration,ipc,store}` + 通用层 `src/ui` + Rust 侧 `src-tauri`，并写入 `docs/structure.md`：

| 目录 | 职责 |
|------|------|
| `src/app/` | 应用入口与全局装配（`main.tsx`、`App.tsx`、i18n 初始化） |
| `src/components/` | 应用级组合组件；**`ui` 层映射**，shadcn 源码落 `src/components/ui/` |
| `src/ui/` | 通用可复用 UI 组合层（布局、非 shadcn 组合组件，显式区别于 `ui` 层语义） |
| `src/features/` | 面向用户的功能模块 |
| `src/domain/` | 纯 TS 领域模型与业务规则（无 UI、无网络） |
| `src/orchestration/` | Agent 编排引擎（可插拔） |
| `src/ipc/` | 前端 IPC 封装（`invoke` 包装） |
| `src/store/` | 状态管理目录（Zustand 于 stage-04 接入） |
| `src/lib/` | 通用工具（如 `cn`） |
| `src/locales/` | i18n 资源（zh-CN / en） |
| `src-tauri/` | Rust 后端（网络 / 密钥 / SQLite 边界） |

- **状态隔离归属**：流式/节流约定不在 stage-01，归属 **stage-03**（Rust SSE 流式中继）与 **stage-05**（生成/编辑器状态隔离）。
- **边界约定（C-04）**：所有外部 HTTP、密钥、SQLite **仅在 Rust 侧**；前端只经 `@/ipc` 调用。

## [+] IPC 通道约定（命令通道已建，事件流延后 stage-03） (2026-10-08)

- **命令通道**：Rust 侧用 `#[tauri::command]` 定义，统一在 `tauri::Builder::default().invoke_handler(tauri::generate_handler![...])` 注册；前端统一经 `src/ipc/*.ts` 封装 `invoke`，**组件不直接调用**（约束 C-04）。示例链路 `ping` → `"pong"`。
- **命名约定**：命令名小写下划线（如 `ping`、后续 `list_novels`）；前端封装函数 camelCase；返回 `Result<T, E>`，错误经 `invoke` 的 catch 处理；Rust snake_case 参数与前端 `invoke(cmd, { camelCase })` 自动映射。
- **事件流通道**（`emit` / `Channel`，SSE 流式中继）归属 **stage-03**，本阶段仅确立通道约定不实现（`docs/ipc.md` 已声明）。

## [+] SQLite 选型与封装边界 (2026-10-09)

- **插件**：`tauri-plugin-sql` v2（Cargo feature `sqlite`），**仅在 Rust 侧使用**；`tauri.conf.json` 的 `plugins.sql.preload` 于启动即应用迁移。
- **迁移**：插件内置 migrations（Rust 注册 `Migration` 数组），底层 sqlx `_sqlx_migrations` 表管理版本、天然幂等；**不自研执行器**（C-08）。SQL 单一来源 `src-tauri/migrations/0001_init.sql`（`include_str!` 引用）。
- **前端边界（REV-009）**：**不安装** `@tauri-apps/plugin-sql`，前端不 import 插件 JS API（零引用即死依赖）；前端数据访问一律经自定义 `#[tauri::command]`（封装于 `src/ipc/`）。
- **Rust 侧取池**：插件以 state 暴露 `DbInstances`，自定义命令经 `app.state::<DbInstances>()` 取 `sqlx::SqlitePool`（故直接依赖 `sqlx 0.8`，与插件同版本）。
- **db 位置**：`sqlite:fatequill.db`（Tauri AppData，Windows `%APPDATA%/com.fatequill.app/fatequill.db`）；测试用 `sqlite::memory:`，禁止触达开发库。
- **FK**：迁移 SQL 顶部显式 `PRAGMA foreign_keys = ON;`（意图声明），运行时由 sqlx 默认 `foreign_keys=true` 保证。
