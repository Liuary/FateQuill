# Bug 追踪索引（公共域）

> 存放各模块 Bug 关闭后的核心结论摘要与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/{module}/`。

## 状态统计

- **open 0 ｜ fixing 0 ｜ resolved 0 ｜ closed 6**

## 按模块

### v0.1.0-stage-01（工程脚手架与工程化基础设施）@openfeel-feel-tester

- **无 Bug**。正式测试验收 11/11 DoD、6/6 门禁全部通过，0 新增缺陷。
- 测试发现项均已被 openfeel-reviewer 在代码审查阶段登记为 REV-016~019（非新增，不重复提交）。
- 验收报告：`.openfeel/tmp/stage-01-acceptance.md`

### v0.1.0-stage-03（AI 编排引擎骨架与模型配置）@openfeel-feel-tester

- **2 个 low Bug，均已闭环**（修复 commit `fa1c8a2`，验收人 openfeel-feel-tester）；
  验收结论 DoD 10/10、门禁 6/6；`cargo test` 41/41（零告警）、Vitest 63/63。
- [`orchestration.md`](orchestration.md)：**BUG-001** — 中继测试模块 `MemSink::events()` 未使用（dead_code 告警）→ 删除方法。
- [`persistence.md`](persistence.md)：**BUG-002** — 「Key 不落库」哨兵断言恒真（不可证伪）→ 改为列集合精确断言 + 负向 INSERT 拒绝断言。
- 验收报告：`.openfeel/tmp/stage-03-acceptance.md`

### v0.1.0-stage-04（编辑器基础：Tiptap 章节文档 + 大纲树）@openfeel-feel-tester

- **1 个 high Bug，已闭环**（修复 commit `6d7d180`，验收人 openfeel-feel-tester）；
  验收结论 DoD 9/11 通过（另 2 条为真实 WebView 人工协验待办）；门禁 `pnpm test` 110/110、lint/build、`cargo test` 41/41 全绿。
- [`editor.md`](editor.md)：**BUG-001** — 切章前未 flush，防抖窗口内切章导致前一章编辑永久丢失 → 修复为 `requestSelectChapter` 守卫（先 `await flush` 成功才切）+ 章号守卫 + 集成用例。
- 验收报告：`.openfeel/tmp/stage-04-acceptance.md`

### v0.1.0-stage-05（单 Agent 章节生成 + 设定卡）@openfeel-feel-tester

- **2 个 low Bug，均已闭环**（修复 commit `e3a9e5a`，验收人 openfeel-feel-tester）；验收结论 **DoD 9/11 自动通过 + 2 项人工协验待办**；门禁 `pnpm test` 35 文件 133/133、lint/build、`cargo test` 42/42 全绿。
- [`generation.md`](generation.md)：**BUG-001** — `v0.1-e2e.test.tsx` 未含 C-03 Profiler 断言，与 op-006 声明不一致 → `vi.mock("@tiptap/react")` 将真实 `EditorContent` 包进 `<Profiler>` + 非空洞性守卫（集成路径 C-03 成立）。
- [`build.md`](build.md)：**BUG-001** — chunk 体积登记值（311KB / gzip 97KB）与实际（~850KB / gzip ~268KB）严重不符 → 活文档更正为实测值（历史评审留痕不改）。
- 验收报告：`.openfeel/tmp/stage-05-acceptance.md`

### v0.2.0-stage-06（审查流水线：剧情/世界观/合规/真人感）@openfeel-feel-tester

- **1 个 low Bug，已闭环**（修复 commit `1bbd3e8`，验收人 openfeel-feel-tester）；验收结论 **DoD 10 条 9 完整满足 + 1 项人工协验 BLOCKED**；门禁 `pnpm test` **52 文件 221/221**、lint/build、`cargo test` **45/45** 全绿。
- [`review.md`](review.md)：**BUG-001** — 评审输入未沿用预算裁剪，长章正文全量送入四维评审与重写 prompt → 新增 `budget.ts`（`REVIEW_CONTENT_BUDGET` 单一来源复用 stage-05 装配预算=8000 + `trimReviewContent`），接入 `llm-judge.ts`/`rewrite.ts`；临时探针证实超长输入被裁剪。
- 验收报告：`.openfeel/tmp/stage-06-acceptance.md`
