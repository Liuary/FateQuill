# 模块手册：AI 编排引擎（orchestration/engine）

## 职责

FateQuill 的 AI 编排引擎：面向扩展、可插拔的 Provider / Agent / Pipeline 抽象，以及经 Rust 侧 SSE 中继的流式调用与前端消费工具。建立于 **v0.1.0-stage-03**，是「多 Agent 编排」思想在产品内的落点。

- **分层边界**：`orchestration` 为纯 TS 层，仅依赖 `@/ipc`（不直接触碰 Tauri/网络/store）。
- **数据面**：provider 无关的 SSE 中继在 Rust 侧（`http_stream`/`abort_stream`），前端自研协议适配器只解析 provider 语义（ADR-001）。
- **密钥边界**：API Key 仅在 Rust 侧从 OS 密钥链读取并拼装授权头，**永不下发前端**（C-04/C-05）。

## 目录结构 / 核心文件

```
src/orchestration/
├── types.ts            # 契约：Chunk / ChatMessage / ChatOptions / ModelProvider / Agent / PipelineStep / Pipeline
├── registry.ts         # 泛型 Registry<T> + createRegistries() → {providers, agents, pipelines}
├── index.ts
├── providers/          # 协议适配器（≥2）
│   ├── sse.ts          # provider 无关 SSE 事件块解析（parseSseBlock / parseSseStream）
│   ├── openai-compatible.ts  # data:/[DONE] 解析；StreamTransport 注入（默认 httpStream）
│   ├── anthropic.ts    # content_block_delta / message_stop / error 解析
│   ├── register.ts     # ★ 扩展点：新增 Provider 在此注册一行
│   └── index.ts
├── agents/             # Agent 角色定义（注册表可注册/替换）
├── pipeline/
│   ├── runner.ts       # runSteps / GenerationInput / GenerationStep（可组合签名）
│   ├── single-agent-step.ts  # 单 Agent 生成 Step
│   └── index.ts
├── stream/             # 纯 TS 消费工具
│   ├── async-queue.ts  # push/close/fail 异步队列（适配器与消费端复用）
│   ├── throttle.ts     # ≥50ms 合并（可注入时钟）
│   ├── subscribe.ts    # subscribeChunks 消费入口
│   └── index.ts
└── review/             # 审查评估（stage-06）：Evaluator 契约 / 注册表 / 四维评估器 / rubric / 合规规则 / rewrite / loop
    ├── types.ts        # ReviewDimension / EvaluationResult / ReviewInput / Evaluator
    ├── evaluator.ts    # EvaluatorRegistry（复用 Registry<T>）+ evaluateWithFallback（重试/降级）
    ├── json.ts         # extractJson / parseEvaluationJson（围栏/夹取/非法抛错）
    ├── rubric.ts       # 四维子维度 + buildReviewSystemPrompt（内联 rubric）
    ├── compliance-rules.ts  # 合规词表/正则（无 Token）+ scanCompliance
    ├── evaluators/     # llm-judge（非流式收口）/ plot / worldview / humanity / compliance
    ├── aggregate.ts    # weightedTotal 加权归一（纯函数）
    ├── budget.ts       # REVIEW_CONTENT_BUDGET / trimReviewContent（沿用生成装配预算）
    ├── rewrite.ts      # 反馈注入重写（非流式）
    ├── loop.ts         # runReviewLoop（上限 2 / 合规排除 / 入池不替换正文）
    ├── register.ts     # registerBuiltinEvaluators
    └── index.ts

research/              # 研究域（stage-07，provider 无关）：采样 / 交叉判断契约与算法
├── types.ts           # MaterialCandidate / SamplingModel / ModelExcerpts / CrossJudgeResult
├── sampler.ts         # buildSamplingMessages / runSampling（串行逐模型，可中止；不进正文/不审查/无预算）
├── cross-judge.ts     # extractFlavorExcerpts / mergeByExcerpt（verbatim 引文精确交集 + 命中分级）
├── tags.ts            # RESEARCH_TAGS_VERSION / 受控标签枚举 / isValidTag
└── index.ts

dialogue/              # 多声部对话（stage-10，provider 无关；非流式收口）
├── types.ts           # DialogueEntry / DialogueProfile / DialogueAgentInput / BatchLineResult
├── profile.ts         # PROFILE_TEXT_KEYS / normalizeProfile / toProfileRecord（与 features/characters 单一来源）
├── persona.ts         # buildCharacterAgentPrompt / buildNarratorAgentPrompt（角色/旁白 persona 段）
├── agents.ts          # 角色 / 旁白 Agent 定义注册
├── context.ts         # buildPublicContext（**白名单装配**：他人仅公开身份摘要 → 防串味）
├── assemble.ts        # assembleDialogueHtml（会话条目 → 章节 HTML，orderIndex 保序）
├── generate.ts        # generateLine / toCharacterOptions / toNarratorOptions / generateBatch
├── cost.ts            # estimateDialogueCost / selectParticipants（majorOnly 过滤）
├── concurrency.ts     # DEFAULT_DIALOGUE_CONCURRENCY=3 / runWithConcurrency（工作池）
├── review-bridge.ts   # assembleDialogueText / toDialogueReviewInput（**可选**对齐 stage-06 ReviewInput）
└── index.ts

src/ipc/stream.ts       # httpStream()：Tauri Channel 封装 + StreamEvent TS 契约（requestId 缺省生成，返回 abort）
tests/fixtures/*.sse    # SSE 录制回放夹具（openai-compatible / anthropic，各含分块/错误/终止帧）
```

