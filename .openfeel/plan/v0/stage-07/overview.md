# v0.2.0-stage-07

## 目标

建设「去 AI 味研究子系统 v1」：多模型无限制创作（采样模式）→ 多模型交叉判断（引文交集）+ 用户标注 → AI 味素材库（迁移 v4）→ 规避 skill 库雏形 → 回注 stage-05 装配器并度量。
（v2：依据 REV-v0.2.0-stage-07 修订，详度对齐 v0.1/v0.2 各阶段；见 `plan.md`。）

## 范围

- 本阶段 = **M2 素材库/去 AI 味研究半边**（与 stage-06 的审查+重写半边互补，共同构成 M2）。

## 依赖

- v0.1.0-stage-03（多 provider，硬，已归档）
- v0.2.0-stage-06（评判基础设施，硬，已归档）
- v0.1.0-stage-05（**软**）：T6 扩展其装配器 `ChapterPromptInput` 增 `skills`（向后兼容）
- 附带清理：stage-06 遗留 REV-008/011 随首个 op；REV-009/010 判定基准并入 T2 对齐；REV-014 若未闭合随收口

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 清理 stage-06 遗留 REV-008/011（chore） | T7 | — |
| op-002 | 多模型无限制创作调度器（采样模式）与素材候选 | T1 | op-001 |
| op-003 | 多模型交叉判断与判定基准对齐 | T2 | op-002 |
| op-004 | 素材库与迁移 v4：material 表 + CRUD + 检索 + 导出 | T4 | op-003 |
| op-005 | 用户标注工作台：受控标签与引文定位 | T3 | op-004 |
| op-006 | 规避 skill 库雏形：skill_entry + 归纳引用 + 版本 | T5 | op-005 |
| op-007 | 闭环回注与度量：skills 注入 + 实验报告 | T6 | op-006 |
| op-008 | 修复交叉判断无 UI 入口与标注入库静默失败（REV-018/019）(fix) | T2/T3（补） | op-005 |

> 说明：**op-008 为代码审查修复闭环**（REV-018 high：交叉判断无 UI 触发 → `multi_model_cross` 通道不可达；REV-019 medium：标注保存失败静默），仅改 op-002/003/005 的产出文件，修复后经 openfeel-feel-tester 复验。

> 说明：**op-004（T4 素材库/迁移 v4）先于 op-005（T3 标注工作台）**——T3 标注入库依赖 T4 的 `material` 仓储。

### 定稿要点（摘要）
- **迁移 v4**：`0004_material_skill.sql` → `material`（source_type/source_model/excerpt/position_json/reason/label/chapter_id/status…）+ `skill_entry`（version/rule/examples_json/source_material_ids_json…）；**skill 载体=DB 表**；素材→skill 以 id 引用；导出 JSON/CSV；幂等 7→9 表。
- **采样模式**：不触发审查/自动保存、无预算裁剪、**不进正文**；多模型**串行**、勾选 ≥1、Key 引导；产物→素材候选→交叉→标注→入库。
- **交叉合并**：**引文精确交集** + 命中 ≥2 高置信 / =1 待确认；结果入**待确认队列**，用户确认后入库。
- **定位/标签**：**verbatim 引文 + 前后文**；**受控枚举标签 + 备注**；`source_type` 三值对应三通道；工作台落点 `src/features/research/`。
- **skill 注入**：条目 `{id,version,title,rule,examples?,sourceMaterialIds}`；stage-05 装配器增 `skills?`（system prompt，缺省兼容）；预算桶 ≤500 字；两层验证。
- **T6 实验**：固定样本集（≥3 篇）四维对比（温度 0），真人感主指标；**学术诚实声明**。

### schemer 落实结果
- op 拆分：7 个 op（首 op 并入 stage-06 REV-008/011 + stage-07 复核 REV-008 清理，标 `(chore)`），见上表。
- **遗留处置**：stage-06 REV-008（adopt `dispose` 复核）/ REV-011（表列数 / chunk「v0.2 接受、v0.3 评估」/ 冒烟）**+ stage-07 复核 REV-008（perf 实测执行主体）** → **op-001**（含 perf 回填）；REV-009/010（判定基准）→ **op-003（T2）对齐**。
- **stage-07 复核 REV-011~016**：REV-011（`source_type` 三通道透传）→ op-003/op-005；REV-012（material 删除↔skill 引用防护）→ op-004/op-006；REV-013（`status` 语义：待确认=会话内存，`candidate` 预留）→ op-003/op-004；REV-014（实验执行主体+数据状态）→ op-007；REV-015（`.openfeel/manual/` 路径统一）→ op-007；REV-016（`position_json` 去冗余 / `MaterialSourceType` 单一来源 / 采样取消）→ op-002/op-004。REV-009（计数链）已由 op-004/006 承担（复核收口）。
- **跨阶段修改**：op-007（T6）扩展 stage-05 装配器 `ChapterPromptInput.skills?`（向后兼容、既有测试回归通过），回写 `.openfeel/manual/features/generation.md` + `.openfeel/manual/orchestration/engine.md`。
- **新增依赖：无**。
- 文档同步 4 处：`docs/ipc.md`（op-004 material / op-006 skill；计数 38→41→45）、`docs/structure.md`（op-002/006/007）、`docs/review-rubric.md`（op-003 共享判据）、`.openfeel/manual/index.md` + `.openfeel/manual/features/research.md`（op-007）。
