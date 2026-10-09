# v0.3.0-stage-09

## 目标

实现易经卦象系统：六十四卦/爻变建模（**公有领域《周易》经文**），**可选可关**地作为推演引导输入，并映射角色宿命（写入设定卡）。**大六壬显式排除**（留 stage-12）。
（v2：依据 REV-v0.3.0-stage-09 按 stage-07/08 v2 范式重写；见 `plan.md`。）

## 依赖

- v0.3.0-stage-08（推演引擎承接方，硬，已归档）：T5 复用 `buildExplorationOptions` 装配点

## 遗留处置

- stage-08 **REV-009**（快照会话内存级 → 持久化路线）→ 本阶段**登记路线**（不实现）。
- stage-08 **REV-010**（abort 语义/新章落卷末）→ 归属 **stage-10 或人工协验批处理**。
- v0.2 4 项人工协验 **BLOCKED** → 保持跟踪、不阻塞、闭合后 M2 达成。

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T6）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 六十四卦数据建模与手写校验 | T1 | — |
| op-002 | 起卦与朱熹变爻推导 | T2 | op-001 |
| op-003 | 卦象引导卡：剧情映射 | T3 | op-001、op-002 |
| op-004 | 角色宿命映射与写入设定卡 | T4 | op-003 |
| op-005 | 接入推演引擎：hexagramGuide 可选注入与开关 | T5 | op-003、op-004 |
| op-006 | 遗留登记与文档回写 | T6 | op-005 |

> 说明：`useIChingEnabled`（localStorage，缺省关闭）随 T4（op-004）引入（供 T4/T5 共用），op-005 补开关 UI 与装配注入；任务计划中 T1~T6 全覆盖（T6 为遗留登记 + 文档回写）。

### 定稿要点（摘要）
- **数据**：`src/data/iching/`（TS 常量 + zod 校验），**公有领域经文**、**无新迁移**；校验规则 64/384/唯一/8×8/King Wen 1~64/二进制映射。
- **算法**：**朱熹变爻规则**（`deriveHexagram` 纯函数）；起卦 = **随机（可注入种子）+ 手动**；**时间起卦推迟**（不引入历法依赖）。
- **引导卡**：`{hexagramName,judgmentDigest,changingLineReadings,plotHints,fateHints}`；经 **`buildExplorationOptions.hexagramGuide?`** 并入 system 段（缺省兼容）；**不进入设定卡覆盖判据**。
- **宿命**：会话内存 + **用户写入设定卡**（零迁移）、一次性提示卡。
- **可选可关**：推演面板内开关、缺省关闭、`localStorage` 持久化、关闭零副作用（基线快照一致）。
- **i18n** `iching`（经文不译）；**无新增 IPC**（前端静态数据）。

### 待用户拍板（建议默认）
① 变爻流派=朱熹（建议）② 时间起卦=v0.3 推迟（建议）③ 宿命存储=会话内存+挂设定卡（建议）。

### schemer 落实结果
- op 拆分：6 个 op（T1~T6 全覆盖，见上表）；`useIChingEnabled` 开关随 T4 引入（供 T4/T5 共用）。
- **REV-006 裁决**：**不引入 `zod`**——T1 改用**手写类型守卫**（`src/data/iching/validate.ts`，零新增依赖，遵守 C-08）。
- **跨阶段修改**：op-005 扩展 stage-08 `buildExplorationOptions` 增 `hexagramGuide?`（并入 system 段、缺省向后兼容），**回写 `.openfeel/manual/features/exploration.md`**，既有 stage-08 测试回归通过。
- **文档同步**：`docs/iching-data.md`（op-001 新建）、`docs/structure.md`（op-001/006）、`docs/ipc.md`（op-006 无新增命令）、`docs/build-size-report.md`（op-006 数据体积）、`manual/index.md` + `manual/features/iching.md` + `manual/orchestration/engine.md`（op-006）。
- **遗留处置**：stage-08 REV-009 持久化路线登记 / REV-010 归属声明（op-006）；v0.2 4 项人工协验 BLOCKED 保持跟踪。
- **无新增依赖**、**无新增 Rust 命令**（前端静态数据）；可选可关、关闭零副作用。
