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

## [+] 编辑器前端分层与 editorStore 单一事实源边界 (2026-10-10)

- **落点**：`src/features/editor/`（编辑器与大纲树同域）承载 `RichTextEditor`/`ChapterEditor`/`useChapter`/`useAutoSave`/`EditorStatusBadge`/`markdown`/`Outline*`/`useOutline`/`useNovels`/`NewNovelPanel`/`WorkspaceLayout`/`EditorController`/`useChunkInjection`/`perf/`；元状态 store 为 `src/store/editorStore.ts`（Zustand **首次接入**，stage-04）。
- **单一事实源（C-01 边界）**：**ProseMirror/Tiptap 实例是文档内容的唯一事实源**；`editorStore` **不持文档正文**（避免双源同步 bug），仅持元状态 `currentNovelId` / `currentChapterId` / `saveStatus('saved'|'saving'|'dirty'|'error')` / `lastSavedAt`。边界测试 `editorStore.boundary.test.ts` 断言 state 键集合不含 `content`/`html`/`doc`。
- **存储格式 `content_format='html'`**：保存 `editor.getHTML()` → `chapter.content`；加载 `editor.commands.setContent(html)`；**零迁移**（复用 stage-02 schema 与 `word_count` html 分支，tiptap-json 留待 YAGNI）。
- `generationStore` 归属 **stage-05**，与 `editorStore` 严格分离（C-03 铺路）。

## [+] 一章一 Tiptap 实例策略 (2026-10-10)

- 切章以 React **`key={chapterId}` 重挂载**（销毁旧实例 / 重建新实例），**禁止累加** → 实例数恒为 1、无串档。
- `ChapterEditor` 增守卫：`chapterId != null && chapter?.id !== chapterId` 时渲染占位，确保编辑器**仅在「已加载章节与当前 id 匹配」时挂载**（防切章窗口内以旧章内容初始化，潜在串档）。
- 验证：连续切 20 章后 `.ProseMirror` 计数 === 1；HTML 往返语义等价（`setContent`/`getHTML`）。

## [+] T8 AI 增量插入接口契约 EditorController（供 stage-05） (2026-10-10)

- 编辑器对外**最小命令面**：`appendChunk(text: string, options?: { addToHistory?: boolean; follow?: boolean }): void` / `flushPending(): void` / `dispose(): void`。
- **消费方**：stage-05 `generationStore` 订阅 stage-03 `subscribeChunks` → 取 `Chunk.delta` → `appendChunk`；**stage-05 不直接操作编辑器内部**（不越界，C-09）。
- **撤销**：流式插入**恒入历史**，由 `undoRedo.newGroupDelay=5000` 合并为单条 → 一次 `Ctrl+Z` 撤销整段生成（详见 `kb/patterns.md`）。**IME**：`composition` 期间入队、`compositionend` 后 flush。`dispose()` 移除 DOM 监听。
- `appendChunk` 按节流批次应用（默认 50ms）；`options.follow` 控制滚动到文末；`options.addToHistory` 为**预留**字段（当前实现恒入历史）。

## [+] 生成内容落地模式 A 流式直插（ADR-002） (2026-10-10)

- **落点**：`src/features/generation/`（`useGeneration.ts` 编排）+ `src/orchestration/prompts/chapter-generation.ts`（模板）+ `src/features/editor/EditorController.ts`（插入面）。
- **生成链路（定稿）**：`generationStore` 订阅 stage-03 `subscribeChunks`（节流 ≥50ms）→ 取 `Chunk.delta` → stage-04 `EditorController.appendChunk`（恒入历史）。**「生成面板」仅承载状态**（进度/停止/重试/错误），**不设内容预览面板**；正文事实源始终在 Tiptap 实例。
- **决策依据（ADR-002，accepted，见 `dev/decisions.md`）**：与 M1「AI 生成一章并流式插入」字面一致；兑现 stage-04 T8 的撤销合并/IME 排队/节流机制（否则投资空转，违反 C-08）；创作体验连续（边生成边读边改）。备选模式 B（先预览再一次性插入）被否决。
- **后果**：生成期间编辑器零 React 重渲染（ProseMirror 直改 DOM，不经 React 受控更新）；停止/失败时已插入内容按「草稿」语义保留，一次 `Ctrl+Z` 撤销整段。
- **边界**：本阶段仅接线，**不修改** stage-04 `EditorController`/`useChunkInjection` 内部（C-09）；装配产物 provider 无关，provider 差异由 stage-03 适配器吸收。

