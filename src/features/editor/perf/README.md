# 编辑器性能基准（真实 WebView）

> 归属阶段：v0.1.0-stage-04（T6）。本目录提供**可重复、入库**的长文性能基准与操作手册。

## 口径（定稿）

- **指标**：按键/插入 → Tiptap `dispatchTransaction` → 编辑器 DOM 更新完成的耗时；统计 **P95**。
- **载荷**：前端 seed 生成 **5000 字** HTML 文档（`seed.ts` 的 `makeHtml(5000)`）。
- **环境**：**真实 WebView**（`pnpm tauri dev` 窗口内的 `BenchPanel`）。
  - **jsdom 无布局，明确不可用于延迟测量**（仅用于非延迟逻辑单测，如 `p95` 边界、`makeHtml`）。
- **内存/实例**：连续切换 **20 章**（含 5000 字章）后，`.ProseMirror` 实例数应 **= 1**；堆增幅 **< 20%**（`performance.memory.usedJSHeapSize`）。
- **IME 口径**：中文 `composition` 期间延迟**单独统计或排除**（本基准的插入不触发 IME；如需中文输入测量，记录时注明「IME 期间」）。

## 操作手册（可重复）

1. 启动桌面应用：`corepack pnpm tauri dev`。
2. 在窗口底部找到 **Editor Benchmark (DEV only)** 面板（仅开发构建可见）。
3. 点击「**运行延迟基准（200 次插入）**」→ 读取 **P95**（目标 **< 16ms**）。
4. 依次切换 **20 章**（含 5000 字章）后，点击「**统计 .ProseMirror 实例数**」→ 应显示 **1**。
5. 点击「**记录堆增幅**」→ 读取百分比（目标 **< 20%**）。
6. 将结果填入下方「实测记录」。

> 注：`BenchPanel` 自身含一个编辑区；「统计实例数」会**排除面板自身**，只计编辑区实例。

## 实测记录

| 日期       | 环境                                            |        P95 (ms)         |     切 20 章实例数      |         堆增幅          | 操作者            |
| ---------- | ----------------------------------------------- | :---------------------: | :---------------------: | :---------------------: | ----------------- |
| 2026-10-10 | Windows / WebView2 / `pnpm tauri dev`（无 GUI） | BLOCKED(需人工 WebView) | BLOCKED(需人工 WebView) | BLOCKED(需人工 WebView) | openfeel-executor |

> **BLOCKED(需人工 WebView)**：本轮执行环境**无 GUI 会话**（非交互 agent 无法启动/操作 `pnpm tauri dev` 窗口），真实 WebView 的 P95 / 切 20 章实例数 / 堆增幅**无法实测** —— 按 op-001 的 BLOCKED 处置如实标注，**不伪造数值**、**不阻塞其余任务**。REV-009（stage-05）与 REV-014（stage-04）待人工实测后再 `closed`。
>
> **所需步骤（人工）**：① `corepack pnpm tauri dev`；② 窗口内 BenchPanel「运行延迟基准（200 次插入）」读取 **P95**（目标 < 16ms）；③ 依次切换 20 章后「统计 .ProseMirror 实例数」（应 = 1）；④ 「记录堆增幅」（目标 < 20%）；⑤ 将三项连同日期/环境/操作者填入上表（替换 BLOCKED 行）。
