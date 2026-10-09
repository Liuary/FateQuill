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

## [+] 多温度并行推演编排（同模型多温度 + per-provider clamp + 乱序归位 + 会话内存分支） (2026-10-10)

- **定位**：兑现 M3「多温度并行推演产出可对比分支」——把「接下来怎么发展」从单点生成升级为可选分支，辅助创作者决策（stage-08）。
- **分层落点**：契约与算法 `src/orchestration/exploration/`（provider 无关）；会话态 `src/store/explorationStore.ts`（独立 `create`）；UI `src/features/exploration/`；**无新增 IPC**（复用 stage-03 `http_stream`，各分支**非流式收口**聚合为走向卡后回传）。
- **同模型多温度**：默认温度集 `{0.3, 0.7, 1.1}`（UI 可增删/调值；`localStorage['fatequill.exploration.temperatures']` 持久化）；**首版不对模型**（跨模型留待后续，兑现大计划「多模型并行」时可扩展）。
- **per-provider 温度归一**：`PROVIDER_TEMPERATURE_RANGE`（openai-compatible `[0,2]` / anthropic `[0,1]` / 未知回退 `[0,2]`）；`clampTemperature` 返回 `{effective, clamped}`，**被 clamp 分支 UI 显式标注**（避免跨 provider 语义漂移；敏感度差异由用户裁决兜底）。
- **编排**：`runExploration` 每分支经可注入 `streamFor` 取流并 `for await` 聚合全文 → `parseTurnCard`；结果槽位**按输入顺序预置**，与完成顺序无关（**乱序归位**）；单分支失败置 `error` 不抛穿；`concurrency` 默认 3（工作池 + 排队 + abort 全停）。
- **输入装配复用 stage-05** `buildChapterPrompt`（预算/裁剪），**用户「走向意向」为 user 段**；输出 = 结构化**「走向卡」`{ summary, keyTurns, settingCardIds }`**（摘要式，非正文片段）。
- **持久化方案 A（最小）**：分支 = **会话内存**，**不落库、不新增迁移 v5**（关闭即弃）；复看需求出现时再按 stage-02 迁移纪律补 v5。

## [+] 克制收敛两层机制（生成期约束注入 + 产出期覆盖检查降权标注，终选权归用户） (2026-10-10)

- **定位**：兑现 M3「推演分支须收敛到用户设定」，是 stage-08 核心机制（REV-001 high 定稿）——「克制」= 工具不替用户做主。
- **① 生成期约束注入**：设定卡/关键约束经 stage-05 装配链并入 **system 段**（`build-exploration-options` 把设定卡 `title:content` 拼入 system prompt 的「用户设定约束：」块；`intent` 为 **user 段**）；复用 `PROMPT_BUDGET.system`（≤1000 字），**不新增预算维度**。
- **② 产出期偏离标注（可判定判据）**：`converge`（纯函数）以**设定卡覆盖检查**为主判据——`coverage = |有效引用 ∩ 注入集| / |注入集|`（**无注入集时 coverage=1**：无约束可偏离）；含**存在性校验**（过滤幻觉引用，见 `kb/patterns.md`）。
- **「削弱」= 排序降权 + UI 显式标注**：`weight = flagged ? coverage × 0.5 : coverage`；**不过滤、不删除**（保持可对比）；`BranchCard` 对偏离分支加 `opacity-60` 视觉弱化 + `flagged` 徽标 + 覆盖率/缺失/无效引用明细。
- **「克制」语义**：发散度由**温度集**决定；收敛器**不强制改写**走向，仅降权/标注。
- **终选权 = 用户裁决**：`converge` 仅写 `deviation`/`weight`，**不回写正文、不删分支**；`BranchCompare` 按 `weight` 降序展示（**仅辅助排序**），全链路无自动采纳/替换调用。
- **可选贴合度**：`fitScores`（stage-06 评审管线**软依赖**，缺省不启用；提供且 `< threshold` 计入 `flagged`）。
- **边界（REV-008③）**：`flagged && coverage=1 → 0.5` 与 `!flagged && coverage=0.5 → 0.5` 可能并列，v0.3 **接受**（偏离通常另有 invalid/fitScore 触发；并列按温度序稳定排序），不额外引入权重维度。
- **已知局限（诚实声明）**：覆盖检查为**近似判据**（基于 `settingCardIds` 引用），不保证剧情级贴合；v0.3 以「辅助排序 + 人工裁决」为限，不追求自动终判。