## [+] generationStore 元状态边界与双 store 隔离 (2026-10-10)

- **落点**：`src/store/generationStore.ts`（独立 Zustand `create()`，与 `editorStore` 并列）。
- **元状态清单（不持正文）**：`status: 'idle'|'streaming'|'done'|'error'|'aborted'`、`chapterId: number|null`、`requestId: string|null`、`progress: { chars: number }`、`error: IpcError|null`；**无 `content`/`html`/`delta`**（与 `editorStore` 同一「单一事实源」原则，正文事实源在 Tiptap 实例）。
- **隔离机制**：与 `editorStore` **各自独立 `create()`、不互相 `setState`**；跨域通信仅经 `EditorController` 命令面（插入）与自动保存域（`editorStore.saveStatus`）。
- **收敛语义**：`status` 枚举保留 `'error'|'aborted'` 供前向兼容，但 **v0.1 收敛态统一为 `'idle'`**——停止 → `reset()`（`status=idle`、`requestId=null`、草稿保留）；失败 → `fail(IpcError)`（`status=idle`、`requestId=null`、`error` 展示）。「半态」= 残留 `streaming`/悬挂 `requestId`，**状态机复位断言入测试**。
- **requestId 澄清**：`generationStore.requestId` 为**生成会话关联 id**（`crypto.randomUUID()`，供 UI/日志关联）；底层断流经适配器 `AbortSignal` → stage-03 `abort_stream`（前端不持有底层 requestId）。

## [+] 四维评审机制（LLM-as-judge + 合规规则引擎） (2026-10-10)

- **落点** `src/orchestration/review/`（provider 无关，复用编排引擎契约，与 `manual/orchestration/engine.md` 扩展点一致）；UI 在 `src/features/review/`、元状态在 `src/store/reviewStore.ts`。
- **契约**：`Evaluator.evaluate(input: ReviewInput) → Promise<EvaluationResult>`；`EvaluationResult = { score: 0–100; reasons: string[]; findings? }`；注册表复用泛型 `Registry<Evaluator>`。
- **四维执行机制**：剧情 / 世界观 / 真人感 = **LLM-as-judge**（经 stage-03 `ModelProvider.stream(ChatOptions)` 发评审 prompt，`for await` **非流式收口**聚合全文后 `parseEvaluationJson`；`temperature=0`）；**合规 = 规则引擎**（`compliance-rules.ts` 本地词表/正则，**无需 Token**、可单测）+ 可选 LLM 复核。
- **判据共享**：真人感 rubric 与 stage-07（去 AI 味）**共享同一判据定义**，避免两套口径。
- **测试口径**：LLM 维 = 夹具回放（`tests/fixtures/review/` mock 响应 + `review-samples/expected.json` 期望区间）；合规维无需 provider。

## [+] 会话级版本池与加权择优 (2026-10-10)

