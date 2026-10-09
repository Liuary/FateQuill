/**
 * 角色宿命映射：一次性宿命提示卡（stage-09 T4）
 *
 * 定位：起卦后把**宿命提示**映射到选定目标（角色 / 设定卡），产出**一次性**提示卡；
 * 用户可将它**写入 `setting_card`**（复用既有编辑链路，**零迁移**），此后自然进入下一轮
 * 注入与覆盖判据（复用 stage-08 机制，**零新增逻辑**）。
 *
 * **形态**：v0.3 为**一次性提示卡**（不做跨章自动持续约束）；**确定性**（同卦象同目标 → 同卡）。
 */

import { buildGuideCard } from "./guide";
import type { Casting } from "./types";

/** 一次性宿命提示卡 */
export interface FateCard {
  title: string;
  content: string;
}

/** 由起卦结果与目标名构造**一次性**宿命提示卡（确定性；提示为白文说明，非经文断言） */
export function buildFateCard(casting: Casting, targetName: string): FateCard {
  const guide = buildGuideCard(casting);
  const content = [
    `对象：${targetName}`,
    `本卦：${guide.hexagramName}`,
    ...guide.fateHints.map((hint) => `- ${hint}`),
  ].join("\n");
  return { title: `宿命·${guide.hexagramName}`, content };
}
