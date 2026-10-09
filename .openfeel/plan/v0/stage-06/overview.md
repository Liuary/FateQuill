# v0.2.0-stage-06

## 目标

建立多维审查流水线：对生成文本按「剧情 / 世界观 / 合规 / 真人感」四维审查打分（LLM-as-judge + 合规规则引擎），支持自动判定与用户审查，不通过触发重写回路（上限 2、默认开、可关），多版本加权择优采纳。
（v2：依据 REV-v0.2.0-stage-06 修订，详度对齐 v0.1 各阶段；见 `plan.md`。）

## 范围

- 本阶段 = **M2 审查 + 重写半边**；「去 AI 味素材库/研究」半边归 **stage-07**。

## 依赖

- v0.1.0-stage-03（引擎，硬，已归档）
- v0.1.0-stage-05（生成闭环，硬，已归档）
- v0.1.0-stage-04（编辑器，**软**）：T3 采纳扩展 `EditorController.replaceContent`
- 附带清理：stage-05 遗留 REV-009（perf + 冒烟人工协验）并入本阶段首个 op 闭合

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 闭合 stage-05 遗留 REV-009 人工协验（chore） | T7 | — |
| op-002 | Evaluator 接口、注册表与评分契约 | T1 | op-001 |
| op-003 | 四维评估器实现（LLM-as-judge + 合规规则引擎）与 rubric | T2 | op-002 |
| op-004 | 加权评分、版本池择优与 EditorController.replaceContent | T3 | op-003 |
| op-005 | 重写回路：反馈注入 / 上限 2 / 入池不自动替换 | T4 | op-004 |
| op-006 | 用户审查界面：四维面板 + 版本对比与采纳 | T5 | op-005 |
| op-007 | 审查结果持久化：迁移 v3 + CRUD + IPC | T6 | op-006 |

### 定稿要点（摘要）
- **Evaluator（落点 `src/orchestration/review/`）**：剧情/世界观/真人感 = LLM-as-judge（经 stage-03 `ModelProvider`，**非流式收口** + JSON 降级）；合规 = 规则引擎（`compliance-rules.ts` 词表可配置）+ 可选 LLM 复核；接口 `evaluate(input) → EvaluationResult{score,reasons,findings?}`；LLM 维夹具回放测试。
- **迁移 v3**：`0003_review.sql` → `review_record(id, chapter_id, round, dimension, score, reasons_json, created_at)`；关联语义 `chapter_id + round`；幂等复验。
- **多版本**：版本池 = 初版 + 重写产物（会话级）；择优=加权总分；采纳经 **`replaceContent(html)`**（单条撤销）。
- **rubric**：`docs/review-rubric.md`（版本化、内联 prompt）；合规低分**仅提示人工裁决**。
- **重写**：上限 **2**、注入上轮反馈、产物入池不自动替换、默认开可关。
- **成本**：复用默认模型、非流式、沿用预算裁剪；Token 提示。

### schemer 落实结果
- op 拆分：7 个 op（首 op 闭合 REV-009 人工协验，标 `(chore)`），见上表。
- **REV-009 处置**：op-001 —— perf 实测回填 `perf/README.md` + 冒烟检查单 `docs/smoke-check-v0.1.md` 填写（**人工协验项**，真实 WebView），使 M1 协验闭合。
- **新增依赖：无**（复用 stage-03/04/05 既有依赖）。
- 文档同步 4 处：`docs/review-rubric.md`（op-003 新建）、`docs/ipc.md`（op-004 `replaceContent` 命令面澄清 + op-007 review 命令，计数 36→38）、`docs/structure.md`（op-002/004/006）、`manual/index.md` + `manual/features/review.md` + `manual/orchestration/engine.md`（op-007）。
