# v0.2.0-stage-06 详细计划：审查流水线

> 修订：v2（2026-10-10，依据 REV-v0.2.0-stage-06 的 7 条审查意见修订，详度对齐 v0.1 各阶段）。

## 归属版本
v0.2（质量闭环）

## 目标
让 AI 生成文本经可配置的多维审查与评分，未达标自动/手动重写，形成质量闭环。

## 范围声明（修订 REV-007③）
**M2 里程碑含「去 AI 味素材库可采集、标注并导出」——其中「素材库/去 AI 味研究」半边归 stage-07**；本阶段仅覆盖 M2 的**审查 + 重写半边**（剧情/世界观/合规/真人感四维 + 加权择优 + 重写回路），不含素材采集/标注/导出。

## 对应核心目的
- 目的 1：保障生成内容质量与设定一致性。
- 目的 2：「真人感」维度审查是去 AI 味的直接抓手，也是 stage-07 评判基础设施（**共享判据**）。

## 前置依赖
- v0.1.0-stage-03（引擎）、v0.1.0-stage-05（生成闭环）（硬依赖）
- v0.1.0-stage-04（编辑器）（软依赖）：T3 采纳需扩展 `EditorController` 命令面 `replaceContent`
- **stage-05 遗留 REV-009（人工协验）→ 并入本阶段首个 op（T7）闭合**（修订 REV-007④）：perf 实测回填 + 真机冒烟检查单填写，M1 收口前完成。

## 技术约束（本阶段适用，定稿）

### Evaluator 执行机制（定稿，修订 REV-001）
- **落点 `src/orchestration/review/`**（复用引擎契约，与 `manual/orchestration/engine.md` 扩展点一致）。
- **接口**：`evaluate(input: ReviewInput): Promise<EvaluationResult>`；`EvaluationResult = { score: 0–100; reasons: string[]; findings?: unknown }`。
- **各维执行机制（定稿）**：
  | 维度 | 机制 | 说明 |
  |------|------|------|
  | 剧情 | **LLM-as-judge** | 经 stage-03 `ModelProvider.stream(ChatOptions)` 发评审 prompt，输出 JSON |
  | 世界观 | **LLM-as-judge** | 同上 |
  | 真人感 | **LLM-as-judge** | 同上；判据与 stage-07 共享 |
  | **合规** | **规则引擎（本地词表/正则，可配置）+ 可选 LLM 复核** | 规则部分**无需 Token**、可单测 |
- **对接引擎**：LLM 维经 `ModelProvider.stream` **非流式收口**（聚合完整文本后解析 JSON，复用 stage-03 适配器，不新增流式 UI）。
- **JSON 解析容错与降级**：解析失败 → 有限重试 → 仍失败则降级（返回默认分 + `reasons` 标注「判定失败」），**不抛穿流水线**。
- **LLM 维测试 = 夹具回放**（`tests/fixtures/review/` 评审 mock 响应样本，同 stage-03 SSE 夹具模式）。

### 迁移 v3（定稿，修订 REV-002）
- 新增 `src-tauri/migrations/0003_review.sql`，走 stage-02 迁移纪律（`include_str!` 单一来源 + `_sqlx_migrations` 幂等）。
- 表：`review_record(id, chapter_id, round, dimension, score, reasons_json, created_at)`（每维一行）。
- **关联语义（v0.2 简化，定稿）**：审查记录按 **`chapter_id` + `round`（轮次）** 关联——「该章最新一轮审查」；生成会话级关联留待演进（`generationStore.requestId` 为内存态，不持久化）。
- **「可回溯」查询口径**：按 `chapter_id` 查询审查历史列表（含 `round`/`dimension`/`score`/`reasons`，按时间倒序）。

### 多版本机制（定稿，修订 REV-003）
- **版本池 = 初版 + 重写轮次产物**（每轮重写产出全量新版本入池并评分）；v0.2 **版本池为会话级（内存）**，采纳后正文持久化；版本内容持久化留待后续。
- **择优**：用户在审查面板按**加权总分**选择采纳版本。
- **采纳落地**：以选定版本**替换**章节内容 → 扩展 stage-04 `EditorController` 命令面新增 **`replaceContent(html)`**（作为**单条撤销历史**入栈）；`appendChunk` 追加语义保留不变。
- 非最优版本**保留在池中可回看**。

