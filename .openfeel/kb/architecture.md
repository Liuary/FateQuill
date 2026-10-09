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
- **迁移单一来源（stage-02 落地）**：建表脚本 `src-tauri/migrations/0001_init.sql` 为唯一 SQL 源；插件运行时经 `include_str!` 消费，`cargo test` 经 `sqlx::migrate!("./migrations")` 同源消费，保证测试库与生产库 schema 完全一致。

## [+] 领域层三段式分层与仓储接口/实现分离 (2026-10-09)

- **三段式落点（不新建独立 `infra` 目录）**：`src/domain/repositories/*`（纯 TS 仓储接口）→ `src/ipc/repositories/*`（实现接口，经 `invokeCommand` 调 Rust 命令）→ `src-tauri/`（Rust `#[tauri::command]` + 插件）。组件/feature 只依赖接口，不感知命令名；`snake_case` 行 ↔ `camelCase` 领域模型的映射由 `src/ipc/` 承担。
- **领域层纯度工具化**：ESLint `no-restricted-imports` 约束 `src/domain/**` **禁止导入** `react*`、`@tauri-apps/*`、`@/ipc`、`@/components`、`@/ui`、`@/features`、`@/store`；接入 `pnpm lint` / CI，并以「注入违禁导入 → eslint 非 0 退出」作**负向判定**（规则确实生效，非仅声明）。
- **不变量校验**：`src/domain/invariants.ts` 纯函数覆盖 5 条清单（order_index 连续唯一、外键有效、content 非空、枚举值域、删除后统计一致），Vitest 覆盖含边界。

## [+] IPC 错误结构约定与统一事务入口 (2026-10-09)

- **错误结构**：跨 IPC 边界的错误统一为 `{ code: string; message: string; detail?: unknown }`（Rust `IpcError` 序列化，`detail` 用 `#[serde(skip_serializing_if = "Option::is_none")]` 省略）。
- **错误码表**（7 个）：`NOT_FOUND` / `VALIDATION` / `UNIQUE_VIOLATION` / `FK_VIOLATION` / `MIGRATION_FAILED` / `DB_LOCKED` / `INTERNAL`。Rust `impl From<sqlx::Error> for IpcError` 按 SQLite 原生错误码映射：`2067`/`1555` → `UNIQUE_VIOLATION`、`787` → `FK_VIOLATION`、`5`/`6` → `DB_LOCKED`，其余 → `INTERNAL`。
- **前端归一化**：`src/ipc/errors.ts` 将任意 reject 归一化为 `IpcError`（`code`/`detail`），`src/ipc/client.ts` 的 `invokeCommand` 统一 `try/catch → parseIpcError`；消费方按 `IpcError.code` 分支。
- **统一事务入口**：`src-tauri/src/db/mod.rs` 的 `db::begin(pool) -> Result<Transaction<'_, Sqlite>, IpcError>` 作为所有多步写入（移动/删除后重排等）的唯一入口；出错经 `?` 提前返回（`Transaction` drop 即回滚），仅成功时 `commit()`。

## [+] AI 数据面：Rust 侧 provider 无关 SSE 中继 + 前端自研适配器 (2026-10-09)

- **不引入 Vercel AI SDK**（`ai` 包）：`orchestration` 任何文件不得 `import "ai"`（DoD 1）。**ADR**：ADR-001（accepted，正式决策见 `.openfeel/dev/decisions.md`）。
- **数据面在 Rust 侧**：命令 `http_stream(request_id, url, headers, body, auth, on_event: Channel<StreamEvent>)` 做 provider 无关的 SSE 透明中继；`abort_stream(request_id)` 经 `AbortHandle` 断流取消。`StreamEvent` = `Chunk{data}` / `Done` / `Error{code,message,statusCode?}`。
- **授权头不入前端（REV-009）**：授权类头（`authorization`/`x-api-key`/`proxy-authorization`/`api-key`）由 Rust 从 OS 密钥链（`keyring`，service=`fatequill`）读取并合并/覆盖；前端传入的同名头一律丢弃。Key 仅在 Rust 内存，永不下发前端。
- **https-only**：`ensure_https` 仅允许 `https://`。
- **超时/脱敏**：connect 10s / read 60s → `TIMEOUT`，无自动重试；错误 payload 仅 `{code,message,statusCode?}`，不含 URL/headers/body/Key。
- **事件切分（REV-012）**：按空行边界切分，跨块 `\r` 状态机归一化，兼容 `\n\n` / `\r\n\r\n` / `\r\r`，并冲刷无空行终止的末块。
- **扩展点（REV-007②）**：新增 Provider = 新建适配器文件 + 在 `src/orchestration/providers/register.ts` 注册一行；`orchestration` 核心文件零改动。前端经 `src/ipc/stream.ts` 的 `httpStream()`（`requestId` 可选）消费。

