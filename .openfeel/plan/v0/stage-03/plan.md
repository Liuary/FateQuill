# v0.1.0-stage-03 详细计划：AI 编排引擎骨架与模型配置

> 修订：v2（2026-10-09，依据 REV-v0.1.0-stage-03 的 8 条审查意见修订，落实用户确认的架构裁决选项 A）。

## 归属版本
v0.1（最小可用闭环）

## 目标
建立面向扩展、可插拔的 AI 编排引擎骨架，以及多 provider 模型配置与流式调用通道。
本阶段是「OpenFeel 式多 Agent 编排」思想在产品内的落点。

## 对应核心目的
- 目的 1：为章节生成/审查/推演/角色提供统一编排底座。
- 目的 2：为「多模型交叉判断」提供多 provider 与多模型调用能力（去 AI 味子系统的前置）。

## 前置依赖
v0.1.0-stage-01、v0.1.0-stage-02（均已归档）。
stage-02 遗留 **REV-013/014** 并入本阶段首个 op 附带清理（见 T7）。

## 技术约束（本阶段适用，定稿）

### AI 调用层（定稿，修订 REV-001，用户确认）
- **v0.1 不引入 Vercel AI SDK**（`ai` 包降级为「后续可评估」）。数据面为：
  - **Rust 侧 provider 无关 SSE 中继**：`reqwest` + Tauri `Channel`，仅做「URL + headers + body → SSE 分块事件」**透明转发**，不含 provider 语义；
  - **前端自研协议适配器**：`ModelProvider` 适配器自行解析 openai-compatible 的 `data:` 行与 `[DONE]` 终止、anthropic 的 SSE 事件类型。
- **API Key 仅在 Rust 侧**从系统密钥链读取并拼装请求头，**永不下发前端**；前端只见 provider / 模型名等元数据。
- T3 交付物**不得依赖 `ai` 包**。详见大计划 §3.4 ADR-001 与 `.openfeel/dev/decisions.md` ADR-001。

### 密钥链（定稿，修订 REV-002）
- **定稿 `keyring` crate**（纯 Rust、直连 OS 凭据库：Windows Credential Manager / macOS Keychain / Linux Secret Service）。
- 否决 `tauri-plugin-stronghold`（加密保险库 + 口令解锁会话语义，对「存几条 API Key」过重，且引入额外交互复杂度）。
- 密钥条目命名约定：**`fatequill/{provider}/{label}`**。
- 密钥**不入库、不入 Git、不下发前端、不入日志**（C-05）。

### 流式通道（定稿，修订 REV-004）
- **Tauri `Channel` + `requestId`**：命令 `http_stream(request_id, url, headers, body, on_event: Channel<StreamEvent>)`。
- **`StreamEvent` 事件枚举**：`Chunk` / `Done` / `Error`（TS 类型定稿）。
- **取消**：命令 `abort_stream(request_id)` 持有 `AbortHandle`，支持断流关闭。
- 事件流通道约定自 `docs/ipc.md` §6「延后声明」**转正**并同步（详见 T2/T7）。

### 超时与重试（定稿，修订 REV-006）
- 连接/读取超时**可配置**，v0.1 默认 **connect 10s / read 60s**；超时映射错误 `Error{code:"TIMEOUT"}`。
- **v0.1 不做自动重试**（单 Agent 生成的重试由用户手动触发）。

### 错误与 Key 脱敏（定稿，修订 REV-007①）
- 中继命令错误上报**仅含 `{code, message, statusCode?}`**，**不含 URL query / headers / 请求体**。
- Key 在 Rust 侧拼装 headers 后**不进入任何日志或事件 payload**；单测断言错误 payload 不含 Key 字样。

### 分层与持久化
- **迁移 v2**（修订 REV-003）：新增 `src-tauri/migrations/0002_model_config.sql`（走 stage-02 确立的插件 migrations 数组追加 + `_sqlx_migrations` 幂等 + `include_str!` 单一来源）；表 `model_config(id, provider, label, base_url, model_name, temperature, is_default, created_at, updated_at)`，**不含 key 字段**（C-05）。
- 配置读写走 **db 模块 + IPC 命令**（沿用 stage-02 三段式 `src/domain/repositories/` → `src/ipc/` → `src-tauri/` 与错误结构）。配置表与密钥链条目的关联约定（config id ↔ keyring entry）写入 `docs/ipc.md`。
- **设置页落点 `src/features/settings/`**（修订 REV-008②），i18n 命名空间 **`settings`**（启用 stage-01 预留）。