## [+] 采纳双路径安全网（主：新建下一章草稿无损；次：替换当前章 + 强制快照 + 单撤销） (2026-10-10)

- **背景（REV-007 high）**：原「整章替换当前章（`replaceContent`）+ 版本池登记**仅可选**（默认不启用）」叠加 stage-04 `useAutoSave` **自动保存** → 误触采纳致当前章正文被覆盖并**持久化到 DB**，即便 `Ctrl+Z` 恢复编辑器，原正文在 DB 层**永久丢失**（undo 栈随文档销毁）。
- **主路径「新建下一章草稿」（推荐、无损）**：`repositories.chapter.create`（`orderIndex = 卷内 max+1`，追加当前卷末），内容 = `renderTurnCardToHtml(card)`；**不改当前章 DB 行** → 自动保存不可能覆盖原正文；**不适用 `Ctrl+Z`**。与推演语义（「接下来怎么发展」）最贴合，且无新增迁移前提下**根除 DB 级丢失**。
- **次路径「替换当前章」（危险）**：`EditorController.replaceContent(html)`（**单条撤销**，`Ctrl+Z` 语义归此）；执行前**强制** `reviewStore.addVersion({ label: "adopt-safety", content: 替换前正文 })`（把原「可选登记」改**必做**，使会话内始终有回滚点）+ `finally dispose()`。
- **确认门**：两路径均经**内联二次确认**（`ConfirmInline`，明示后果）；未确认（取消）→ **零副作用**（无 create / 无 replace / 无入池）。
- **丢弃**：`removeBranch`（会话容器移除；同步清 `collapsedIds` / `selectedBranchId`），**无残留** = 该分支不出现在 `explorationStore` 快照、无悬挂引用。
- **残余窗口（REV-009 medium，非阻塞登记）**：次路径快照落在 `reviewStore.versions`（**会话内存级，无持久化**）——关闭应用后原正文快照不可恢复（与 stage-06 版本池既有同级设计）；已登记持久化路线（迁移 v5 `chapter_snapshot` 或 localStorage 兜底），不阻塞 stage-08。

## [+] 易经卦象系统（六十四卦数据 + 朱熹变爻 + 引导卡 + 角色宿命） (2026-10-10)

- **定位**：兑现 M3「易经卦象可映射到剧情走向」——把六十四卦/爻变建模为**可选的剧情引导系统**，为多温度推演提供方向性输入，并把卦象映射为角色宿命（写入设定卡）。**大六壬显式排除**（留 stage-12）。建立于 **v0.3.0-stage-09**。
- **数据层**（`src/data/iching/`，**只读静态资源、无新迁移、无新 IPC**）：**公有领域《周易》经文白文**（卦辞 + 384 爻辞，**不含**乾用九/坤用六，**不含**需授权的今人译注）；`ICHING_DATA_VERSION` 版本化；来源/许可/校对口径登记 `docs/iching-data.md`。TS 结构化常量（`types.ts`/`trigrams.ts`/`hexagrams.ts`，binary 6 位**自下而上**）+ **手写类型守卫校验**（`validate.ts` 六条规则，**无第三方校验库**，见 `patterns.md`）。
- **算法层**（`src/orchestration/iching/`，**纯函数、无 IO**）：`deriveHexagram(lines) → { benGua, zhiGua, changingLines }`（本卦/之卦/变爻）；**朱熹《易学启蒙》变爻七情形**（`zhuXiReading`：0 本卦卦辞 / 1 本卦变爻辞 / 2 本卦两变爻以**上爻**为主 / 3 本卦与之卦卦辞 / 4 之卦两不变爻以**下爻**为主 / 5 之卦不变爻辞 / 6 之卦卦辞）；起卦两法（**随机=可注入随机源 + `createSeededRng`(mulberry32) 种子复现**；**手动=指定卦 + 可选变爻**）；**时间起卦（农历/干支）v0.3 推迟**（不引入历法依赖 C-08，入口不呈现）。
- **引导契约（stage-08 衔接，REV-003）**：引导卡 `{ hexagramName, judgmentDigest, changingLineReadings, plotHints, fateHints }`（**确定性**；经文原样不译；`judgmentDigest` 40 字上限 + `…`）；`renderGuideText` 产出结构化文本，经 stage-08 `buildExplorationOptions` 的**可选参数 `hexagramGuide?`** 并入 **system 约束段**（缺省完全不影响，与 stage-05 `skills?` 同范式）。**卦象不进入 `converge` 的设定卡覆盖判据**（设定卡约束仍最高优先；`settingCardIds` 不变），偏离仍按 stage-08 规则标注。
- **角色宿命线（REV-004）**：v0.3 = **会话内存 + 用户写入 `setting_card`**（`kind="fate"`，复用既有编辑链路，**零迁移**；仅**新建**单一路径——REV-008 收敛）；**一次性提示卡**（不做跨章自动持续约束，避免角色命运漂移治理）；入卡后**自然进入**下一轮注入与覆盖判据（复用 stage-08 机制，零新增逻辑）。
- **落点/边界**：数据 `src/data/iching/`；纯函数 `src/orchestration/iching/`；UI 与开关 `src/features/exploration/`（复用推演 tab）。i18n `iching` 命名空间（**UI 文案双语，经文不译**）。

