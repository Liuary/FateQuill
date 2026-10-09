# v0.2.0-stage-07 详细计划：去 AI 味研究子系统 v1

> 修订：v2（2026-10-10，依据 REV-v0.2.0-stage-07 的 7 条审查意见修订，详度对齐 v0.1/v0.2 各阶段）。

## 归属版本
v0.2（质量闭环）

## 目标
把「去 AI 味」建设为**独立可研究、可积累的子系统**：多模型无限制创作 → 多模型交叉判断 + 用户标注 → AI 味素材库 → 规避 skill 库雏形，并回注到创作 Agent（stage-05 装配器）。

## 对应核心目的
- 目的 2（第一等公民）：本阶段即该目的的主载体，不可降级为附属功能。

## 前置依赖
- v0.1.0-stage-03（多 provider）、v0.2.0-stage-06（评判基础设施）（硬依赖）
- **stage-06 遗留处置（修订 REV-007③）**：
  - **REV-008（adopt 临时 `EditorController` 未 dispose，已代码修复）/ REV-011（杂项/chunk 评估/冒烟扩展）→ 随本阶段首个 op `(chore)` 收敛**；
  - **REV-009/010（重写判定基准歧义 / 判定基准澄清未同步 plan）→ 并入本阶段 T2 交叉判断设计一并对齐**（同一「判定基准」口径两处引用）；
  - **REV-014（perf 人工协验）→ 若 stage-05 REV-009 未闭合，则随本阶段收口一并闭合**。

## 技术约束（本阶段适用，定稿）

### 迁移 v4 与双数据资产（定稿，修订 REV-001）
- 新增 `src-tauri/migrations/0004_material_skill.sql`，走 stage-02 迁移纪律（`include_str!` 单一来源 + `_sqlx_migrations` 幂等；表数 **7→9** 断言更新）。
- **`material` 表**（AI 味素材）：`id, source_type, source_model, excerpt, position_json, reason, label, context_before, context_after, chapter_id, status, created_at`。
  - `source_type ∈ { multi_model_creation, multi_model_cross, user_manual }`（三采集通道一一对应）；
  - `status ∈ { candidate(待确认), confirmed(已入库) }`；
  - `position_json = { excerpt, contextBefore?, contextAfter? }`（verbatim 定位，见下）；
  - 隐私字段**仅本地**（#8 已确认，无匿名聚合上传）。
- **`skill_entry` 表**（规避 skill 库）：`id, version, title, rule, examples_json, source_material_ids_json, created_at`。
  - **载体定稿：DB 表**（而非本地文件）——理由：与素材引用关系可校验、统一备份/迁移、可查询检索。
- **「素材 → 归纳 → skill」引用关系**：`skill_entry.source_material_ids_json` 记录来源 `material.id` 列表，**避免重复存储**、保证可追溯（学术性）。
- **导出格式**：**JSON + CSV**（学术分析用途）。

### 多模型调度语义（定稿，修订 REV-002）
- **「无限制」边界（定稿）**：**采样模式不触发自动审查、不自动保存、上下文无预算裁剪**；产出**仅入素材候选、绝不进编辑器正文/不落 chapter**。研究采样**跳过合规拦截**（保持样本纯净用于研究）。
- **多模型配置来源**：研究工作台列出**全部已配置 `model_config`**，用户**勾选 ≥1 个**；Key 缺失引导同 stage-05。
- **数据流（定稿）**：`多模型创作产物 → 素材候选（内存/临时 MaterialCandidate）→ T2 交叉判断标注 → T3 用户标注 → material 入库(status=confirmed)`。
- **调度形态**：**串行逐模型**（采样场景无需并行，成本可控）。

### 交叉合并机制（定稿，修订 REV-003）
- **合并策略（v0.2 简化）**：**引文精确匹配交集**——以模型返回的**原文引文（verbatim excerpt）为键**求交集；命中模型数 **≥2 → 「高置信 AI 味」**，**=1 → 「待人工确认」**；**不做模糊对齐**（留待后续迭代）。
- **输出结构**：`{ excerpt, positionHint, models: string[], reason }`。
- **落库策略**：交叉结果**不入库直达**，入**「待确认」队列**（`material.status=candidate`，T3 工作台首屏）；**用户确认后才入库**（避免模型误判污染素材库）。
- 上述简化声明：**v0.2 交叉判断以「引文交集 + 人工确认」为限**。

