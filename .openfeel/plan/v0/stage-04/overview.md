# v0.1.0-stage-04

## 目标

实现小说编辑器基础：Tiptap（**3.31.4**）按章节分文档的所见即所得 + Markdown 编辑、「卷 → 章」左侧大纲树与拖拽排序、自动保存（含 flush/重试）、应用外壳与选书，并为 stage-05 预留 **AI 增量插入接口**。
（v2：依据 REV-v0.1.0-stage-04 修订，详度对齐 stage-02/03；见 `plan.md`。）

## 依赖

- v0.1.0-stage-01（硬，已归档）
- v0.1.0-stage-02（硬，已归档）
- v0.1.0-stage-03（**软**，已归档）：T8 插入接口复用 `subscribeChunks`/`throttleChunks`
- 附带清理：stage-03 遗留 REV-015/016（并入本阶段首个 op）

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T9）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 清理 stage-03 遗留 REV-015/016（chore） | T9 | — |
| op-002 | 集成 Tiptap 基础编辑器与依赖版本表 | T1 | op-001 |
| op-003 | 章节文档模型与切换 + editorStore | T2 | op-002 |
| op-004 | Markdown 输入/导入导出与往返测试 | T3 | op-002 |
| op-005 | 卷→章 大纲树与 dnd-kit 排序 | T4 | op-002 |
| op-006 | 自动保存与状态提示：防抖/flush/重试 | T5 | op-003 |
| op-007 | 长文性能基准与 editorStore 单一事实源 | T6 | op-006 |
| op-008 | 应用外壳与选书上下文 | T7 | op-005 |
| op-009 | AI 增量插入接口 EditorController | T8 | op-003 |
| op-010 | 修复切章未 flush 导致的数据丢失（BUG-001）(fix) | T5（补） | op-003/005/006/008 |

> 说明：`editorStore`（Zustand 首次接入）随 T2（op-003）引入（供 T2/T5/T6 共用）；T6（op-007）承担其**单一事实源边界验证**与性能基准。
> op-010 为 **test_failed 修复闭环**：接线切章前 flush（BUG-001 high），仅改 op-003/005/006/008 的产出文件，修复后经 openfeel-feel-tester 复验。

### 定稿要点（摘要）
- **存储格式**：**v0.1 沿用 `content_format='html'`**（`getHTML()`/`setContent` 原生往返），**零迁移**，word_count html 分支复用；tiptap-json 留待需要。
- **依赖版本表（精确）**：`@tiptap/{react,core,pm,starter-kit,markdown}` 3.31.4、`zustand` 5.0.15、`@dnd-kit/{core,sortable,utilities}` 6.3.1 / 10.0.0 / 3.2.2（React 19 peer 已确认）。
- **一章一实例**：切章销毁/重建；`editorStore` **不持文档全量**（单一事实源在 Tiptap 实例），仅元状态。
- **T8 AI 增量插入接口**：`EditorController.appendChunk(text)` / `flushPending()`；撤销合并为会话单条；IME 排队策略。stage-05 消费，不越界改编辑器。
- **自动保存**：防抖 800ms；切章前同步 flush、退出前 flush；失败置脏 + 5s 重试。
- **性能方法学**：按键→DOM 更新 P95 < 16ms（真实 WebView，脚本入库）；切 20 章后实例数=1、堆增幅 < 20%；IME 单独口径。
- **组件落点**：`src/features/editor/`；启用 i18n `editor` 命名空间。

### schemer 落实结果
- op 拆分：9 个 op，首 op 并入 REV-015/016 清理（标 `(chore)`），见上表。
- **版本复核**（`npm view`，2026-10-09）：`@tiptap/{react,core,pm,starter-kit,markdown}` 3.31.4、`zustand` 5.0.15、`@dnd-kit/{core,sortable,utilities}` 6.3.1/10.0.0/3.2.2 **均存在且为当前最新**；peer：`@tiptap/react` 支持 `react ^19`、`zustand` 支持 `react >=18`。版本表入 op-002 / `kb/setup.md`。
- 文档同步落点：`docs/ipc.md §8.1`（op-001）、`docs/structure.md`（op-002 落点 / op-003 editorStore 边界与 `content_format='html'` / op-007 性能口径）、`manual/index.md` + `manual/features/editor.md`（op-009）。
