# 目录结构约定（FateQuill / 命笔）

> 本文档为前端与后端的分层目录、路径别名、状态管理与 IPC 边界的**权威约定**。
> 归属阶段：v0.1.0-stage-01（T3）。后续阶段新增目录须在此登记。

## 1. 分层目录职责

| 目录                             | 职责                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/`                       | 应用入口与全局装配（`main.tsx`、`App.tsx`、i18n 初始化、Provider 等）                                                             |
| `src/components/`                | 应用级组合组件（自建）                                                                                                            |
| `src/components/ui/`             | shadcn/ui 源码组件（由 shadcn CLI 管理，落库为可编辑源码）                                                                        |
| `src/ui/`                        | 通用可复用 UI 层（布局、非 shadcn 组合组件）                                                                                      |
| `src/features/`                  | 面向用户的功能模块（按功能内聚）                                                                                                  |
| `src/features/editor/`           | 编辑器与大纲树（Tiptap 基础编辑器；同域功能模块；i18n `editor` 命名空间启用）                                                     |
| `src/features/review/`           | 审查 UI（权重配置 + 版本池回看；stage-06，**暂未接入 i18n**）                                                                     |
| `src/features/research/`         | 研究/采样工作台（多模型无限制创作采样 + 素材候选；stage-07 建立）                                                                 |
| `src/features/exploration/`      | 多温度并行推演（走向意向 → 分支推演 → 走向卡；stage-08 建立）                                                                     |
| `src/domain/`                    | 纯 TS 领域模型与业务规则（无 UI、无网络）                                                                                         |
| `src/data/iching/`               | 六十四卦只读静态数据（公有领域《周易》白文）+ **手写校验**（无第三方校验库；stage-09 建立）                                       |
| `src/orchestration/iching/`      | 起卦与解卦（`deriveHexagram` 朱熹七情形 / `castRandom`·`castManual` / `buildGuideCard` / `buildFateCard`；纯函数，stage-09 建立） |
| `src/orchestration/`             | Agent 编排引擎（可插拔）                                                                                                          |
| `src/orchestration/research/`    | 研究契约与采样调度器（**串行逐模型**；无预算裁剪 / 不触发审查 / 不进正文；stage-07 建立）                                         |
| `src/orchestration/exploration/` | 推演引擎契约（温度集与 per-provider clamp / 走向卡解析 / **并行 + 乱序归位**编排；stage-08 建立）                                 |
| `src/ipc/`                       | 前端 IPC 封装（`invoke` 包装）                                                                                                    |
| `src/store/`                     | 状态管理目录（Zustand 于 stage-04 接入）                                                                                          |
| `src/lib/`                       | 通用工具（如 `cn`）                                                                                                               |
| `src/locales/`                   | i18n 资源（zh-CN / en）                                                                                                           |
| `src-tauri/`                     | Rust 后端（网络 / 密钥 / SQLite 边界）                                                                                            |

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

## 4. 状态管理（`src/store/`，Zustand）

- **`editorStore`（stage-04 T2 接入）**：仅持**元状态** `currentNovelId` / `currentChapterId` / `saveStatus`（`saved`/`saving`/`dirty`/`error`）/ `lastSavedAt`；**不持有 ProseMirror 文档正文**（单一事实源在 Tiptap 实例）。
- **stage-05** 新增 `generationStore`（订阅 `src/orchestration/stream` 的 `subscribeChunks` 输出，见 §9）。
- **stage-06** 新增 `reviewStore`（`src/store/reviewStore.ts`）：**会话级版本池**（初版 + 重写轮次产物）+ 用户可调权重 + `autoRewrite`（默认开）/`maxRounds`；**不持正文**；与 `editorStore` / `generationStore` **各自独立 `create()`，不互相 setState**。
- **一章一实例（C-01）**：切章时 `key={chapterId}` 重挂载 Tiptap 实例（销毁旧、重建新），同一时刻实例数恒为 1。

## 5. IPC 边界

- 所有**外部 HTTP**、**密钥**、**SQLite** 访问**仅经 Rust 侧**（`src-tauri/`）；前端**只经 `@/ipc`** 封装的 `invoke` 调用后端。
- **SQLite 访问**：经 `tauri-plugin-sql` v2（**仅 Rust 侧**）+ 自定义 `#[tauri::command]`；前端**不安装/不 import** `@tauri-apps/plugin-sql`（REV-009）；db 位置 `sqlite:fatequill.db`（Tauri AppData）。
- 前端不得直接发起外部网络请求；IPC 封装的命令通道约定见 `docs/ipc.md`（T5 落地）。