### 流式消费归属（定稿，修订 REV-005）
- 本阶段 T6 只交付**纯 TS 的流订阅与节流工具**（`AsyncIterable<Chunk>` → 节流后可订阅流，含测试），**不建立任何 store**。
- **stage-05 的 `generationStore` 将订阅该工具输出**（接口预留声明写入 `docs/structure.md` 或独立 orchestration 文档）；`Chunk`/事件契约（含 `Error`/`Done`）以 TypeScript 类型定稿并列出。

### 其他
- **默认策略（已确认）**：v0.1 默认**单模型 + 单 Agent**；**仅云端 API**；本地推理（Ollama）**接口预留但不实现**。
- 状态隔离：生成流以事件/订阅形式暴露，前端消费侧不直接驱动编辑器（C-03，配合 stage-04/05）。
- 抽象克制（C-08）：Provider/Agent/Pipeline 抽象须有 ≥2 个真实实现或明确近期用例，否则不引入。

## 引擎设计要点
1. **ModelProvider 接口**：`chat/stream(options) → AsyncIterable<Chunk>`；实现：**openai-compatible、anthropic（自研 SSE 解析，≥2 个）**；不依赖 `ai` 包。
2. **Agent 角色定义**：`{ id, name, systemPrompt, modelRef, temperature, tools? }`，注册表可注册/替换。
3. **Pipeline**：由若干 Step 组成的可组合序列，Step 输入输出为结构化上下文；v0.1 只实现「单 Agent 生成」这一最小管线。
4. **ModelConfig**：provider 类型、模型名、base_url、温度、默认标记等**非密钥字段**持久化（`model_config` 表）；API Key 存 `keyring`。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 定义 Provider/Agent/Pipeline/ModelConfig 类型与接口 | `orchestration/types.ts` + 注册表 | 类型编译通过；注册/解析有单元测试；**不 import `ai` 包** | stage-01 |
| T2 | Rust 侧 provider 无关 SSE 中继（Channel 流式 + 取消 + 超时） | `http_stream(request_id,url,headers,body,on_event)` + `abort_stream(request_id)` + `StreamEvent{Chunk\|Done\|Error}` 类型 + `docs/ipc.md` §6 转正 | ①前端经 `Channel` 收到分块事件；②**断流可关闭**：mock server + abort 后服务端连接关闭 / 前端不再收到事件（可判定测试）；③超时映射 `Error{code:"TIMEOUT"}`；④错误 payload **不含 URL/headers/body/Key**（单测断言） | stage-01 |
| T3 | 实现 ≥2 个 ModelProvider 适配器（自研 SSE 解析）+ 样本夹具 | openai-compatible、anthropic 适配器；**SSE 样本夹具 `tests/fixtures/`（各 ≥1 份，含分块/错误/终止帧）** | 录制回放测试基于夹具通过；解析覆盖 `data:`/`[DONE]` 与 anthropic 事件类型；**不 import `ai` 包** | T1,T2 |
| T4 | 模型配置模块（UI + 持久化 + 密钥链）；迁移 v2 | 设置页 `src/features/settings/`（i18n `settings` 命名空间）；`0002_model_config.sql`；`keyring` 存取封装；`docs/ipc.md` 补 config↔keyring 关联 | 配置可保存、重载后生效；**v2 迁移幂等复验**；keyring **写入→读取→删除 roundtrip 测试**通过；**Key 不落库断言**（SQLite 文件无 Key 字符串）；设置页文案双语 | T2, stage-02 |
| T5 | 实现最小 Pipeline「单 Agent 生成」 | pipeline runner + 单 Agent Step | 输入提示词 → 输出流，端到端测试通过 | T3 |
| T6 | 流式消费工具（纯 TS 订阅 + 节流） | 订阅 API（`AsyncIterable<Chunk>` → 节流后可订阅流）+ 节流工具（≥50ms 合并）+ Chunk/事件 TS 契约 | 消费端可增量渲染；节流合并次数符合预期（可测）；**不建 store**；stage-05 订阅声明已记录 | T5 |
| T7 | stage-02 遗留清理（REV-013/014，并入首个 op，标 `(chore)`） | 补丁 | REV-013：`docs/ipc.md` 命令清单补齐 28 个 ordering 命令并一并维护新增流式命令；REV-014：`MIGRATION_FAILED` 加 `#[allow(dead_code)]` + 预留注释 | stage-02 |

