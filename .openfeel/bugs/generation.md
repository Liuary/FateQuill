# Bug 追踪：generation（生成）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/generation/`。

## closed

### BUG-001：v0.1 全链路 E2E 未含 C-03 Profiler 断言，与 op-006 声明不一致（low）
- **阶段**：v0.1.0-stage-05（T6 / BUG-001）
- **现象**：op-006 步骤 2 声明全链路 E2E 应在真链路下断言「生成期间编辑器 React 渲染计数增量 = 0」，但 `src/features/generation/v0.1-e2e.test.tsx` 仅断言代理指标（`dispatch ≤ chunk/2`、无 `setContent` 全量），**无 `Profiler`/`onRender`/render 计数断言**；C-03 仅由 `GenerationPanel.test.tsx`（直调 `createEditorController`+`subscribeChunks`，非真链路）覆盖。即「真链路下 C-03 成立」未兑现（验证口径类偏差）。
- **影响**：测试覆盖/方案一致性（low）；**不阻断 DoD**（C-03 已由 `GenerationPanel.test.tsx` 独立满足），属集成路径覆盖缺口。
- **修复**（commit `e3a9e5a`）：`v0.1-e2e.test.tsx` 以 `vi.mock("@tiptap/react")` 将真实链路中的 `EditorContent` 包进 `<Profiler id="editor" onRender>`（**不改源码，仅测试接缝**）；断言「点击开始生成 → 生成完成」区间内 render 增量 **= 0**，并加**非空洞性守卫** `expect(rendersBefore).toBeGreaterThan(0)`（确认 Profiler 生效，含挂载渲染）。
- **验收**：openfeel-feel-tester 独立复核（不轻信声明）——阅读修复后测试 + 独立探针验证（同款 mock 包裹真实 `EditorContent`，触发父组件重渲染 → 计数递增，证明插桩能捕获真实重渲染）；`vitest run v0.1-e2e.test.tsx` 1 passed、`pnpm test` 133 passed、`cargo test` 42 passed。状态 **closed**。
- **经验**：`Profiler` 断言须配**非空洞性守卫**（否则「0 增量」可能是插桩未生效的假绿）；集成 E2E 的声明须与实际断言集合逐项对齐。

## open / fixing / resolved

- （无）
