import type { Editor } from "@tiptap/react";

/** 计算 P95（升序样本） */
export function p95(samples: number[]): number {
  if (samples.length === 0) return 0;
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
}

/** 在真实 WebView 中运行：逐次插入文本并测量「dispatch→DOM」耗时，返回 P95(ms) */
export async function runEditorBench(editor: Editor, insertions = 200): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < insertions; i++) {
    const t0 = performance.now();
    editor.commands.insertContent("字");
    await new Promise<void>((r) => requestAnimationFrame(() => r())); // 对齐帧预算
    samples.push(performance.now() - t0);
  }
  return p95(samples);
}