## 阶段验收标准（DoD）
- [ ] **AI SDK 去向**：`package.json` 无 `ai` 依赖；前端无 `fetch`/`EventSource`/AI SDK 直连（C-04 工具化/审查）。（REV-001）
- [ ] Provider/Agent/Pipeline 可注册替换；**新增 Provider 仅需「新建适配器文件 + 注册表注册一行，`orchestration` 核心文件 `git diff` 为零」**。（REV-007②）
- [ ] 密钥经 **`keyring`** 存取（roundtrip 测试），不在 Git/数据库/前端错误与日志中（C-05）。（REV-002/007①）
- [ ] 流式经 `Channel` + requestId 到达前端；`abort_stream` 可关闭断流（mock 可判定）。（REV-004）
- [ ] 超时可配置（默认 connect 10s / read 60s）并映射 `TIMEOUT`；v0.1 无自动重试。（REV-006）
- [ ] 迁移 v2 `model_config` 幂等复验通过；表不含 key 字段。（REV-003）
- [ ] 至少 2 个 provider 适配器通过**基于夹具**的录制回放测试；夹具入库。（REV-006③）
- [ ] T6 为纯 TS 工具、不建 store；Chunk/事件契约类型定稿。（REV-005）
- [ ] 设置页落点 `src/features/settings/`，i18n `settings` 命名空间启用。（REV-008②）
- [ ] stage-02 遗留 REV-013/014 已清理。（REV-008①）

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「AI 调用层」+ 引擎设计要点 + T1/T3「不 import ai」+ 大计划 §2/§3.4 + ADR-001 |
| REV-002 | medium | ✅ | 技术约束「密钥链」定稿 `keyring` + 条目命名；T4 roundtrip/不落库断言 |
| REV-003 | medium | ✅ | 技术约束「分层与持久化」迁移 v2 + T4 交付物/验收 |
| REV-004 | medium | ✅ | 技术约束「流式通道」Channel+requestId+AbortHandle；T2 验收「断流可关闭」 |
| REV-005 | medium | ✅ | 技术约束「流式消费归属」纯 TS 工具、不建 store；T6 |
| REV-006 | low | ✅ | 技术约束「超时与重试」+ T2 超时验收 + T3 夹具交付物 |
| REV-007 | low | ✅ | 技术约束「错误与 Key 脱敏」+ T2 单测断言 + DoD 第 2 条 diff 口径 |
| REV-008 | low | ✅ | 前置依赖 + T7（REV-013/014）+ T4 设置页落点与 i18n 命名空间 |

## 风险与备注
- **Rust SSE 解析自研**：仅需覆盖 openai-compatible（主流兼容 API）与 anthropic 两种事件格式，量小可控；解析失败/未知帧需容错（忽略未知事件、错误帧映射 `Error`）。
- **流式取消**：串行阶段亦须支持「可关闭当前流」；`abort_stream` 需在连接生命周期内有效，避免资源泄漏。
- **密钥链跨平台**：Windows 为当前平台（Credential Manager）无 Secret Service 缺失问题；Linux 差异留待开源阶段处理。
- **Key 脱敏**：reqwest 错误可能含 URL；须在映射层剥离 query/headers/body 后才上报（单测守护）。
- **迁移纪律**：v2 迁移须遵守 stage-02 归档的插件内置 migrations 约定（`_sqlx_migrations` 幂等 + `include_str!` 单一来源），不得旁路。

## 待用户拍板
无（架构裁决选项 A 已确认；本阶段其余为技术性定稿）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T7（REV-013/014）清理**（标 `(chore)`）。
2. 文档同步：`docs/ipc.md`（§6 事件流通道转正、命令清单、config↔keyring 关联、错误结构）、`docs/structure.md`（stage-05 generationStore 订阅声明）、`kb/architecture.md`（ADR-001 与流式通道）、`kb/setup.md`（keyring 依赖）。
