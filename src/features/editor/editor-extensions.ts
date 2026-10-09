import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

/**
 * 编辑器扩展：StarterKit（含撤销栈）+ 官方 Markdown；标题限定 h1–h3。
 * undoRedo.newGroupDelay=5000：把时间窗内相邻事务合并为单条历史 —— 支撑 T8「一次撤销整段生成」（REV-009）。
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    undoRedo: { newGroupDelay: 5000 },
  }),
  Markdown,
];