- **版本池 = 初版 + 重写轮次产物**；v0.2 为**会话级（内存）**——采纳后正文持久化，版本内容持久化留待后续（避免过度设计）。非最优版本保留可回看。
- **加权总分** `weightedTotal(results, weights) = Σ(score×weight)/Σweight`（**缺维 / 零权不参与**，归一 0–100）；`DEFAULT_WEIGHTS` 四维=1；`reviewStore.setWeights` 变更后**重算全部版本总分**（权重可调且改变排序）。
- **采纳落地**：以选定版本**整章替换**正文 → stage-04 扩展 `EditorController.replaceContent(html)`（**单条撤销历史**，替换前丢弃未 flush 的 `appendChunk` 缓冲）；`appendChunk` **追加语义保留不变**；`replaceContent` 属**前端命令面，非 IPC**。
- **store 边界**：`reviewStore` 独立 `create()`（与 `editorStore`/`generationStore` 并列，不互相 setState），持版本池 / 权重 / `autoRewrite` / `needsHumanReview`。

## [+] 重写回路（上限 2 / 反馈注入 / 合规排除 / 入池不替换） (2026-10-10)

- `runReviewLoop`（`src/orchestration/review/loop.ts`）：初版评分 → 未通过且可自动重写 → **注入上轮反馈**重写 → 复审 → 逐轮入池；返回 `{ needsHuman, rounds }`。
- **失败判定**：`weightedTotal < passThreshold`（默认 60）判该轮失败；`failedDims` = 单维 `score < passThreshold` 的维度集合（仅用于反馈注入与合规排除）。
- **自动重写触发**：`triggerDims = failedDims \ {compliance}`；`triggerDims` 为空（仅合规未过）→ **不自动重写**、`needsHuman=true`。**上限 2 次**（`maxRounds`），默认开启、可在权重配置关闭（成本控制）。
- **反馈注入**：`buildRewriteMessages` 结构化注入未通过维度的 `score + reasons` + 要求（保留原意、改进反馈项）。
- **落地**：重写产物经 `onVersion` **入池 + 自动评分**，回路**不调用任何正文替换**（`replaceContent`/`setContent` 零调用）——由用户择优采纳，兼顾成本与安全。

## [+] 去 AI 味数据流闭环（采样 → 交叉 → 标注 → 素材库 → skill → 回注） (2026-10-10)

- **定位**：兑现大计划「双核心目的」之目的 2（研究「去 AI 味」），为**独立可研究、可积累的子系统**（约束 C-10），建立于 stage-07（v0.2 收官半边，M2 素材库半边）。
- **四环节主线（数据资产与流程）**：
  1. **多模型无限制创作采样**（T1）：列全部已配置 `model_config`、用户勾选 ≥1，**串行逐模型**`provider.stream` 聚合全文 → 内存 `MaterialCandidate`。产出**仅入候选**。
  2. **多模型交叉判断**（T2）：对候选逐模型 LLM-as-judge 摘取 AI 味片段 → **引文精确交集合并**（命中 ≥2 高置信 / =1 待确认）→ 入**会话内存待确认队列**（`researchStore.pendingResults`，**不入库直达**）。
  3. **用户标注**（T3）：受控标签枚举 + 备注 + **verbatim 引文搜索定位** → 经 `material` 仓储入库（`status=confirmed`，`sourceType` 按被标注项自带通道透传）。
  4. **素材库 → 规避 skill 库 → 回注生成**（T4/T5/T6）：素材（含来源模型/判据/结论，可检索/导出 JSON·CSV、**默认仅本地**）→ 人工归纳为 `skill_entry`（`rule` = 可执行规避指令，以 `sourceMaterialIds` **引用**素材避免重复存储）→ 经 stage-05 装配器 `ChapterPromptInput.skills?` 拼入 system prompt **回注生成** → T6 固定样本集度量（真人感主指标）。
- **分层落点**：契约/算法 `src/orchestration/research/`（provider 无关）；会话态 `src/store/researchStore.ts`（独立 `create`）；UI `src/features/research/`（独立路由页，采样低频）；持久化 Rust + IPC（迁移 v4）。
- **测试口径**：单模型摘取失败**容错跳过**不整体失败；采样**副作用断言**（chapter.update 零调用 / editor·generation 快照不变 / runReviewLoop 零调用 / 无预算裁剪）；三采集通道经 `save_material` 的 `source_type` 断言。
- **学术诚实**：v0.2 为小样本雏形度量（≥3 篇、温度 0），**非统计显著性验证**；`report.md` 数据状态字段如实标注（已回填/待回填），真机执行由用户/feel-tester 协验。