### 定位格式与标签契约（定稿，修订 REV-005）
- **定位格式**：**引文原文（verbatim excerpt）** + 可选前后文（`contextBefore/After` 各 ≤ 50 字）——**避免 offset 幻觉**；前端以文本搜索定位（唯一命中即定位；多命中取首个并提示）。
- **标签体系**：**受控枚举 + 自由备注**。初始枚举 `cliche`（套话）/ `parallelism`（排比）/ `empty`（空洞形容）/ `translationese`（翻译腔），**版本化可扩展**；备注字段自由文本。
- **`source_type` 与通道对应**：`multi_model_creation` / `multi_model_cross` / `user_manual`。
- **标注工作台落点**：**独立路由页 `src/features/research/`**（采样低频，独立页优于第三栏 tab）。

### skill 结构与注入对接（定稿，修订 REV-004）
- **skill 条目结构**：`{ id, version, title, rule: string, examples?: { bad, good }[], sourceMaterialIds: number[] }`（`rule` = 可执行的规避指令；来源素材可追溯）。
- **注入机制（跨阶段修改，须声明）**：扩展 stage-05 装配链——`ChapterPromptInput` 增 **`skills?: SkillEntry[]`**；`buildChapterPrompt`（`src/orchestration/prompts/chapter-generation.ts`，锚点已存在）将 skill 规则拼入 **system prompt**；**`skills` 缺省时行为不变（向后兼容）**。
- **预算**：skill 段新增**预算桶 ≤ 500 字**并计入总预算（总预算相应上调或按优先级裁剪）。
- **两层验证口径**：**单元** = 「注入后 `messages` 含 skill 文本」（可判定单测）；**效果** = T6 注入前后评审总分对比（度量记录）。

### T6 实验设计（定稿，修订 REV-006）
- **固定样本集**：≥ 3 篇、每篇 ≥ 1000 字，**入库可复现**。
- **度量**：stage-06 评审管线（**同模型、温度 = 0**）对「skill 关 / skill 开」两配置各评一轮，记录四维分数表。
- **主指标** = 「真人感」维度分**提升**；**约束** = 其余三维**不回退超过容差**。
- **记录落点**：对比表与实验配置入库 `src/features/research/experiments/`（同域）。
- **学术诚实声明**：**v0.1/v0.2 为小样本雏形度量，非统计显著性验证**。

### 其他
- **新增依赖：无**（复用 stage-03/05/06 既有依赖）。
- i18n：启用 **`research`** 命名空间（研究工作台/标注文案双语，C-11）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 多模型无限制创作调度器（采样模式） | 调度器（**串行逐模型**）+ `MaterialCandidate` 暂存结构 + 研究工作台模型勾选 UI | **mock provider 断言逐模型调用与产物收集**；采样**不进正文/不自动保存/不触发审查**；Key 缺失引导 Settings | stage-03 |
| T2 | 多模型交叉判断摘取 | 交叉评判器（**引文精确交集** + 命中数分级）+ 定位输出 `{excerpt,positionHint,models,reason}` | ≥ 2 模型交叉；命中 ≥2=高置信、=1=待确认；结果入**待确认队列不入库**；判定基准与 stage-06 REV-009/010 **对齐** | T1 |
| T3 | 用户标注工作台 | 标注 UI（片段选择 + 理由 + **受控标签** + 备注）+ 引文搜索定位（`src/features/research/`） | 用户标注入库（`source_type=user_manual`）；受控枚举校验；多命中提示 | stage-06 |
| T4 | 素材库 + 迁移 v4 | `0004_material_skill.sql`（`material` 表）+ Rust CRUD + 检索 + 导出（JSON/CSV） | 迁移**幂等复验**（7→9 表）；素材含来源模型/判据/结论可检索；导出可用；**默认仅本地** | stage-02 |
| T5 | 规避 skill 库雏形 | `skill_entry` 表 + 归纳（素材 → skill **引用** `sourceMaterialIds`）+ 版本管理 + 加载接口 | skill 条目结构完整；`source_material_ids_json` 引用有效；版本可管理 | T4 |
| T6 | 闭环回注与度量 | stage-05 装配器 **`skills` 注入参数扩展** + 实验脚本 + 报告（`src/features/research/experiments/`） | 单元：注入后 `messages` 含 skill 文本；效果：固定样本集四维分数对比表（真人感↑、其余不回退超容差）；**学术诚实声明** | T5, stage-05 |
| T7 | stage-06 遗留清理（并入首个 op，标 `(chore)`） | 补丁 + 登记 | REV-008（adopt `dispose` 收敛）、REV-011（杂项/chunk 评估/冒烟扩展）；REV-014 若未闭合则一并收口 | stage-06 |

