/**
 * 大纲解析（stage-12 T2）
 *
 * 面板输入 → 章条目：**每行一章**；支持 `标题：指令`（缺省指令同标题）；空行忽略。
 * 独立文件放置（避免组件文件混合导出常量/函数，触发 `react-refresh/only-export-components`）。
 */

import type { AutopilotChapterInput } from "@/orchestration/autopilot/types";

/** 大纲文本 → 章条目 */
export function parseOutline(text: string): AutopilotChapterInput[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [head, ...rest] = line.split(/[:：]/);
      const title = head.trim() || `第${index + 1}章`;
      const instruction = rest.join("：").trim() || title;
      return { index, title, instruction };
    });
}