## [+] 模型配置持久化 + 密钥链 (2026-10-09)

- **迁移 v2** `0002_model_config.sql`：`model_config(id, provider, label, base_url, model_name, temperature, is_default, created_at, updated_at)`，**不含 key 字段**（C-05）；`UNIQUE(provider,label)`。走内置 migrations 数组（`include_str!` 单一来源 + `_sqlx_migrations` 幂等），**不旁路**。
- **三段式**：`src/domain/repositories/model-config-repository.ts`（接口）→ `src/ipc/repositories/model-config-repository.ts`（经 `invokeCommand`，snake_case↔camelCase，`is_default` 0/1↔boolean）→ `src-tauri/src/commands.rs`（5 命令）+ `src-tauri/src/db/model_config.rs`。
- **Key 仅经 OS 密钥链**（`crate::keyring_store`）：命令 `keyring_set`/`keyring_delete`/`keyring_exists`（**无 get**）；Key 不入库、不下发前端，仅 Rust 中继注入授权头时内部读取。
- **config ↔ keyring 关联**：`model_config(provider,label)` ↔ `fatequill/{provider}/{label}`。
- **设置页**：`src/features/settings/{SettingsPage,ModelConfigForm,ModelConfigList}.tsx`（i18n `settings` 命名空间，双语）；`src/app/App.tsx` 提供可达入口。

## [+] 可插拔 AI 编排引擎（Provider / Agent / Pipeline 注册表） (2026-10-09)

- **契约层 `src/orchestration/types.ts`**：`Chunk = { delta: string }`（provider 无关文本增量）、`ChatMessage`、`ChatOptions`（`headers` 仅承载非 Key 头，授权头由 Rust 注入）、`ModelProvider.stream(options) → AsyncIterable<Chunk>`、`Agent{id,name,systemPrompt,modelRef,temperature?,tools?}`、`PipelineStep<In,Out>` / `Pipeline`。
- **注册表 `registry.ts`**：泛型 `Registry<T extends {id:string}>`（`register` 拒绝重复 id / `replace` 覆盖 / `resolve` 未注册抛错 / `has` / `list` / `remove`），`createRegistries()` 返回 `{providers, agents, pipelines}`。
- **扩展点（可判定）**：新增 Provider = 新建适配器文件 + 在 `providers/register.ts` 注册一行；`types.ts`/`registry.ts`/`stream/**`/`pipeline/**` 核心文件 `git diff` 为零（DoD 第 2 条口径）。内置实现：`openai-compatible`、`anthropic`（自研 SSE 解析）。
- **Pipeline 契约先行**：v0.1 只实现「单 Agent 生成」最小 Step（`GenerationStep = PipelineStep<GenerationInput, AsyncIterable<Chunk>>`，`runner.runSteps` 保持可组合签名）；多步组合管线于 **stage-06/08** 启用。
- **stream 工具集（T6，纯 TS）**：`async-queue.ts`（push/close/fail 异步队列，适配器与消费端复用）、`throttle.ts`（默认 ≥50ms 合并、可注入时钟）、`subscribe.ts`（消费入口）；**不建 store**，stage-05 `generationStore` 订阅 `subscribeChunks` 输出。

## [+] 流式通道：Tauri Channel + requestId + AbortHandle (2026-10-09)

- **选型**：SSE 回传用 Tauri 2 **`Channel`**（命令级专属通道、请求隔离、支持高频分块）而非全局 **`emit`**（广播语义，多请求串扰、无背压、无法安全取消单条流）。
- **命令**：`http_stream(request_id, url, headers, body, auth, on_event: Channel<StreamEvent>)`；`abort_stream(request_id)` 从 `StreamRegistry`（`HashMap<request_id, AbortHandle>`）取出并 `abort()`（drop future → 连接关闭）。
- **事件三态**：`StreamEvent = Chunk{data}`（完整 SSE 事件块）/ `Done` / `Error{code,message,statusCode?}`；Rust `#[serde(tag="type")]` + `#[serde(rename="statusCode")]` 对齐 TS 契约 `src/ipc/stream.ts`。
- **前端 `httpStream()`**：内部 `requestId ?? crypto.randomUUID()` 缺省生成，返回 `abort` 函数；适配器无需关心 requestId（消除 op-004 真实路径缺参隐患）。
