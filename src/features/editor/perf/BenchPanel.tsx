import { useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { editorExtensions } from "../editor-extensions";
import { runEditorBench } from "./editor-bench";
import { makeHtml } from "./seed";

interface PerfMemory {
  usedJSHeapSize: number;
}

/** 读取堆用量（Chrome/WebView2 `performance.memory`，非标准） */
function heapUsed(): number | null {
  const mem = (performance as Performance & { memory?: PerfMemory }).memory;
  return mem ? mem.usedJSHeapSize : null;
}

/**
 * 真实 WebView 性能基准面板（**仅 DEV**）。
 * jsdom 无布局，不可用于延迟测量；请在 `pnpm tauri dev` 窗口内使用。
 *
 * **折叠式、默认收起**：默认仅一行小按钮；展开后显示三个基准与编辑区——
 * 编辑区带**高度约束**（`max-h-48 overflow-auto`），避免 5000 字种子铺满整屏遮盖工作区。
 */
export function BenchPanel() {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const editor = useEditor({ extensions: editorExtensions, content: makeHtml(5000) });
  const [p95ms, setP95ms] = useState<number | null>(null);
  const [instances, setInstances] = useState<number | null>(null);
  const [heapDelta, setHeapDelta] = useState<number | null>(null);

  if (!import.meta.env.DEV) return null;

  async function runLatency() {
    if (!editor) return;
    setP95ms(await runEditorBench(editor, 200));
  }

  /** 统计本草稿外部的 `.ProseMirror` 实例数（即编辑区实例数，应为 1） */
  function measureInstances() {
    const root = panelRef.current;
    const count = Array.from(document.querySelectorAll(".ProseMirror")).filter(
      (el) => !root?.contains(el),
    ).length;
    setInstances(count);
  }

  function measureHeap() {
    const before = heapUsed();
    if (editor) {
      for (let i = 0; i < 50; i++) editor.commands.insertContent("字");
    }
    const after = heapUsed();
    if (before != null && after != null && before > 0) {
      setHeapDelta((after - before) / before);
    }
  }

  return (
    <div ref={panelRef} className="border-border shrink-0 border-t px-4 py-1 text-xs">
      {/* 默认收起：仅一行小按钮（不占版面、不遮挡工作区） */}
      <button
        type="button"
        data-testid="bench-toggle"
        aria-expanded={open}
        className="opacity-60 hover:opacity-100"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "▾ 性能基准 (DEV)" : "▸ 性能基准 (DEV)"}
      </button>

      {open && (
        <div data-testid="bench-body" className="border-border mt-2 mb-2 rounded border p-3">
          <div className="font-medium">Editor Benchmark (DEV only)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={runLatency}>
              运行延迟基准（200 次插入）
            </button>
            <button type="button" onClick={measureInstances}>
              统计 .ProseMirror 实例数
            </button>
            <button type="button" onClick={measureHeap}>
              记录堆增幅
            </button>
          </div>
          <ul className="mt-2">
            <li>P95: {p95ms == null ? "—" : `${p95ms.toFixed(2)} ms`}（目标 &lt; 16ms）</li>
            <li>.ProseMirror 实例数: {instances ?? "—"}（切 20 章后应 = 1）</li>
            <li>
              堆增幅: {heapDelta == null ? "—" : `${(heapDelta * 100).toFixed(1)}%`}（目标 &lt;
              20%）
            </li>
          </ul>
          {/* 高度约束：展开时也不铺满（可滚动查看 5000 字种子） */}
          <div className="mt-2 max-h-48 overflow-auto rounded border">
            <EditorContent editor={editor} />
          </div>
        </div>
      )}
    </div>
  );
}
