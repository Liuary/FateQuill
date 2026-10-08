# v0.1.0-stage-03 详细计划：AI 编排引擎骨架与模型配置

## 归属版本
v0.1（最小可用闭环）

## 目标
建立面向扩展、可插拔的 AI 编排引擎骨架，以及多 provider 模型配置与流式调用通道。
本阶段是「OpenFeel 式多 Agent 编排」思想在产品内的落点。

## 对应核心目的
- 目的 1：为章节生成/审查/推演/角色提供统一编排底座。
- 目的 2：为「多模型交叉判断」提供多 provider 与多模型调用能力（去 AI 味子系统的前置）。

## 前置依赖
v0.1.0-stage-01、v0.1.0-stage-02

## 技术约束（本阶段适用）
- AI SDK：Vercel AI SDK；provider 以适配器形式注册。
- 网络：**全部经 Rust 侧**（C-04），Rust 实现 SSE 流式中继；前端不经 WebView 直连。
- 密钥：**系统密钥链**（`keyring` / `tauri-plugin-stronghold`），不入库/不入 Git（C-05）。
- **默认策略（已确认）**：v0.1 默认**单模型 + 单 Agent**；**仅云端 API**，本地推理（Ollama）**接口预留但不实现**。
- 状态隔离：生成流以事件/订阅形式暴露，前端消费侧不直接驱动编辑器（C-03，配合 stage-04/05）。
- i18n：设置页等 UI 文案走 i18n 双语（C-11）。
- 抽象克制（C-08）：Provider/Agent/Pipeline 抽象须有 ≥2 个真实实现或明确近期用例，否则不引入。

## 引擎设计要点
1. **ModelProvider 接口**：`chat/stream(options) → AsyncIterable<Chunk>`；实现：OpenAI 兼容、Anthropic 等（≥2 个）。
2. **Agent 角色定义**：`{ id, name, systemPrompt, modelRef, temperature, tools? }`，注册表可注册/替换。
3. **Pipeline**：由若干 Step 组成的可组合序列，Step 输入输出为结构化上下文；v0.1 只实现「单 Agent 生成」这一最小管线。
4. **ModelConfig**：多 provider、API Key、默认模型、温度等配置的持久化与读取。

## 任务表

| # | 任务 | 交付物 | 验收标准 | 依赖 |
|---|------|--------|----------|------|
| T1 | 定义 Provider/Agent/Pipeline/ModelConfig 类型与接口 | `orchestration/types.ts` + 注册表 | 类型编译通过；注册/解析有单元测试 | stage-01 |
| T2 | 实现 Rust SSE HTTP 中继命令 | `src-tauri` 中 `http_stream` 命令 | 前端经 IPC 可收到分块流；断流可关闭；错误可上报 | stage-01 |
| T3 | 实现 ≥2 个 ModelProvider 适配器 | openai-compatible、anthropic（或等价） | 可用 mock/录制回放测试流式输出 | T1,T2 |
| T4 | 实现模型配置模块（UI + 持久化） | 设置页（i18n 双语）：provider/Key/模型/温度；Key 存**系统密钥链** | 配置可保存、重载后生效；Key 不落库不入 Git；存于密钥链 | stage-02 |
| T5 | 实现最小 Pipeline「单 Agent 生成」 | pipeline runner + 单 Agent Step | 输入提示词→输出流，端到端测试通过 | T3 |
| T6 | 建立流式消费约定（增量 + 节流） | 订阅 API + 节流工具（≥50ms 合并） | 消费端可增量渲染，节流可测（合并次数符合预期） | T5 |

## 阶段验收标准（DoD）
- [ ] Provider/Agent/Pipeline 均可注册替换，新增一个 Provider 不需改引擎核心（代码审查 + 单测）。
- [ ] 前端无任何外部 HTTP 直连（C-04 审查通过）。
- [ ] 密钥经**系统密钥链**存储，不在 Git/数据库中（C-05 审查通过）。
- [ ] 流式输出经 Rust 中继可分块到达前端，节流生效可测（C-02）。
- [ ] 至少 2 个 provider 适配器通过录制/模拟测试。
- [ ] 默认单模型单 Agent、仅云端 API；Ollama 仅留接入位未实现（审查确认）。

## 风险与备注
- SSE 中断/重连、并发请求上限需在设计中明确；v0.1 可先支持单请求串行。
- 密钥存储已定稿为**系统密钥链**（跨平台后端差异需处理，如 Windows Credential Manager）。
- 本地模型（Ollama）已定稿为**v0.1 不实现**；Provider 抽象仅预留接入位（待确认项 #5 已关闭）。