## [+] 术数引导「可选可关」设计（缺省关闭 + 运行时即时生效 + 关闭零副作用） (2026-10-10)

- **原则来源**：roadmap 备注「术数系统（易经/大六壬）应保持**可选、可关闭**，不得成为创作流程的强制前置」。
- **落地（stage-09）**：开关置于**推演面板内**（`src/features/exploration/`，`data-testid="iching-toggle"`），**缺省关闭**；持久化 `localStorage['fatequill.iching.enabled']`；不做任何流程的强制前置——关闭即**完全旁路**（起卦/宿命入口不可见）。
- **状态源单一（BUG-001 修复后定稿）**：`ichingEnabled` 落在 **`explorationStore` 单例**（`setIChingEnabled` 写 store + `localStorage`），`useIChingEnabled` 为 **store 薄封装**（API 不变、无本地 `useState`），开关 UI（`ExplorationPanel`）与消费侧（`useExploration`）**同源** → **运行时切换即时生效**（无需重启，见 `troubleshooting.md`）。**复用既有 store，零新增依赖**。
- **关闭零副作用（可判定验收）**：关闭时 `buildExplorationOptions` 输出与**基线逐字段一致**（空白 guide 视为未传、无空段残留），且 `buildGuideCard`/`renderGuideText` **零调用**；开启且已起卦 → system 段含卦象引导文本。
- **通用**：可插拔/可选能力应「**状态单例共享 + 缺省旁路 + 关闭零副作用可判定**」三件套；开关状态勿用多份独立 `useState`（会致跨组件不同步）。

## [+] 多声部对话编排（角色 Agent + persona 契约 + 旁白/对话分离，零迁移/无 IPC 增量） (2026-10-10)

