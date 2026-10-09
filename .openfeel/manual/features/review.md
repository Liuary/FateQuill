# 模块手册：审查（features/review）

## 职责

FateQuill 的**审查（评审）域**：以四维（剧情 / 世界观 / 合规 / 真人感）评估章节正文，支持**加权择优**、**自动重写回路**与**用户审查面板**，并把审查结果持久化以支持回溯。建立于 **v0.2.0-stage-06**。

分层：契约与算法在 `src/orchestration/review/`（provider 无关，见 `manual/orchestration/engine.md`）；元状态在 `src/store/reviewStore.ts`；UI 在 `src/features/review/`；持久化走 Rust + IPC。

## 目录结构 / 关键文件

```
src/orchestration/review/     # 契约与算法（provider 无关）
├── types.ts                  # ReviewDimension / EvaluationResult / ReviewInput / Evaluator
├── evaluator.ts              # EvaluatorRegistry + evaluateWithFallback（重试/降级 DEGRADED_SCORE=60）
├── json.ts                   # extractJson / parseEvaluationJson（围栏/夹取/非法抛错）
├── rubric.ts                 # REVIEW_RUBRIC_VERSION / RUBRICS / buildReviewSystemPrompt
├── compliance-rules.ts       # COMPLIANCE_RULES_VERSION / COMPLIANCE_RULES / scanCompliance
├── evaluators/               # llm-judge（非流式收口）/ plot / worldview / humanity / compliance
├── aggregate.ts              # DEFAULT_WEIGHTS / weightedTotal（纯函数）
├── rewrite.ts                # buildRewriteMessages / rewriteChapter（反馈注入）
├── loop.ts                   # runReviewLoop（上限 2 / 合规排除 / 入池不替换）
└── register.ts               # registerBuiltinEvaluators（四维注册）

src/store/reviewStore.ts      # 会话级版本池 + 权重 + autoRewrite + needsHumanReview
src/features/review/          # 审查 UI
├── ReviewPanel.tsx           # 四维分数/理由 + 改判 + 触发重写 + 自动重写开关 + 人工裁决提示
├── VersionList.tsx           # 版本对比（加权总分降序 + 回看 + 采纳）
├── useReview.ts              # runReview / rejudge / triggerRewrite / adopt
└── WeightConfig.tsx          # 四维权重输入（展示加权排序）

src-tauri/migrations/0003_review.sql   # review_record 表（v3）
src-tauri/src/db/review.rs             # insert / list_by_chapter（时间倒序）
src/domain/models/review-record.ts     # ReviewRecord
src/ipc/repositories/review-record-repository.ts  # reasons_json ↔ reasons 映射
```

## 核心 API / 约定

- **四维与评分**：`EvaluationResult = { score: 0–100; reasons: string[]; findings? }`；`weightedTotal(results, weights) = Σ(score×weight)/Σweight`（**缺维 / 零权不参与**，归一 0–100）。
- **评估器**：LLM 维经 stage-03 `ModelProvider` **非流式收口**（聚合全文 → `parseEvaluationJson`）；**合规为规则引擎**（本地词表/正则，**无需 Token**）；解析/调用失败经 `evaluateWithFallback` 有限重试 → 降级默认分（`DEGRADED_SCORE=60`），**不抛穿**。
- **重写回路（`runReviewLoop`）**：初版评分 → 未通过且可自动重写 → **注入上轮反馈**重写 → 复审；**上限 2 次**（`maxRounds`）；**合规低分不作为自动重写触发项**（`triggerDims` 排除 `compliance`，仅人工裁决）；达上限 / 关闭开关 / 仅合规未通过 → `needsHuman`。产物经 `onVersion` **入池，不自动替换正文**。
- **版本池**：`ReviewVersion { id, label, content, round, results, totalScore }`；`setWeights` 重算全部总分；非最优版本保留可回看。
- **采纳**：`EditorController.replaceContent(html)`（**单条撤销历史**）——**前端命令面，非 IPC**；一次性 controller 用后 `dispose()`（REV-008）。
- **持久化（T6）**：表 `review_record(id, chapter_id, round, dimension, score, reasons_json, created_at)`，**每维一行**；`chapter_id` FK `ON DELETE CASCADE`；命令 `save_review_record` / `list_review_records`（**时间倒序**）；`dimension` ∈ {plot, worldview, compliance, humanity}、`score` 0–100，非法 → `VALIDATION`。
- **关联语义（v0.2 简化）**：按 `chapter_id` + `round` 关联该章某轮审查；生成会话级关联留待演进（`generationStore.requestId` 内存态不持久化）。

## 关联文档

- 编排引擎：`.openfeel/manual/orchestration/engine.md`（`review/` 子模块）；rubric 人读权威版 `docs/review-rubric.md`。
- 编辑器与采纳命令面：`.openfeel/manual/features/editor.md`、`docs/structure.md` §13。
- IPC：`docs/ipc.md` §8.1（`save_review_record` / `list_review_records`、关联语义）。
- 存储：`.openfeel/manual/core/domain-storage.md`（迁移纪律）。