## 阶段验收标准（DoD，即 M2 素材库半边）
- [ ] **迁移 v4 幂等**（7→9 表）；`material` + `skill_entry` 两表落地（REV-001）。
- [ ] 素材含来源模型、判据、结论，**可检索、可导出**（JSON/CSV），**默认仅本地**（REV-001/#8）。
- [ ] **三采集通道**均可用：多模型创作 / 交叉判断 / 用户标注（REV-002/003/005）。
- [ ] 采样模式不触发审查/自动保存、**不进正文**；多模型串行、勾选 ≥1、Key 缺失引导（REV-002）。
- [ ] 交叉判断 = **引文精确交集** + 命中分级，**结果入待确认队列**，用户确认后入库（REV-003）。
- [ ] 定位格式 = **verbatim 引文 + 前后文**；标签 = **受控枚举 + 备注**（REV-005）。
- [ ] skill 条目结构完整、**来源素材可追溯**、版本可管理（REV-004）。
- [ ] **注入对接**：stage-05 装配器 `skills` 参数扩展、缺省向后兼容；单元「messages 含 skill 文本」通过（REV-004）。
- [ ] **效果度量**：固定样本集（≥3 篇）四维对比表，真人感↑、其余不回退超容差，含**学术诚实声明**（REV-006）。
- [ ] stage-06 遗留 REV-008/011 已处理/登记；判定基准与 REV-009/010 对齐（REV-007）。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「迁移 v4 与双数据资产」+ T4/T5：material/skill_entry 表结构、skill 载体=DB、引用关系、导出格式、幂等 |
| REV-002 | high | ✅ | 技术约束「多模型调度语义」+ T1：无限制边界、配置来源、数据流、串行调度 |
| REV-003 | medium | ✅ | 技术约束「交叉合并机制」+ T2：引文交集、命中分级、待确认队列 |
| REV-004 | medium | ✅ | 技术约束「skill 结构与注入对接」+ T5/T6：条目结构、装配器扩展（向后兼容）、预算桶、两层验证 |
| REV-005 | medium | ✅ | 技术约束「定位格式与标签契约」+ T3：verbatim 定位、受控枚举、source_type、工作台落点 |
| REV-006 | low | ✅ | 技术约束「T6 实验设计」：样本集、主指标/约束、温度 0、学术诚实声明 |
| REV-007 | low | ✅ | 前置依赖处置 + T1 测试口径（mock provider）+ 风险节成本提示 + T7 |

## 风险与备注
- **成本放大（REV-007②）**：多模型创作 = **N × 生成 Token**（N = 勾选模型数）；交叉判断 = **2 × 评审 Token**；采样成本 **∝ 勾选模型数**（用户可控）。
- **「AI 味」判据形式化**：v1 以**可积累、可对比**为先，不追求完备理论；判据与 stage-06「真人感」维**共享 rubric**（在 kb 登记共享）。
- **素材 → skill 关系**：以 `source_material_ids` 引用，**避免重复存储**；skill 归纳需人工参与（v0.2 不做自动归纳）。
- **交叉定位对齐**：以 verbatim 引文为键，规避 offset 幻觉；不做模糊对齐（v0.2 接受召回损失）。
- **跨阶段修改**：T6 扩展 stage-05 装配器签名须保证 `skills` 缺省行为不变（stage-05 既有测试回归通过）。
- **学术诚实**：小样本度量不作统计显著性声明，避免过度解读。

## 待用户拍板
无（双资产载体、交叉合并策略、标签体系等均为技术性定稿，符合既有约定与 M2 范围）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T7（REV-008/011 等清理）**（标 `(chore)`）。
2. 跨阶段修改声明：stage-05 装配器 `ChapterPromptInput` 增 `skills`（向后兼容）需回写 `manual/orchestration/engine.md` / `manual/features/generation.md`。
3. 文档同步：`docs/ipc.md`（research 命令）、`docs/structure.md`（`src/features/research/` 落点）、`docs/review-rubric.md`（共享判据）、`manual/index.md`（登记 research 模块）。