### 评分 rubric 与合规规则载体（定稿，修订 REV-004）
- **rubric 文档**：`docs/review-rubric.md`（每维子维度 + 分档描述），**版本化**并**内联进评审 prompt** 以约束 LLM 打分；分档：`0–59 不合格 / 60–79 合格 / 80–89 良 / 90–100 优`。
  | 维度 | 子维度（初始） |
  |------|----------------|
  | 剧情 | 逻辑连贯 / 冲突推进 / 节奏 / 伏笔呼应 |
  | 世界观 | 设定自洽 / 术语一致 / 环境可信 |
  | 合规 | 涉政 / 色情 / 暴力 / 广告 / 价值观 |
  | 真人感 | 套话密度 / 句式单调 / 情感空洞 / 信息密度 |
- **合规规则载体**：`src/orchestration/review/compliance-rules.ts`（结构化类目 + 词表/正则 + 说明 + **版本常量**），可配置、可更新（规范演进）；v0.1/v0.2 内置**初始词表并标注覆盖范围有限**。
- **合规低分行为（定稿）**：**仅提示用户人工裁决**，**不触发自动重写**（避免自动重写放大误判）。

### 重写回路（定稿，修订 REV-005）
- **上限**：**2 次自动重写**；达上限转人工（每轮重写前提示）。
- **反馈注入**：重写 prompt **结构化注入上轮未通过维度的 `score` + `reasons`**；rubric 声明「重写质量以反馈项改善为准」。
- **落地**：重写产物**入版本池 + 自动评分**，**不自动替换正文**——由用户择优采纳（兼顾成本与安全）。
- **开关**：自动重写**默认开启**，可在权重配置中**关闭**（成本控制）。

### 成本与模型选择（定稿，修订 REV-006）
- 评审**复用 `model_config` 默认模型**（独立评审模型仅预留 `reviewModelName?` 字段，不实现）。
- 评审调用**非流式收口**（聚合后解析 JSON）。
- 评审输入**沿用装配预算裁剪**（复用 stage-05 预算常量或独立评审预算）。
- Token 成本提示入风险节（用户可关闭自动审查以省 Token）。

### 其他
- **新增依赖：无**（复用 stage-03/04/05 既有依赖）。
- 审查/重写作为编排引擎 **Pipeline 多步组合**接入（stage-03 已预留「多步组合于 stage-06/08 启用」）。
- i18n：启用 **`review`** 命名空间（审查面板/提示双语，C-11）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | Evaluator 接口、注册表与评分契约 | `src/orchestration/review/evaluator.ts`（`evaluate` + `EvaluationResult`）+ 注册机制 | 可注册/替换；契约类型编译通过；JSON 解析容错与降级（重试/默认分）单测通过 | stage-03 |
| T2 | 四维评估器实现（LLM-as-judge + 规则合规）+ rubric | LLM 维（剧情/世界观/真人感，经 `ModelProvider`，prompt 内嵌 rubric）+ 合规规则引擎 `compliance-rules.ts`；`docs/review-rubric.md`；评审测试样本集 `tests/fixtures/review-samples/`（含期望评分区间） | LLM 维经**夹具回放**测试出 0~100 分与理由；合规规则维**无需 Token** 单测；rubric 版本化 | T1 |
| T3 | 加权评分、版本池与择优 | 评分聚合器 + 会话级版本池 + 权重配置 UI + 版本对比（列表+总分排序+采纳）+ `EditorController.replaceContent(html)` | 调整权重改变总分排序（测试）；采纳经 `replaceContent` 替换正文并**单条撤销**；非最优版本可回看 | T2, stage-04 |
| T4 | 重写回路 | 判定→重写（**注入上轮反馈**）→复审 管线；上限 2；自动重写开关 | 不通过自动重写（默认开、可关）；达上限转人工并提示；重写产物入池**不自动替换**；反馈注入断言 | T3 |
| T5 | 用户审查界面 | 审查面板（四维分数/理由/改判/触发重写）+ 版本对比 + 采纳 | 用户可查看、改判并触发重写；可采纳某版本（替换正文）；**合规低分仅提示人工裁决** | T2,T3 |
| T6 | 审查结果持久化（迁移 v3） | `0003_review.sql` + Rust CRUD + IPC | 迁移**幂等复验**；「按 chapter 查询审查历史（round/dimension/score/reasons，时间倒序）」可判定 | stage-02 |
| T7 | stage-05 遗留 REV-009 清理（并入首个 op，标 `(chore)`） | perf 实测回填 `perf/README.md` + 真机冒烟检查单 `smoke-check-v0.1.md` 填写 | perf（P95/实例数=1/堆增幅）与冒烟「实际/结果」列填写完成，**M1 协验闭合** | stage-05 |

