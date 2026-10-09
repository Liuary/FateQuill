/**
 * 推演输入装配（stage-08 T1）
 *
 * 职责：**复用 stage-05 装配**（`buildChapterPrompt`：设定卡 + 前章末尾 + 预算裁剪）：
 * - **走向意向** → `userInstruction`（**user 段**）；
 * - **推演约束**（走向卡 JSON 契约）→ `systemPrompt`（**system 段**）；
 * - 温度按 `effectiveTemperature` 逐分支下发。
 */

import type { ChatOptions } from "@/orchestration/types";
import {
  buildChapterPrompt,
  type ChapterSettingCard,
} from "@/orchestration/prompts/chapter-generation";
import { TURN_CARD_SYSTEM_PROMPT } from "@/orchestration/exploration/parse";
import { repositories } from "@/ipc/repositories";

/** 去 HTML 标签（前章末尾按可见文本入 prompt，与 stage-05 生成口径一致） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * 装配推演 `ChatOptions`（provider 无关）：设定卡 + 前章末尾 + 走向意向 + 推演约束。
 */
export async function buildExplorationOptions(params: {
  novelId: number;
  chapterId: number | null;
  intent: string;
  model: string;
  temperature: number;
}): Promise<ChatOptions> {
  const settingCards: ChapterSettingCard[] = (
    await repositories.settingCard.listByNovel(params.novelId)
  ).map((card) => ({ id: card.id, title: card.title, content: card.content }));

  let previousChapterTail = "";
  if (params.chapterId !== null) {
    const chapter = await repositories.chapter.get(params.chapterId);
    const siblings = (await repositories.chapter.listByVolume(chapter.volumeId)).sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const index = siblings.findIndex((c) => c.id === chapter.id);
    const previous = index > 0 ? siblings[index - 1] : null;
    previousChapterTail = previous ? stripHtml(previous.content) : "";
  }

  return buildChapterPrompt({
    systemPrompt: TURN_CARD_SYSTEM_PROMPT,
    settingCards,
    previousChapterTail,
    userInstruction: params.intent, // 走向意向 → user 段
    model: params.model,
    temperature: params.temperature,
  });
}
