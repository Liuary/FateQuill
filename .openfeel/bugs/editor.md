# Bug 追踪：editor（编辑器与大纲树）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/editor/`。

## closed

### BUG-001：切章不 flush 导致未保存内容丢失（high）
- **阶段**：v0.1.0-stage-04（T5 / BUG-001）
- **现象**：编辑第 1 章后在 800ms 防抖窗口内切第 2 章，第 1 章的编辑**永久丢失**（实测 `update_chapter` 仅写第 2 章、零写第 1 章）。
- **根因**：`ChapterEditor` 暴露的 `onFlushReady` 无消费方，`OutlineTree.selectChapter` 直接 `setCurrentChapter(id)` 未先 `await flush()`；切章时旧 Tiptap 实例被销毁，防抖计时器回调旧闭包 `getHTML()` 失败，重试经 `enqueueRef` 误写**当前活动章**。
- **影响**：数据丢失；违反 DoD 第 5 条「切章/退出前 flush 无丢失」（阶段最高风险点）。
- **修复**（commit `6d7d180`）：① `WorkspaceLayout` 持 `flushRef` + 唯一守卫入口 `requestSelectChapter`（先 `await flush` 成功才切、失败置 `saveStatus='error'` 阻断）；② `OutlineTree` 撤除 `setCurrentChapter` 直连，改注入 `onSelectChapter`（重命名/删除前亦先 flush）；③ `useAutoSave.flush()` 返回 `Promise<boolean>` 并加 `chapterIdRef` 章号守卫（旧闭包不回写活动章）；④ 新增 `chapter-switch-flush.test.tsx`。
- **验收**：openfeel-feel-tester 独立复验（自写有状态 mock 全链路「编辑→<800ms 切章→切回内容完整」）通过；`pnpm test` 110 passed、lint/build/cargo 全绿。状态 **closed**。
- **经验**：跨实例切换（销毁/重建）前必须**同步 flush 并 await**；异步防抖回调须带**目标标识（章号）守卫**，避免切换后误写活动对象。

## open / fixing / resolved

- （无）
