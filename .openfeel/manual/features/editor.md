# 模块手册：编辑器（features/editor）

## 职责

FateQuill 的写作编辑器域：章节富文本编辑、卷→章大纲树、自动保存与 **AI 增量插入接口**。建立于 **v0.1.0-stage-04**。

## 目录结构 / 关键文件

```
src/features/editor/
├── editor-extensions.ts     # Tiptap 扩展（StarterKit h1–h3 + undoRedo.newGroupDelay=5000 + Markdown）
├── RichTextEditor.tsx       # 基础编辑区（HTML 入 / getHTML() 出）
├── ChapterEditor.tsx        # 一章一实例（key={chapterId} 重挂载）+ 自动保存接线
├── useChapter.ts            # 按 id 加载章节
├── useAutoSave.ts           # 防抖 800ms + flush + 5s 重试 + 串行化保存
├── EditorStatusBadge.tsx    # 保存状态指示
├── OutlineTree.tsx          # 卷→章大纲树（dnd-kit 排序）
├── OutlineVolumeNode.tsx / OutlineChapterNode.tsx
├── useOutline.ts            # 大纲加载 + computeDropAction 纯函数
├── useNovels.ts / NewNovelPanel.tsx / WorkspaceLayout.tsx  # 工作区外壳与选书
├── EditorController.ts      # AI 增量插入接口（appendChunk/flushPending/dispose）
├── useChunkInjection.ts     # 桥接 stage-03 subscribeChunks → 编辑器
└── perf/                    # 长文性能基准（真实 WebView；jsdom 不可测延迟）
```

## 核心 API / 约定

- **存储格式 `content_format='html'`**：保存 `editor.getHTML()` → `chapter.content`；加载 `setContent(html)`；零迁移（复用 stage-02 schema）。
- **一章一实例（C-01）**：切章 `key={chapterId}` 重挂载，实例数恒为 1。
- **`EditorController`（T8）**：`appendChunk(text, options?)` / `flushPending()` / `dispose()`；`options.addToHistory` 为**预留**（当前恒入历史）。
- **撤销会话合并（REV-009）**：流式插入**恒入历史**，由 prosemirror-history `newGroupDelay=5000`（`editor-extensions.ts`）把生成期间相邻插入合并为单条 → **一次 `Ctrl+Z` 撤销整段生成**；用户编辑自然断组。
- **IME 排队（REV-010）**：监听 `editor.view.dom` 的 `compositionstart/end`，组合期间入队、`compositionend` 后 flush；`dispose()` 移除监听。
- **切章前 flush（BUG-001 修复，stage-04 op-010）**：唯一合法切章入口 = `WorkspaceLayout.requestSelectChapter` —— 先 `await flushRef.current()`（保存**旧**章）**成功才** `setCurrentChapter`；失败置 `saveStatus='error'` 并**阻断切章**（不丢数据）。`OutlineTree` **不直连** store 切章，改用注入的 `onSelectChapter`；`useAutoSave.flush()` 返回 `Promise<boolean>` 且带 `chapterIdRef` 章号守卫（旧实例闭包不回写当前章）；重命名/删除当前章卷前亦先 flush。
- **`editorStore` 边界**：`src/store/editorStore.ts` 仅元状态（`currentNovelId`/`currentChapterId`/`saveStatus`/`lastSavedAt`），**不含文档正文**（内容在 Tiptap 实例）。
- **消费侧**：stage-05 `generationStore` 订阅 stage-03 `subscribeChunks` 输出 → `appendChunk`（不直接操作编辑器内部）。

## 已知遗留（非阻塞，stage-04 归档时）

- **性能人工协验**：DoD #1（真实 WebView P95 < 16ms）与 #2（切 20 章实例数=1 / 堆增幅 < 20%）为人工协验项，`perf/README.md` 实测记录表待回填（脚本/面板已入库）。
- **构建体积警告**：`pnpm build` 入口 chunk 850KB（gzip 268KB，Tiptap/ProseMirror 固有；2026-10-10 实测），v0.1 接受现状。
- **REV-013/014/015**：op-006 验证口径过宽、perf 人工协验待回填、chunk 体积警告（均 low，建议随 stage-05 清理）。

## 关联文档

- 目录/边界：`docs/structure.md`（§4 store 边界、§10 存储格式、§11 性能基准）。
- 编排/流式：`.openfeel/manual/orchestration/engine.md`、`src/orchestration/stream/`。
- 性能基准操作手册：`src/features/editor/perf/README.md`。
- 持久化：`.openfeel/manual/core/domain-storage.md`。
- 知识库：`.openfeel/kb/architecture.md`（分层/一章一实例/T8 契约）、`kb/patterns.md`（切章守卫/flush 契约/撤销合并/串行链）、`kb/troubleshooting.md`（set-state-in-effect/IME 总线/切章丢数据）。
