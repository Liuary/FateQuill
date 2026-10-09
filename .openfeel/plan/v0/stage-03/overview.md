# v0.1.0-stage-03

## 目标

建立可插拔的 AI 编排引擎骨架（Agent 角色 / Model Provider / Pipeline）与模型配置模块；经 **Rust 侧 provider 无关 SSE 中继**（`reqwest` + Tauri `Channel`）与**前端自研协议适配器**完成流式调用，规避 CORS 并保证 API Key 零下发前端。
（v2：依据 REV-v0.1.0-stage-03 修订，落实架构裁决选项 A；见 `plan.md` 与 `.openfeel/dev/decisions.md` ADR-001。）

## 依赖

- v0.1.0-stage-01（已归档）
- v0.1.0-stage-02（已归档）
- 附带清理：stage-02 遗留 REV-013/014（并入本阶段首个 op）

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 清理 stage-02 遗留 REV-013/014（chore） | T7 | — |
| op-002 | 编排引擎类型、契约与注册表 | T1 | op-001 |
| op-003 | Rust 侧 SSE 中继：Channel 流式 + 取消 + 超时 + https-only | T2 | op-001 |
| op-004 | openai-compatible / anthropic 协议适配器与 SSE 夹具 | T3 | op-002、op-003 |
| op-005 | 模型配置持久化（迁移 v2）、密钥链与设置页 | T4 | op-003 |
| op-006 | 最小 Pipeline「单 Agent 生成」 | T5 | op-004 |
| op-007 | 流式消费工具：纯 TS 订阅 + 节流 | T6 | op-006 |

> 说明：T2（op-003）与 T1（op-002）无互相依赖，可并行；T4（op-005）依赖 T2；T3→T5→T6 串行。

### 定稿要点（摘要）
- **AI 层**：v0.1 **不引入 Vercel AI SDK**；Rust 侧 provider 无关 SSE 中继 + 前端自研 openai-compatible/anthropic 解析适配器；**Key 仅 Rust 侧从密钥链读取，不下发前端**（ADR-001）。
- **密钥链**：定稿 **`keyring` crate**，条目 `fatequill/{provider}/{label}`（否决 stronghold）。
- **流式通道**：Tauri **`Channel` + requestId + `AbortHandle`**；`StreamEvent{Chunk|Done|Error}`；`abort_stream` 可取消。
- **超时/重试**：默认 connect 10s / read 60s，映射 `TIMEOUT`；v0.1 不自动重试。
- **持久化**：新增**迁移 v2** `0002_model_config.sql`（表不含 key 字段）；配置↔keyring 关联写入 `docs/ipc.md`。
- **消费工具**：T6 仅交付纯 TS 订阅 + 节流工具（不建 store）；stage-05 `generationStore` 订阅其输出。
- **设置页落点**：`src/features/settings/`，启用 i18n `settings` 命名空间。

### schemer 落实结果
- op 拆分：7 个 op，首 op 并入 REV-013/014 清理（标 `(chore)`），见上表。
- **REV-009（stage-03）**：op-003 补「https-only / 授权头 Rust 侧合并覆盖 / 前端授权头丢弃」三约束（代码 + `docs/ipc.md §6`）。
- 文档同步落点：`docs/ipc.md §6` 事件流转正（op-003）+ config↔keyring 关联（op-005）、`docs/structure.md`（op-002 引擎结构 / op-007 stage-05 订阅声明）、`kb/architecture.md`（op-003/op-005）、`kb/setup.md` keyring（op-005）。
