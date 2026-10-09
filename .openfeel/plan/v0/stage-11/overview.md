# v0.5.0-stage-11

## 目标

实现设定分级归档与一致性引擎：**手动**归档本章新设定并按 `main`/`dark`/`short`/`temp` 四级分级（与 `kind` 正交），冲突可检出（L1 规则 + L2 语义）并可处置；**分级注入**且**暗线保密**。
（v2：依据 REV-v0.5.0-stage-11 按 v2 范式重写；见 `plan.md`。）

## 依赖

- v0.1.0-stage-05（生成产物，硬，已归档）
- v0.4.0-stage-10（角色设定 / persona 契约，硬，已归档）

## 遗留处置

> 以下三项由 **op-001**（`(chore)`）登记；本阶段**仅登记不实现**。

- stage-10 **REV-007**（台词评审维度子集：`DIALOGUE_REVIEW_DIMENSIONS = REVIEW_DIMENSIONS` 对台词片段的「剧情/世界观」维度适配性存疑）→ 归属 **stage-12 / 人工协验批处理**（仅登记，本阶段无耦合）。
- stage-08 **REV-009**（版本池快照持久化路线）→ **v5 不纳入**（迁移 v5 范围仅 `setting_card.tier` + `conflict_record`；两域不同），**独立跟踪**。
- v0.2~v0.4 人工协验 **BLOCKED** → **保持跟踪**（真实 Key E2E / 真机 WebView 冒烟 / T6 skill 注入度量回填 / 编辑器 perf 实测；全部闭合后 M2 正式达成）。

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T6）见本目录 `plan.md`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 遗留登记与结构/IPC 文档回写（stage-10 REV-007 + stage-08 REV-009 联动）(chore) | T6（并入首 op） | — |
| op-002 | 分级模型与迁移 v5（tier 列 + conflict_record） | T1 | op-001 |
| op-003 | 自动归档抽取器（evidence 回查 + 名称去重） | T2 | op-002 |
| op-004 | 一致性校验器（L1 规则 + L2 语义） | T3 | op-003 |
| op-005 | 冲突面板与处置 + conflict_record 落库 | T4 | op-004 |
| op-006 | 设定注入生成与暗线保密 | T5 | op-004 |
| op-007 | 遗留登记收尾与 manual 文档 | T6（收尾） | op-002~op-006 |
| op-008 | 修复归档面板与 tier 表单生产不可达（BUG-001）(fix) | T1/T2（补） | op-003、op-005 |

> T1~T6 全覆盖（`plan.md` 任务表为 T1~T6）：T6 拆为**首 op（chore，op-001）** + **末 op（文档终稿，op-007）**（模块建立后方可写详文，遵「未建立模块不提前占位」）。

### 定稿要点（摘要）
- **分级模型**：四级（`main`/`dark`/`short`/`temp`）+ 生命周期 + 冲突严格度；与 `kind` **正交**（不扩 kind）；**迁移 v5** `ALTER TABLE setting_card ADD COLUMN tier ... DEFAULT 'short'`。
- **归档抽取**：**LLM + `evidence` 原文回查**（防幻觉）、**名称去重**、**手动「归档本章」**、候选入**待确认队列**（不入库直达）。
- **一致性引擎**：L1 规则（零幻觉）+ L2 语义（建议）；报告 `{aId,bId,type,evidence,severity}`；误报率以 **≥3 章预埋冲突标注样本集**验收（阈值 X 待拍板）。
- **注入与暗线**：白名单 `{main,short}`，**排除 `dark`**（装载侧过滤）；预算不变；单测 + 可选效果级对照。
- **冲突处置与持久化**：动作集（改分级/跳转/标记误报/忽略）；候选=会话内存、冲突记录=`conflict_record` **落库**；IPC 增量盘点更新 `docs/ipc.md`。
- **i18n** `consistency`。

### 待用户拍板（建议默认）
① 阈值 X=≤20%（建议）② 样本≥3 章预埋冲突（建议）③ 持久化=迁移 v5（建议）④ 触发=手动归档本章（建议）⑤ 暗线完全排除正文注入（建议）。

### 需 schemer 落实
op 拆分（首 op 含遗留登记，标 `(chore)`）；迁移 v5 设计；IPC 命名与计数；文档回写（`docs/structure.md`/`docs/ipc.md`/`docs/review-rubric.md`/`manual/index.md`）。

### schemer 落实结果
- **op 拆分**：7 个 op（见上表）；**首 op op-001 `(chore)`** = 遗留登记（stage-10 REV-007 归属 / stage-08 REV-009 × v5 联动声明）+ 结构/文档回写骨架；**末 op op-007** = manual 终稿 + 样本/数据状态收尾。
- **迁移 v5 设计**：`0005_setting_tier_conflict.sql` = `ALTER TABLE setting_card ADD COLUMN tier TEXT NOT NULL DEFAULT 'short' CHECK(...)` + `conflict_record` 表 + 索引；注册 `migrations.rs` v5；**幂等断言**表数 **9→10**、`_sqlx_migrations` **4→5**、`tier` 列存在（`tier` 带 `CHECK`，若 SQLite 报不支持则退化应用层校验）。
- **IPC 盘点（据实）**：`setting_card` 命令**签名扩展、命令数不变**（+`tier?` / 过滤）；**新增 6 命令**——冲突 5（`save/list/get/resolve/delete_conflict_record`，op-005）+ 归档批落库 1（`save_extracted_settings`，op-003）；**计数 §8.1 `45→51`、全仓 `47→53`**。
- **文档回写**：`docs/structure.md` §18、`docs/ipc.md`（声明+计数+明细）、`docs/review-rubric.md` §4.2（一致性 vs 世界观边界）、`manual/index.md` + `manual/features/consistency.md` + `manual/orchestration/engine.md`。
- **边界纪律**：零新增依赖、**v5 不含**版本池快照持久化（REV-009 独立跟踪）、stage-10 契约仅可选扩展（不回改）；`\|` 自检已排除（统一 `rg -n -e A -e B`）。
- **待拍板落点**：误报率阈值 X（op-004 以 `MISREPORT_THRESHOLD=0.2` 占位）；注入开关语义（op-006 安全优先决策：生产恒排 `dark`）。
- **修复闭环（op-008）**：BUG-001（**high**）——`ArchivePanel` 未接入 UI（`runExtraction`/`save_extracted_settings` 生产零调用）+ `SettingCardForm` 无 `tier`；修复=`WorkspaceLayout` consistency tab 双区挂载 `ArchivePanel`+`ConsistencyPanel`，`SettingCardForm`/`useSettingCards` 增 `tier` 四级下拉并贯通，补「生产挂载/落库非零 + 归档端到端 + 表单 tier」断言，由 feel-tester 回归复验（high 级）。
