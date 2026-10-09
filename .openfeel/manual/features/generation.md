# 模块手册：生成（features/generation）

## 职责

FateQuill 的 **AI 生成**域：生成入口（第三栏面板）、生成元状态（`generationStore`）与**模式 A 流式直插**接线（stage-03 `subscribeChunks` → 节流 → stage-04 `EditorController.appendChunk`）。建立于 **v0.1.0-stage-05**。

## 目录结构 / 关键文件

```
src/features/generation/
├── GenerationPanel.tsx          # 仅状态面板（开始/停止/重试 + 进度 + 错误 + 停止提示；无预览）
├── useGeneration.ts             # 编排：装配 ChatOptions → provider.stream → subscribeChunks → appendChunk
├── useGenerationAvailability.ts # 可用性（model_config + keyring Key）→ 引导 Settings
├── resolve-provider.ts          # 由 model_config 实例化 provider 适配器
└── build-chapter-options.ts     # 数据装配：设定卡 + 前章末尾 → ChatOptions（见 orchestration/prompts）
```

配套：
- `src/orchestration/prompts/chapter-generation.ts`：提示模板（`CHAPTER_GENERATION_PROMPT_VERSION` + 预算裁剪）。
- `src/store/generationStore.ts`：元状态。
- `src/features/editor/EditorController.ts`：AI 增量插入（`appendChunk`/`flushPending`/`dispose`）。

## 核心 API / 约定

- **`generationStore` 边界**：`status('idle'|'streaming'|'done'|'error'|'aborted')` / `chapterId` / `requestId` / `progress.chars` / `error`；**不持正文**；与 `editorStore` **各自独立 `create()`，不互相 setState**（C-03）。停止/失败收敛态统一 `idle` 且 `requestId=null`。
- **模式 A 流式直插**：`subscribeChunks`（stage-03 节流 ≥50ms）→ `EditorController.appendChunk`；编辑器流式期间**零 React 重渲染**（C-03 Profiler 断言）；`dispatch ≤ chunk/2`、无 `setContent` 全量。
- **停止/失败**：已插入内容**保留草稿**；`Ctrl+Z` 一次撤销整段生成（依赖 `newGroupDelay=5000`）；UI 提示 `stoppedHint`。
- **Key 引导**：无 `model_config` 或 keyring 无 Key → 生成按钮禁用 + 引导 Settings。
- **IPC**：复用 `http_stream`/`abort_stream`（stage-03）+ 仓储命令；**不新增命令**。

## 关联文档

- 目录/边界：`docs/structure.md` §4/§12；IPC：`docs/ipc.md` §6。
- 编排/流式：`.openfeel/manual/orchestration/engine.md`、`src/orchestration/stream/`。
- 编辑器：`.openfeel/manual/features/editor.md`（`EditorController`、一章一实例）。
- 真机冒烟：`docs/smoke-check-v0.1.md`。
