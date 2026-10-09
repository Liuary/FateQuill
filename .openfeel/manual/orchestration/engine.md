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
└── stream/             # 纯 TS 消费工具
    ├── async-queue.ts  # push/close/fail 异步队列（适配器与消费端复用）
    ├── throttle.ts     # ≥50ms 合并（可注入时钟）
    ├── subscribe.ts    # subscribeChunks 消费入口
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

## 测试基线（v0.1.0-stage-03）

- Vitest 63/63（含本模块）：registry 注册/解析、SSE 块解析、两适配器录制回放（拼接/终止/错误帧）、single-agent 端到端、throttle 合并分组、subscribe 总量守恒。
- Rust 41/41（中继侧）：`ensure_https`、`compose_headers`、`err_event` 脱敏、`relay`（分块/Done/CRLF/末块冲刷/abort/timeout）。
- 夹具 `tests/fixtures/`：4 份 SSE（各含分块/错误/终止帧）入库。

## 关联文档

- IPC 契约：`docs/ipc.md`（§6 事件流通道、§8 命令与错误结构）｜结构：`docs/structure.md`（§8 orchestration、§9 流式消费）
- 知识库：`.openfeel/kb/architecture.md`（ADR-001 / 可插拔引擎 / 流式通道）、`patterns.md`（EventSink / SSE 归一化 / 契约对齐 / AUTH_DENYLIST）
- 阶段计划：`.openfeel/plan/v0/stage-03/plan.md`
- 相关模块：`manual/core/model-config.md`（模型配置与密钥）、`manual/core/domain-storage.md`（领域基座）