## [+] 双数据资产（material / skill_entry）模型与迁移 v4 (2026-10-10)

- **迁移 v4** `0004_material_skill.sql`：走 stage-02 迁移纪律（`include_str!` 单一来源 + `_sqlx_migrations` 幂等；表数 7→9 断言更新，`_sqlx_migrations`==4），共 2 张业务资产表。
- **`material`（AI 味素材）**：`id, source_type, source_model, excerpt, position_json, reason, label, chapter_id, status, created_at`。
  - `source_type ∈ {multi_model_creation, multi_model_cross, user_manual}`（**三采集通道一一对应**）；`status ∈ {candidate, confirmed}`（`candidate` 为**预留枚举**——本阶段待确认队列为会话内存，所有入库写路径均为 `confirmed`；见 REV-013）。
  - **`excerpt` 为引文唯一权威列**；`position_json` **仅存上下文** `{contextBefore?, contextAfter?}`（各 ≤50 字，避免 offset 幻觉与冗余存储；REV-016①）；`chapter_id` `REFERENCES chapter(id) ON DELETE SET NULL`；隐私字段**仅本地**（无匿名聚合上传）。
- **`skill_entry`（规避 skill）**：`id, version, title, rule, examples_json, source_material_ids_json, created_at`。**载体定稿 = DB 表**（与素材引用关系可校验、统一备份/迁移、可检索）；`rule` = 可执行规避指令；`version` 可管理。
- **引用关系与防护**：素材 → skill 以 `source_material_ids_json` **id 引用**（避免重复存储、保证可追溯/学术性）；`material::delete` 删除前**全表解析引用精确判定**，被 skill 引用则**拒绝删除**（`FK_VIOLATION`，detail 携带 `[{id,title}]`）；`skill::insert/update` 校验 `source_material_ids` 素材均存在（不存在 → `VALIDATION`）。
- **导出**：JSON + CSV（学术分析用途）；CSV `createdAt` 归一为 ISO 8601。IPC 命令：material 3（`save_material`/`list_materials`/`delete_material`）+ skill 4（`save_/list_/update_/delete_skill_entry`），合计数据访问 45（+ 流式 2 = 47）。

## [+] 采样（研究）路径 vs 生成路径差异 (2026-10-10)

- **研究采样 = 无限制创作采样**，与正常生成链路**故意解耦**（stage-07 T1）：
  - **不触发自动审查**（`runReviewLoop` 零调用）；**不自动保存**（`chapter.update` 零调用、editor/generation store 快照不变）；**无预算裁剪**（不引用生成侧装配预算/`buildChapterPrompt`）；**产出绝不进编辑器正文、不落 `chapter`**（仅入 `researchStore.candidates`）。
  - **跳过合规拦截**：研究采样保持样本纯净（合规规则引擎本地无 Token，绕过合规以采集含 AI 味/风险的原始样本用于研究）。
  - **调度**：串行逐模型（采样无需并行，成本可控，∝ 勾选模型数）；`AbortSignal` 可停止（**已采集候选保留**）。
- **生成路径（对照 stage-05）**：`subscribeChunks` → 节流 → `EditorController.appendChunk`（模式 A 流式直插正文），触发自动保存；受装配预算（总 ≤8000）与裁剪序约束；生成可挂 skill 注入。
- **对比要点**：同为 `provider.stream` 消费，但采样**只读产出到内存候选**、生成**直插正文并落库**；采样无预算、无审查、无保存；生成有预算、审查可选、自动保存。
- **成本**：多模型创作 = N×生成 Token（N = 勾选模型数）；交叉判断 = 每候选 × 每模型 1 次评审 Token（≈2× 评审基线）；成本 ∝ 勾选模型数，用户可控。
