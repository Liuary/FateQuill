# 模块手册：研究（features/research）

## 职责

FateQuill 的**研究域**：多模型无限制创作采样 → 交叉判断 → 用户标注 → 素材库 → 规避 skill 库 → **闭环回注**（skill 注入生成）与**效果度量实验**。建立于 **v0.2.0-stage-07**。

分层：契约与算法在 `src/orchestration/research/`（provider 无关）；会话态在 `src/store/researchStore.ts`；UI 在 `src/features/research/`；持久化走 Rust + IPC（迁移 v4）。

## 目录结构 / 关键文件

```
src/orchestration/research/     # 契约与算法（provider 无关）
├── types.ts                    # MaterialCandidate / SamplingModel / Confidence / ModelExcerpts / CrossJudgeResult
├── sampler.ts                  # buildSamplingMessages / runSampling（串行逐模型，可中止）
├── cross-judge.ts              # extractFlavorExcerpts / mergeByExcerpt（verbatim 精确交集 + 命中分级）
├── tags.ts                     # RESEARCH_TAGS_VERSION / 受控标签枚举 / isValidTag
└── index.ts

src/store/researchStore.ts      # 会话态：勾选 + 候选 + 待确认队列（独立 create）
src/features/research/          # 研究工作台
├── ResearchWorkbench.tsx       # 采样区 + 交叉判断区 + 标注区 + 素材库区 + skill 管理区
├── useSampling.ts              # 勾选 → 串行采样（AbortController 停止）；导出 buildSelectedModels
├── useCrossJudge.ts            # 交叉判断编排（逐候选×逐模型摘取 → 交集合并 → 待确认队列）
├── AnnotationPanel.tsx         # 标注：引文/定位预览/理由/受控标签/备注
├── useAnnotation.ts            # 标注编排（三通道透传 → material 仓储；失败捕获提示）
├── locate.ts                   # locateExcerpt（verbatim 搜索定位 + 前后文 ≤50）
├── MaterialLibrary.tsx         # 素材库面板：浏览/检索/导出/删除（被引用拒绝提示）
├── useMaterialLibrary.ts       # 素材库编排（list/remove + 检索过滤 + 错误分支）
├── SkillLibrary.tsx            # 规避 skill 库（列表 + 归纳表单 + 编辑/删除）
├── useSkillLibrary.ts          # skill 加载接口 + 归纳/更新/删除
├── export.ts                   # 素材导出（JSON/CSV + 本地下载；CSV createdAt ISO 归一）
└── experiments/                # T6 度量实验
    ├── run-experiment.ts       # runExperiment / formatReportTable / createDefaultExperimentDeps
    ├── report.md               # 四维对比表 + 数据状态 + 学术诚实声明
    └── samples/*.txt           # 固定样本集（≥3 篇，各 ≥1000 字）

src-tauri/migrations/0004_material_skill.sql   # material + skill_entry（v4）
src-tauri/src/db/{material.rs,skill.rs}        # CRUD / 检索 / 删除防护 / 引用校验
```

## 核心 API / 约定

- **采样（T1）**：`runSampling` **串行逐模型**；采样「无限制」边界 = **不触发审查 / 不自动保存 / 无预算裁剪**，产出仅入候选（`researchStore.candidates`），**不进正文、不落 chapter**；`AbortSignal` 可停止（已采集候选保留）。
- **交叉判断（T2）**：以 **verbatim 引文精确交集**为键；命中模型 **≥2 = 高置信**、**=1 = 待确认**；**不做模糊对齐**；结果入**会话内存待确认队列**（不入库直达）；每项自带 `sourceType="multi_model_cross"`（REV-011）。**编排入口 `useCrossJudge`**（研究台「开始/停止交叉判断」，对已有采样候选逐模型摘取；**单模型失败容错跳过**，REV-018）。
- **标注（T3）**：受控标签枚举（`cliche/parallelism/empty/translationese`，版本化）+ 自由备注；**verbatim 定位**（唯一命中即定位、多命中取首个并提示、前后文 ≤50）；入库 `status=confirmed`；**`sourceType` 按被标注项自带通道透传**（交叉 / 采样 / 手选三通道，REV-011）；保存失败**捕获并提示**（`annotationSaveFailed`，REV-019）。
- **素材库（T4）**：迁移 v4 `material`（`excerpt` 唯一权威、`position_json` 仅上下文、`chapter_id` `ON DELETE SET NULL`）；命令 `save_material`/`list_materials`/`delete_material`（**被 skill 引用则拒绝**，REV-012）；导出 JSON/CSV，**默认仅本地**。**读取侧 UI = `MaterialLibrary`**（浏览/检索 status·sourceType·query / 导出 / 删除，BUG-001 修复），复用 `export.ts` + `material.list/remove`。
- **skill 库（T5）**：`skill_entry`（`rule` = 可执行规避指令、`version` 可管理）；**素材 → skill 以 id 引用**（保存/更新校验素材存在）；归纳**需人工参与**。
- **闭环回注与度量（T6）**：装配器 `ChapterPromptInput.skills?`（拼入 system，预算桶 ≤500 字，**缺省向后兼容**）；度量实验 `runExperiment`（同模型、温度 0、每样本 skill 关/开两轮四维评分；主指标 = 真人感↑，约束 = 其余三维不回退超容差）；`report.md` 含**数据状态**（真机执行由用户 / feel-tester 协验）。
- **注入口径（REV-020③）**：生成注入 = **全部** `skill_entry` 条目（表**无 status 维度**；入库 skill 均源自 `confirmed` 素材归纳），加载失败/无条目时**不注入**。

## 关联文档

- 引擎：`.openfeel/manual/orchestration/engine.md`（`review/` 与提示模板 `skills` 扩展）。
- 生成：`.openfeel/manual/features/generation.md`（skill 回注链路）。
- 审查：`.openfeel/manual/features/review.md`、`docs/review-rubric.md`（共享判据与判定基准）。
- IPC：`docs/ipc.md` §8.1（material / skill_entry 命令与引用语义）。
- 实验真机协验：`docs/smoke-check-v0.2.md`（研究流程 + 回注度量）。
