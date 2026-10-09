# v0.6.0-stage-12

## 目标

**v0 收官**：大六壬（可选可关，手动月将起步）、**可续跑的无人值守全自动创作**（决策规则/冲突策略/熔断三层/迁移 v6 断点）、开源发布工程（bundle/许可/Release）、英文收口自动化。
（v2：依据 REV-v0.6.0-stage-12 按 v2 范式重写；见 `plan.md`。）

## 依赖

- v0.3.0-stage-09（卦象，硬，已归档）
- v0.5.0-stage-11（一致性，硬，已归档）
- v0.2.0-stage-07（skill 库注入，**软**）

## 遗留处置

> 以下三项由 **op-001**（`(chore)`）登记；**总清算表**见 [`clearance.md`](clearance.md)（BLOCKED 汇总 + M1~M6 判定骨架，**终稿于 op-008**）。

- stage-11 **REV-009**（`conflict_record.a_id/b_id` `ON DELETE CASCADE` → 关联设定卡删除时处置留痕静默消失）→ **三选一决策**：① `SET NULL`；② 删除前校验阻断；③ **文档声明**——**建议③**，**待用户拍板**；**op-008 落地**所选方案（登记见 op-001）。
- stage-10 **REV-007**（台词评审默认全四维对台词片段的适配性存疑）→ 归属 **stage-12 人工协验批处理 / 后续迭代**（本阶段**仅登记不做实现**）。
- **v0.2~v0.5 BLOCKED 总清算** → 「人工协验总清算表」（`clearance.md` §二：v0.1~v0.5 共 **12 项** BLOCKED，逐项登记闭合条件与归属）+ **M1~M6 达成判定**（§三，**骨架占位，终稿于 op-008**）；**不伪造闭合**。

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 遗留登记与总清算表 + 结构/IPC 文档回写 (chore) | T7（并入首 op） | — |
| op-002 | 大六壬系统：数据校验与课体引导 | T1 | op-001 |
| op-003 | 全自动创作编排：决策规则表与链路 | T2 | op-002 |
| op-004 | 熔断三层与迁移 v6 断点续跑 | T3 | op-003 |
| op-005 | 无人值守冲突策略：暂停/授权忽略留痕 | T4 | op-003、op-004 |
| op-006 | 发布工程：bundle、许可清单与 Release | T5 | op-001 |
| op-007 | 英文收口：键完整性与豁免清单 | T6 | op-002、op-003 |
| op-008 | 总清算终稿与 manual 文档 | T7（收尾） | op-002~op-007 |

> T1~T7 全覆盖：T7 拆为**首 op（chore，op-001：登记 + 清算骨架）** + **末 op（op-008：M1~M6 判定终稿 + manual）**（模块与判定依赖交付物完成，遵「不提前占位/不伪造达成」）。

### 定稿要点（摘要）
- **全自动**：决策规则表（推演择优/生成/审查阈值/重写≤2/降级收录/自动归档）；冲突默认**暂停+通知**、可授权**自动 `ignored` 继续**（留痕）；**熔断三层**（预算/连续失败/章数）；**迁移 v6** 断点落库 → **可续跑**。
- **大六壬**：**手动月将 + 时辰起步**（不引历法库）、公有领域白文（`docs/liuren-data.md`）、`liurenGuide?` 与易经**并列可选**、开关缺省关闭、零副作用。
- **发布**：`tauri bundle`（Windows nsis）+ `docs/dependency-licenses.md`（工具化）+ `CHANGELOG.md` + 版本号 `v0.6.0` 三处同步 + tag + GitHub Release。
- **英文收口**：`i18n-completeness.test.ts`（**en ⊇ zh-CN** 断言，CI 防回归）+ 豁免清单；新 UI `liuren`/`autopilot` 命名空间。
- **开关矩阵**：易经/大六壬/一致性注入独立可叠加、缺省关闭、关闭即基线；`dark` 恒不注入。

### 待用户拍板（建议默认）
① 历法=手动月将起步 ② 断点=迁移 v6 ③ 冲突=默认暂停+可授权忽略 ④ 平台=Windows 为主 ⑤ 熔断 K=3 ⑥ REV-009=文档声明。

### 需 schemer 落实
op 拆分（首 op 含遗留登记+总清算，标 `(chore)`）；迁移 v6 设计；IPC/事件盘点；文档回写；发布脚本（bundle CI/CHANGELOG/版本同步）。

### schemer 落实结果
- **op 拆分**：8 个 op（见上表）；**首 op op-001 `(chore)`** = 遗留登记（stage-11 REV-009 三选一 / stage-10 REV-007 归属）+ `clearance.md` 总清算骨架 + 结构/IPC 文档回写；**末 op op-008** = **M1~M6 达成判定终稿** + manual 终稿 + 开关矩阵。
- **迁移 v6 设计**：`0006_autopilot.sql` = `autopilot_run`（status/config_json）+ `autopilot_chapter`（state/score/degraded_reason/attempt，`UNIQUE(run_id,order_index)`）+ 索引；注册 `migrations.rs` v6；**幂等断言表数 10→12、`_sqlx_migrations` 5→6**。
- **IPC/事件盘点（据实）**：**大六壬 = 前端静态数据 + 纯函数**（**无新命令**，同 stage-09）；**全自动新增 5 命令**（`save/get/list_autopilot_run` + `save/list_autopilot_chapter` 断点）；**事件 = 前端编排器状态**（`autopilotStore`，**不新增 Rust 事件通道**）；**计数 §8.1 51→56 / 全仓 53→58**，**与实现同提交（op-004）**（op-001 仅占位声明，遵 kb「IPC 计数基数漂移」范式）。
- **发布脚本**：`scripts/sync-version.mjs`（纯 Node 零依赖，三处版本同步 `0.6.0`）+ `scripts/gen-licenses.mjs`（`license-checker`+`cargo license`）+ `.github/workflows/release.yml`（bundle job）+ `CHANGELOG.md`；**唯一新增依赖 `license-checker`（devDependencies，显式声明，不入 runtime）**。
- **文档回写**：`docs/structure.md` §19/§20/§21（开关矩阵）、`docs/ipc.md`（声明+计数+明细）、`docs/liuren-data.md`、`docs/dependency-licenses.md`、`CHANGELOG.md`、`manual/index.md` + `manual/features/{liuren,autopilot}.md` + `manual/orchestration/engine.md`。
- **收口纪律**（kb「生产不可达」清单）：每交付 op 含**生产调用非零/挂载断言**（大六壬/autopilot 面板 tab 挂载、引导注入生产路径）；开关**状态单源**（`liurenEnabled` 入 store，禁多份 `useState`）；`\|` 自检已排除（统一 `rg -n -e A -e B`）。
- **待拍板落点**：历法方案 b（op-002）；冲突策略默认暂停（op-005）；熔断 K=3（op-004）；平台 Windows 为主（op-006）；**stage-11 REV-009 建议③文档声明**（op-001 登记、op-008 落地）。