## 6. `repositories`（接口）↔ `ipc`（实现）对应关系

三段式落点，组件只依赖**接口**，不感知命令名：

| 层   | 路径                        | 职责                                                                                                     |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| 接口 | `src/domain/repositories/*` | 纯 TS 仓储接口（仅依赖 `@/domain/models/*`，无实现细节、无 IPC 依赖）                                    |
| 实现 | `src/ipc/repositories/*`    | 实现上述接口，经 `@/ipc/client` 的 `invokeCommand` 调 Rust 命令，并做 snake_case 行 ↔ camelCase 模型映射 |
| 命令 | `src-tauri/src/commands.rs` | op-004 的 25 个 `#[tauri::command]`                                                                      |

- **一一对齐**：5 个实体仓储接口各含 `list/get/create/update/delete` 五个方法，与 25 个命令一一对应（REV-010），`get` 不得缺省。
- **就近过滤**：`list_*` 命令无过滤参数，`listByNovel` / `listByVolume` 在实现层按父 id 客户端过滤。
- **无 `src/infra/`**：不设 infra 层（YAGNI）；实现层即 `src/ipc/repositories/`。

## 7. 顺序与字数约定

- **`order_index`**：同一父级内**唯一且连续**（从 0 起）。移动/删除后在**事务内**重排（`src-tauri/src/db/ordering.rs` 的 `reorder_volumes` / `reorder_chapters` / `move_chapter`）。对应命令 `reorder_volumes` / `reorder_chapters` / `move_chapter`。
- **`word_count`**：**Rust 侧写入时统一计算回填**（`src-tauri/src/db/word_count.rs`），按 `content_format` 分支：`html` 去标签取文本、`tiptap-json` 遍历文本节点、`plaintext` 直接计数。
  - **计数单位 = 非空白字符数**（面向中文「字数」）。
  - **为近似值（REV-011）**：`html` 分支为**简易去标签 + 常用实体解码**（`&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`/`&nbsp;`），**未处理**属性值内 `>`、`<script>/<style>` 文本与未知实体；需精确字数时后续引入 HTML 解析器，或以 `tiptap-json` 文本节点遍历为准。
- **基准**：`src-tauri/src/db/bench.rs`（`#[cfg(test)]`）基于 seed（50 章 × 3000 字）验证「单次查询 < 100ms」；仅覆盖单查询路径，写路径（seed INSERT）耗时由 `--nocapture` 观测，不作门禁（REV-012③）。

## 8. orchestration 引擎结构（stage-03）

`src/orchestration/` 为与 UI/IPC 解耦的**可插拔 AI 编排引擎**（纯 TS，**不触网**——网络在 Rust 侧，见 §5 / `docs/ipc.md`）。