## 核心 API / 约定

- **`ModelProvider`**：`{ readonly id; stream(options: ChatOptions): AsyncIterable<Chunk> }`；`Chunk = { delta: string }`。
- **注册表**：`Registry<T>` 提供 `register`（重复 id 抛错）/ `replace` / `resolve`（未注册抛错）/ `has` / `list` / `remove`。
- **扩展点（可判定）**：新增 Provider = 新建适配器文件 + `providers/register.ts` 注册一行；`types/registry/stream/pipeline` 核心文件 `git diff` 为零。
- **适配器可测性**：工厂接受可注入 `StreamTransport`（默认 `httpStream`；测试注入夹具回放），**禁「双重 as」强转**，由 tsc 保证契约对齐。
- **Pipeline**：`PipelineStep<In,Out>`；v0.1 仅 `createSingleAgentStep`（解析 Agent → Provider → 组装 messages → `provider.stream()`）；多步组合于 **stage-06/08** 启用。
- **消费工具**：`throttleChunks`（默认 50ms 合并、源结束冲刷）、`subscribeChunks`；**不建 store**，stage-05 `generationStore` 订阅其输出。
- **无 AI SDK**：`orchestration` 任何文件不得 `import "ai"`（ADR-001）。
- **审查评估（stage-06）**：`src/orchestration/review/` —— `Evaluator` 契约 / `Registry<Evaluator>` 注册表（`evaluateWithFallback` 有限重试 + 降级不抛穿）/ 四维评估器（剧情·世界观·真人感为 LLM-as-judge，经 `ModelProvider` **非流式收口**；合规为**规则引擎**，无需 Token）/ rubric（`REVIEW_RUBRIC_VERSION`）/ 加权归一 `weightedTotal` / `runReviewLoop`（自动重写上限 2，**合规低分仅人工裁决**，产物入池**不自动替换正文**）。
- **提示模板 `skills` 扩展（stage-07 T6）**：`prompts/chapter-generation.ts` 的 `ChapterPromptInput.skills?`（`PromptSkill { title, rule }`）拼入 system 段（预算桶 **≤500 字**，计入总预算）；**缺省向后兼容**；生成链路经 skill 仓储加载并透传（`src/features/research/experiments/` 为该扩展的度量实验落点）。
- **起卦解卦（`iching/`，stage-09）**：`deriveHexagram(lines)`（本卦/之卦/变爻 + **朱熹七情形**解读指引）、`zhuXiReading`、`readingVerses`、`castRandom`/`createSeededRng`/`castManual`、`buildGuideCard`/`renderGuideText`、`buildFateCard`——**纯函数**（无 IO、无依赖），数据取自 `src/data/iching/`；引导文本经 `buildExplorationOptions.hexagramGuide?` **可选**并入推演 system 段（缺省向后兼容）。
- **研究域（stage-07）**：`src/orchestration/research/`（provider 无关）——采样调度 `runSampling`（**串行逐模型**，产出仅入会话候选 `MaterialCandidate`，**不进正文/不自动保存/不触发审查/无预算裁剪/跳过合规**）、交叉判断 `extractFlavorExcerpts`（复用 `review/json` 的 `extractJson`）与 `mergeByExcerpt`（**verbatim 引文精确交集** + 命中分级）、受控标签枚举 `tags.ts`。研究采样与生成路径**故意解耦**（详见 `manual/features/research.md`）。
- **多声部对话（`dialogue/`，stage-10）**：`src/orchestration/dialogue/`（provider 无关，**非流式收口**）——`profile` 契约（`normalizeProfile` / `toProfileRecord`）、`persona` 装配、角色/旁白 Agent、**`context` 白名单**（他人仅公开身份摘要 → **防串味**）、`assembleDialogue`（条目 → HTML，`orderIndex` 保序）、`generateLine` / `generateBatch`、成本 `estimateDialogueCost` + `selectParticipants`、并发 `runWithConcurrency`、**`review-bridge`（可选对齐 stage-06 `ReviewInput`，不新增评估器）**。会话态在 `src/store/dialogueStore.ts`（内存），UI 在 `src/features/dialogue/`；**无新增 IPC / 无迁移**（详见 `manual/features/dialogue.md`）。

## 测试基线（v0.1.0-stage-03）

- Vitest 63/63（含本模块）：registry 注册/解析、SSE 块解析、两适配器录制回放（拼接/终止/错误帧）、single-agent 端到端、throttle 合并分组、subscribe 总量守恒。
- Rust 41/41（中继侧）：`ensure_https`、`compose_headers`、`err_event` 脱敏、`relay`（分块/Done/CRLF/末块冲刷/abort/timeout）。
- 夹具 `tests/fixtures/`：4 份 SSE（各含分块/错误/终止帧）入库。

## 关联文档

- IPC 契约：`docs/ipc.md`（§6 事件流通道、§8 命令与错误结构）｜结构：`docs/structure.md`（§8 orchestration、§9 流式消费）
- 知识库：`.openfeel/kb/architecture.md`（ADR-001 / 可插拔引擎 / 流式通道）、`patterns.md`（EventSink / SSE 归一化 / 契约对齐 / AUTH_DENYLIST）
- 阶段计划：`.openfeel/plan/v0/stage-03/plan.md`
- 相关模块：`manual/core/model-config.md`（模型配置与密钥）、`manual/core/domain-storage.md`（领域基座）、`manual/features/dialogue.md` / `manual/features/characters.md`（多声部对话与角色档案，stage-10）