- **定位**：兑现 M4「主要角色各自独立 Agent 生成台词，旁白与对话可分离创作与合并」——把「一个 Agent 写全文」升级为「**旁白 Agent + 每角色独立 Agent**」多声部协作（**stage-10 / v0.4 收官**）。
- **分层落点**：契约/装配/编排 `src/orchestration/dialogue/`（provider 无关，复用 `http_stream` **非流式收口**）；会话态 `src/store/dialogueStore.ts`（独立 `create`，内存）；UI `src/features/dialogue/`；角色档案 `src/features/characters/`；**无新增 IPC / 无迁移**（复用既有 `character` 五命令 + `chapter` 命令 + `http_stream`）。
- **persona 契约（零迁移方案 A）**：`character.profile` 为 **JSON 文本列**（`character` 表原为极简占位），最小字段 `{ identity, personality, speechStyle, goal, extra, major? }`（自由文本；`major: boolean` 供「仅主要角色」过滤）；`CHARACTER_PROFILE_KEYS` 为字段**单一来源**，`normalizeProfile`/`toProfileRecord`（`profile.ts`）做归一（缺失补空串、未知键剔除、异常安全）；装配模板 `buildCharacterAgentPrompt`（persona **完整注入本人 Agent**）；`buildNarratorAgentPrompt`（叙述者 persona，**仅 system 差异、同装配链**）。
- **旁白/对话分离创作**：条目模型 `{ id, kind: "dialogue"|"narration", speakerId?, speakerName?, content, orderIndex }`（**会话内存**，同 stage-08 `explorationStore` 范式）；旁白与角色台词**分别生成、分别编辑**；轮次**用户主导**（选中角色 → 生成 → 追加历史 → 可反复）；「导演式自动编排」留待后续。
- **产物与合并**：格式单一规范（对话 `<p class="dialogue"><strong>{speakerName}</strong>：{content}</p>` / 旁白 `<p class="narration">…</p>`，样式由 CSS 承担）；`assembleDialogueHtml` 按 `orderIndex` 保序拼接（HTML 转义防注入）；合并**双路径**（主：新建下一章草稿无损 / 次：替换当前章 + 强制入池快照 + 单撤销；详见 `kb/patterns.md`）。
- **成本/并发**：复用 stage-08 `estimateCost` 范式（**参与角色数 × 输出上限**，**启动前显示**）；`runWithConcurrency`（默认 3，超限排队，乱序归位，单项失败不抛穿）；`selectParticipants({ majorOnly })` 按 `profile.major` 过滤。
- **评审衔接（可选）**：`review-bridge.ts` 对齐 stage-06 `ReviewInput`（**不新增评估器、不改 stage-06 契约**）；「千人一腔」判据与 stage-06 `humanity`「真人感」**互认**（登记 `docs/review-rubric.md` §4.1）。
- **与 stage-11 边界**：本阶段只**交付 persona 装配输入契约**（Agent 仅依赖 `profile` 约定字段）；stage-11 的设定分级**在该契约之上**结构化，**不回改本阶段**。

## [+] 上下文隔离白名单（防串味：本人 persona 完整 + 公共场景 + 公共对话历史 + 他人公开身份摘要） (2026-10-10)

- **背景（本阶段核心约束）**：「多声部」要求角色 Agent 之间**不共享私有上下文**，但**对话历史（他人已说台词）必须共享**（否则无法接话）——「公共/私有」二分需精确化（stage-10 T5，REV-001 high 定稿）。
- **白名单（显式化）**：每角色 Agent 输入 = **本人 persona（完整）** + **公共场景** + **公共对话历史**；**不含他人 persona 全文**（可含他人**公开身份一行摘要**）。
  - **可共享**：场景设定（设定卡）、已定稿对话 `{speaker, content}`、旁白、他人**公开身份摘要**。
  - **私有（不共享）**：他人 persona 细节、内心独白、秘密。
- **场景上下文四构成**：设定卡（经 stage-05 装配）+ 前章末尾 / 当前章正文 + 用户**场景指令** + **公共对话历史**（结构化）；由 `buildPublicContext({ settingCards, previousChapterTail, sceneInstruction, history })` **单源**产出。
- **装配入口（单一白名单入口）**：`buildCharacterAgentInput({ selfProfile, publicContext, others })` → `{ system, user }`（system=本人 persona 完整；user=公共上下文 + `【在场角色（仅公开身份）】他人（公开身份）：{summary}` 小节）；`toCharacterOptions`/`toNarratorOptions`/`generateBatch` **只经白名单装配**（杜绝调用方绕过传全量角色列表）。
- **公开身份摘要**：`buildPublicSummary(profile, fallbackName)` 仅取 `identity`（缺省回退角色名），**私有字段一律不参与**。
- **判据（可判定，非语义）**：自动判据 = **装配层 prompt 不含他人私有**（构造「角色 A persona 含秘密 X」→ 断言角色 B 的 `system+user` 不含 `X`）；**产出文本语义符合度**（「千人一腔」「符合人设」）走 stage-06 评审**人工协验**，**不在装配层断言**。
- **生产接线（BUG-001 教训）**：声明白名单后须核验**生产可达**——`useDialogue` 经 `useSceneContext` 装载四块、调 `context.buildPublicContext`（**单源**，见 `kb/troubleshooting.md`）；否则白名单仅在单元函数层成立、生产零调用（场景上下文仅落地 1/4）。