| 子结构        | 职责                                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`    | 契约：`Chunk` / `ChatMessage` / `ChatOptions` / `ModelProvider` / `ModelRef` / `Agent` / `PipelineStep` / `Pipeline`                           |
| `registry.ts` | 泛型 `Registry<T>` 与 `createRegistries()`（providers / agents / pipelines）                                                                   |
| `providers/`  | 自研 SSE 协议适配器（≥2 个），实现 `ModelProvider.stream()`                                                                                    |
| `agents/`     | Agent 角色定义与注册                                                                                                                           |
| `pipeline/`   | Pipeline 步骤与组合                                                                                                                            |
| `stream/`     | 流式消费工具（T6）                                                                                                                             |
| `review/`     | 审查评估（stage-06）：`Evaluator` 契约 / `Registry<Evaluator>` 注册表 / JSON 容错降级；含四维评估器（情节·世界观·合规·人文）与规则引擎、rubric |

- **审查评估落点（stage-06 REV-001）**：`src/orchestration/review/`——契约 `types.ts`（`ReviewDimension`/`EvaluationResult`/`ReviewInput`/`Evaluator`）、注册表与降级 `evaluator.ts`（`createEvaluatorRegistry`/`evaluateWithFallback`/`DEGRADED_SCORE`）、JSON 容错 `json.ts`（`extractJson`/`parseEvaluationJson`）；**复用引擎契约、不含 provider 语义**（`model`/`temperature` 由调用方从默认 `model_config` 提供）。

- **不引入 `ai` 包**（ADR-001 / DoD 1）：`orchestration` 任何文件不得 `import "ai"`。
- **扩展点（REV-007②）**：新增 Provider 仅需「新建适配器文件 + 在 `providers/register.ts` 注册一行」，核心文件（`types.ts` / `registry.ts` / `stream/**` / `pipeline/**`）**`git diff` 为零**。
- **授权头不入前端**：`ChatOptions.headers` 仅承载非 Key 头（Content-Type/Accept 等）；授权头由 Rust 侧注入（op-003）。
- **Pipeline 启用时点（REV-014②）**：`Pipeline` / `PipelineStep` 为**契约先行**；v0.1 仅实现最小单步（op-006 的 `GenerationStep`），**多步组合管线于 stage-06/08 启用**（届时 `Pipeline.steps` 泛型上下文细化）。

## 9. 流式消费工具（stage-03 T6）与 stage-05 订阅声明

`src/orchestration/stream/` 为**纯 TS** 流式消费工具集（不触网；网络在 Rust 侧）：

| 文件             | 职责                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| `async-queue.ts` | 极简异步队列（`createAsyncQueue`；适配器与 T6 复用）                             |
| `throttle.ts`    | 节流合并（`throttleChunks`；窗口默认 **≥50ms**，C-02；可注入时钟以便确定性测试） |
| `subscribe.ts`   | 消费入口（`subscribeChunks`；对 `Chunk` 序列施加节流）                           |

- **契约**：`Chunk = { delta: string }`（op-002 定稿）；消费端**增量渲染**。
- **不建 store**：本阶段**不创建任何 store**；`src/store/` 维持空目录（Zustand 于 stage-04 接入）。
- **stage-05 订阅声明**：**stage-05 的 `generationStore`（`src/store/`）将订阅 `subscribeChunks` 的输出**，本工具为其**上游**；编辑器消费侧不直接驱动（C-03），由 `generationStore` 承接流式状态。

## 10. 编辑器存储格式

- **`content_format = 'html'`**：编辑器保存用 `editor.getHTML()` → `chapter.content`；加载用 `editor.commands.setContent(html)`。**零迁移**（复用 stage-02 schema）。
- `word_count` 走 §7 的 `html` 分支（Rust 侧计算）。
- 落点：`src/features/editor/`（`RichTextEditor` / `ChapterEditor` / `useChapter` / `editor-extensions`）；`editorStore` 见 §4。

## 11. 编辑器性能基准口径与 editorStore 边界

- **性能基准（stage-04 T6）**：脚本入库于 `src/features/editor/perf/`（`seed.ts` / `editor-bench.ts` / `BenchPanel.tsx` / `README.md`）。
  - 指标：按键/插入 → dispatch → DOM 更新耗时的 **P95**；目标 **P95 < 16ms**（单章 5000 字）。
  - 环境：**真实 WebView**（`pnpm tauri dev` 的 BenchPanel）；**jsdom 无布局，不可用于延迟测量**。
  - 内存/实例：切 **20 章**后 `.ProseMirror` 实例数 **= 1**、堆增幅 **< 20%**；**IME 口径单独**。
  - 操作手册与实测记录见 `src/features/editor/perf/README.md`（真实 WebView 实测为**人工协验项**）。
- **`editorStore` 边界（单一事实源）**：`src/store/editorStore.ts` 仅持元状态（`currentNovelId`/`currentChapterId`/`saveStatus`/`lastSavedAt`），**不含文档正文**（无 `content`/`html`/`doc` 键）；边界由 `src/store/editorStore.boundary.test.ts` 守护。文档内容唯一事实源在 Tiptap 实例（见 §4）。

## 12. 生成面板与 generationStore（stage-05）

- **第三栏布局**：`WorkspaceLayout` 用 `grid-cols-[280px_1fr_minmax(0,320fr)]`（第三栏 = 生成面板）兑现 stage-04 预留。
- **落点 `src/features/generation/`**：`GenerationPanel.tsx`（**仅状态**面板，无预览）、`useGeneration.ts`（模式 A 接线）、`useGenerationAvailability.ts`（可用性/Key 引导）、`resolve-provider.ts`（由 `model_config` 构造适配器）、`build-chapter-options.ts`（装配 `ChatOptions`）。
- **`generationStore` 边界（`src/store/generationStore.ts`）**：元状态 `status('idle'|'streaming'|'done'|'error'|'aborted')` / `chapterId` / `requestId` / `progress.chars` / `error`，**不持正文**；与 `editorStore` **各自独立 `create()`，不互相 setState**（C-03）。失败/停止收敛态统一为 `idle` 且 `requestId=null`（REV-008）。
- **模式 A 流式直插**：`generationStore` 订阅 stage-03 `subscribeChunks` → 节流 → stage-04 `EditorController.appendChunk`；编辑器流式期间**零 React 重渲染**（C-03 Profiler 断言）。
- 生成流程**复用**现有 IPC（`http_stream`/`abort_stream` + 仓储命令），**不新增命令**（见 `docs/ipc.md`）。
- **设定卡面板（stage-05 T5）**：落点 `src/features/setting-cards/`（`SettingCardsPanel.tsx` / `SettingCardForm.tsx` / `useSettingCards.ts`）；第三栏以 **tab** 承载「生成 / 设定卡」（`WorkspaceLayout`）；CRUD 复用 stage-02 设定卡仓储（`list_setting_cards`/`create_setting_card`/`update_setting_card`/`delete_setting_card`），**不新增 IPC 命令**；设定卡与生成上下文（`buildChapterGenerationOptions` 的 `ChapterSettingCard`）共用同一仓储 `repositories.settingCard`。

## 13. 审查、版本池与命令面（stage-06 T3）

- **加权评分（纯函数）**：`src/orchestration/review/aggregate.ts` —— `weightedTotal(results, weights) = Σ(score×weight)/Σweight`（**仅计已评审且权重 > 0 的维度**，归一至 0–100；缺维 / 零权不参与）；`DEFAULT_WEIGHTS` 四维平衡；用户可调权重**改变总分与排序**。
- **版本池（`src/store/reviewStore.ts`）**：`ReviewVersion { id, label, content, round, results, totalScore }`；`addVersion` 按当前权重算总分，`setWeights` **重算全部版本总分**，`setActive` 选中待采纳版本；非最优版本**保留在池中可回看**；`clear()` 清空版本池与选中态（保留权重/开关）。
- **审查 UI 落点**：`src/features/review/` —— `ReviewPanel.tsx`（四维分数/理由 + 改判 + 触发重写 + 自动重写开关 + 人工裁决提示）、`VersionList.tsx`（版本对比：加权总分降序 + 回看 + 采纳）、`useReview.ts`（编排：`runReview`/`rejudge`/`triggerRewrite`/`adopt`）、`WeightConfig.tsx`（四维权重输入 → `setWeights`；展示按加权总分的版本排序）。
- **第三栏 tab（stage-06 T5）**：`WorkspaceLayout` 第三栏以 **tab** 承载「生成 / 设定卡 / **审查**」（`review` tab → `ReviewPanel`）；i18n 新增 `review` 命名空间（zh-CN / en 同步）。

## 14. 研究/采样（stage-07 T1）

- **落点**：`src/orchestration/research/`（契约与调度器：`types.ts` 的 `MaterialCandidate` / `SamplingModel`、`sampler.ts` 的 `buildSamplingMessages` / `runSampling`）与 `src/features/research/`（`ResearchWorkbench.tsx` 工作台、`useSampling.ts` 编排）；i18n `research` 命名空间；入口在 `App.tsx` 视图切换（工作区 / 研究 / 设置）。
- **采样「无限制」边界（REV-002）**：**不触发自动审查**、**不自动保存**、**不做预算裁剪**（不引用 `PROMPT_BUDGET` / `buildChapterPrompt`）；产出**仅入素材候选**（`researchStore.candidates`，会话内存），**绝不进编辑器正文 / 不落 `chapter`**。
- **配置来源**：列出**全部 `model_config`**，用户**勾选 ≥1**；Key 缺失（`keyringExists=false`）→ 禁用采样 + 引导「设置」。
- **调度形态**：**串行逐模型**；持 `AbortController` 支持**停止采样**（模型边界 / 流循环内检查，已采集候选保留）。
- **通道单一来源（REV-016②）**：`MaterialSourceType` 定义于 `src/domain/models/material.ts`，`orchestration/research` 引用之（采样候选自带 `sourceType=multi_model_creation`）。
- **闭环回注与度量（stage-07 T6）**：装配器 `src/orchestration/prompts/chapter-generation.ts` 增 `ChapterPromptInput.skills?`（`PromptSkill { title, rule }`；拼入 **system**，预算桶 **≤500 字**，**缺省向后兼容**，超总预算时最后削）；`features/generation` 在生成前加载 skill 并透传；度量实验落点 `src/features/research/experiments/`（`samples/*` 固定样本集 ≥3 篇、`run-experiment.ts`、`report.md`——真机执行由用户 / feel-tester 协验，报告含**数据状态**字段，未执行前**不得填分数**）。
- **`EditorController` 命令面**：`appendChunk(text, options?)`（增量**追加**语义不变）/ `flushPending()` / **`replaceContent(html)`**（整章替换 = **单条撤销历史**，供审查采纳落地）/ `dispose()`。**`replaceContent` 是前端 `EditorController` 命令面，非 IPC 命令**——正文替换**不新增 IPC**（见 `docs/ipc.md`）。

## 15. 多温度并行推演（stage-08 T1）

- **落点**：`src/orchestration/exploration/`（`temperature.ts` 温度集与 clamp、`types.ts` 走向卡/分支契约、`parse.ts` 走向卡解析与输出契约、`runner.ts` 并行编排）与 `src/features/exploration/`（`ExplorationPanel.tsx` / `TemperatureConfig.tsx` / `useExploration.ts` / `build-exploration-options.ts`）；`explorationStore`（**会话内存**，独立 `create`）；第三栏新增「推演」tab。
- **温度集**：默认 `{0.3, 0.7, 1.1}`，UI 可增删/调值并持久化 `localStorage['fatequill.exploration.temperatures']`；**per-provider clamp**（`openai-compatible [0,2]` / `anthropic [0,1]` / 未知 `[0,2]`），被 clamp 分支以 `effectiveTemperature` + `clamped` **显式标注**。首版**同模型多温度**（跨模型留待后续）。
- **输入**：复用 stage-05 装配（设定卡 + 前章末尾 + 预算裁剪）；**走向意向 → user 段**、**走向卡 JSON 契约 → system 段**。
- **输出**：走向卡 `{ summary, keyTurns, settingCardIds }`；**非流式收口**（聚合全文后解析 JSON，容错复用 `review/json` 的 `extractJson`）。
- **编排**：`runExploration` **并行**（默认并发 3）且**结果按输入顺序归位**（乱序完成不影响）；单分支失败置 `error` 不抛穿。
- **无新增 IPC**：复用 `http_stream`（§6）与既有仓储命令（见 `docs/ipc.md`）。

## 16. 易经卦象系统（stage-09）

- **落点**：
  - `src/data/iching/`：64 卦**只读静态数据**（公有领域《周易》白文；`excerpt` 口径见 `docs/iching-data.md`）+ **手写校验**（六条规则；**无第三方校验库**）。
  - `src/orchestration/iching/`（**纯函数**）：`deriveHexagram`（本卦/之卦/变爻 + **朱熹七情形**解读指引）、`zhuXiReading`、`readingVerses`、`castRandom`/`createSeededRng`/`castManual`、`buildGuideCard`/`renderGuideText`、`buildFateCard`。
  - `src/features/exploration/`：`IChingPanel`（随机/手动起卦 + 解读）、`FatePanel`（宿命提示 → 写入设定卡）、`useIChingEnabled`（**可选开关**，`localStorage['fatequill.iching.enabled']`，**缺省关闭**）。
- **可选可关**：**缺省关闭**；关闭时起卦/宿命入口**不可见**，且不构建卦象引导（**零调用零副作用**）；开启时引导文本并入推演 **system 约束段**（`buildExplorationOptions.hexagramGuide?`）。
- **不覆盖设定卡硬约束**：卦象引导**不进入 `converge` 的设定卡覆盖判据**（设定卡约束最高优先；`settingCardIds` 不变）。
- **IPC**：**无新增 Rust 命令**——卦象为**前端静态数据 + 纯函数**（见 `docs/ipc.md`）。
- **范围排除**：**大六壬**等其它术数**显式排除**，**留 stage-12** 评估（本阶段仅六十四卦）。
