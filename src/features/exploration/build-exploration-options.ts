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
import { selectInjectableCards } from "@/orchestration/consistency/inject";
import { repositories } from "@/ipc/repositories";

/** 去 HTML 标签（前章末尾按可见文本入 prompt，与 stage-05 生成口径一致） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * 装配推演 `ChatOptions`（provider 无关）：**用户设定约束并入 system 段**（生成期克制收敛第一层），
 * 前章末尾按 stage-05 预算取末尾；**走向意向为 user 段**。
 *
 * 返回附带 `settingCardIds`（本次注入的设定卡 id 集），供产出期**覆盖检查**（收敛第二层）使用。
 */
export async function buildExplorationOptions(params: {
  novelId: number;
  chapterId: number | null;
  intent: string;
  model: string;
  temperature: number;
  /** 可选：卦象引导文本（开启易经时并入 **system 约束段**；缺省 → 输出与基线逐字段一致） */
  hexagramGuide?: { text: string };
  /** 可选：**大六壬**课体引导文本（与 `hexagramGuide` **并列可选**、可叠加；缺省/空 → 逐字段一致） */
  liurenGuide?: { text: string };
  /**
   * 注入开关（默认 `true`）：`false` → **完全不注入**设定卡（纯净基线）。
   * **无论开关取值，`dark`（暗线）/ `temp` 恒不注入**（安全优先，开关不可绕过）。
   */
  injectSettings?: boolean;
}): Promise<{ options: ChatOptions; settingCardIds: number[] }> {
  // 分级注入：仅白名单 `{main,short}` 进入 prompt（**生产恒排 dark**）
  const loadedCards = await repositories.settingCard.listByNovel(params.novelId);
  const injectable = params.injectSettings === false ? [] : selectInjectableCards(loadedCards);
  const settingCards: ChapterSettingCard[] = injectable.map((card) => ({
    id: card.id,
    title: card.title,
    content: card.content,
  }));

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

  // 约束进 system 段：设定卡文本并入 systemPrompt；settings 传 [] 避免重复
  const constraints =
    settingCards.length > 0
      ? `用户设定约束：\n${settingCards.map((card) => `${card.title}: ${card.content}`).join("\n")}`
      : "";
  // 卦象引导（stage-09 T5，**可选**）：缺省/空 → 不产生空段，输出与基线**逐字段一致**
  const guideText = params.hexagramGuide?.text?.trim();
  // 大六壬课体引导（stage-12 T1，**可选、与卦象并列**）：缺省/空 → 不产生空段
  const liurenText = params.liurenGuide?.text?.trim();
  const systemPrompt = [
    TURN_CARD_SYSTEM_PROMPT,
    constraints,
    guideText ? `易经卦象引导：\n${guideText}` : "",
    liurenText ? `大六壬课体引导：\n${liurenText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const options = buildChapterPrompt({
    systemPrompt,
    settingCards: [], // 已并入 system 段（避免重复注入）
    previousChapterTail,
    userInstruction: params.intent, // 走向意向 → user 段
    model: params.model,
    temperature: params.temperature,
  });

  return { options, settingCardIds: settingCards.map((card) => card.id) };
}