## 阶段验收标准（DoD，即 M2 审查+重写半边）
- [ ] 四维评估器独立运行、产出一致格式结果：LLM 维经**夹具回放**、合规规则维**单测**（REV-001）。
- [ ] 「合规」按**中国大陆出版规范**（规则引擎 + 词表可配置）；低分**仅提示人工裁决、不自动重写**（REV-004）。
- [ ] 权重可调且生效、默认平衡；多版本按**加权总分排序择优**（REV-003）。
- [ ] 版本采纳经 `replaceContent(html)` 替换正文，**单条撤销**（REV-003）。
- [ ] 重写**默认开启、上限 2**、注入上轮反馈、产物入池**不自动替换**、达上限转人工（REV-005）。
- [ ] 迁移 v3 幂等；审查记录**可回溯**（按 chapter 查询口径）（REV-002）。
- [ ] 评审**复用默认模型、非流式收口**、沿用预算裁剪（REV-006）。
- [ ] 评审测试样本集入库 `tests/fixtures/review-samples/`（REV-007①）。
- [ ] 范围声明：M2 素材库半边归 stage-07（REV-007③）。
- [ ] stage-05 遗留 **REV-009 人工协验闭合**（perf + 冒烟）（REV-007④）。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「Evaluator 执行机制」：落点 `src/orchestration/review/`、四维机制表、非流式收口、JSON 降级、夹具回放；T1/T2 |
| REV-002 | high | ✅ | 技术约束「迁移 v3」+ T6：表结构、关联语义（chapter_id+round）、可回溯查询口径、幂等复验 |
| REV-003 | medium | ✅ | 技术约束「多版本机制」+ T3：版本池/择优/`replaceContent` 扩展/单条撤销 |
| REV-004 | medium | ✅ | 技术约束「rubric + 合规规则载体」+ T2/T5：rubric 文档、合规词表、低分仅人工裁决 |
| REV-005 | medium | ✅ | 技术约束「重写回路」+ T4：上限 2、反馈注入、产物入池不自动替换、开关 |
| REV-006 | low | ✅ | 技术约束「成本与模型选择」 + 风险节：默认模型、非流式、预算复用、Token 提示 |
| REV-007 | low | ✅ | 范围声明（素材库归 stage-07）+ T2 样本集 + DoD 可回溯口径 + T7（REV-009 闭合） |

## 风险与备注
- **Token 放大（REV-006）**：四维审查 + 重写轮次使每章 LLM 调用约为纯生成的 4~5 倍；用户可关闭自动审查/自动重写以省 Token；独立评审模型（更廉价）留待后续。
- **评分主观性**：以 rubric + **温度 = 0** 缓解；夹具回放保证判定可回归。
- **合规覆盖有限**：内置词表仅覆盖常见类目，须标注局限；规则可配置 + 版本化以应对规范演进；低分不自动重写。
- **T7 依赖真实 WebView**：perf/冒烟协验无法自动化，须 feel-tester 或用户执行 `pnpm tauri dev` 闭合；不阻塞其余任务的开发推进。
- **版本池会话级**：应用重启后未采纳版本丢失（v0.2 接受）；如需持久化留待后续。
- **真人感判据共享**：与 stage-07 共用判据定义，避免两套口径（后续在 kb 登记共享 rubric）。

## 待用户拍板
无（四维机制、重写上限、合规低分行为等均为技术性定稿，符合既有约定与 M2 范围）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T7（REV-009 协验闭合）**（标 `(chore)`）。
2. 与 stage-04 衔接：`EditorController.replaceContent` 为**命令面扩展**，需在 `docs/structure.md` / `manual/features/editor.md` 登记。
3. 文档同步：`docs/review-rubric.md`（新增）、`docs/ipc.md`（review 命令）、`docs/structure.md`（`src/orchestration/review/` 落点）、`manual/index.md`（登记 review 模块）。
