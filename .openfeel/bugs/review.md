# Bug 追踪：review（审查）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/review/`。

## closed

### BUG-001：评审输入未沿用预算裁剪，长章正文全量送入四维评审与重写 prompt（low）
- **阶段**：v0.2.0-stage-06（T6 收口 / BUG-001）｜**关联**：DoD 第 7 条（REV-006）
- **现象**：`src/orchestration/review/` 全目录**无任何 Budget / 裁剪逻辑**（`rg -e Budget -e PROMPT_BUDGET` 零命中）；`evaluators/llm-judge.ts` 与 `rewrite.ts` 直接把完整正文送入 `provider.stream`，无长度上限。对照 stage-05 `prompts/chapter-generation.ts` 的 `PROMPT_BUDGET`（total=8000）——生成侧有裁剪，评审/重写侧无。
- **影响**：**成本偏差**（Token 放大），非功能失败——四维评分 / 重写回路 / 版本池 / 采纳在测试下均正常；DoD 第 7 条三子项中「沿用预算裁剪」未满足（部分满足）。
- **修复**（commit `1bbd3e8`）：新增 `src/orchestration/review/budget.ts`（`REVIEW_CONTENT_BUDGET = PROMPT_BUDGET.total`（**单一来源复用** stage-05 装配预算，=8000）、`REVIEW_TRIM_MARKER`、`trimReviewContent(content, budget?)`）；接入 `evaluators/llm-judge.ts`（评审 user message）与 `rewrite.ts`（`buildRewriteMessages` 待改正文）；**provider 无关 / 非流式收口不变**。补 `budget.test.ts` + 两处超长输入断言。
- **验收**：openfeel-feel-tester **独立复核（不轻信声明）**——读源码确认两处接入点与预算常量（实测 8000）；**临时探针**（`__probe_budget.test.ts`，用后清理）以 5×预算超长正文调用 llm-judge 与 `buildRewriteMessages`，断言送入 LLM 的文本**含裁剪标记且 `length ≤ 8000 + 标记长`**、`< 原文长`（证实超长输入确被裁剪）；门禁 `pnpm test` **221 passed / 52 files**、`cargo test` **45 passed**、lint 0 error、build OK；探针删除后 `git status` 干净。状态 **closed**（2026-10-10 02:22）。
- **经验**：**成本约束类 DoD 须有可证伪断言**——「复用预算常量」应验证「超长输入确被裁剪」，而非仅检查常量存在；跨阶段复用预算时以 `REVIEW_CONTENT_BUDGET = PROMPT_BUDGET.total` **单一来源**接线，避免数值漂移。

## open / fixing / resolved

- （无）
