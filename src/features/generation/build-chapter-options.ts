import type { ChatOptions } from "@/orchestration/types";
import { repositories } from "@/ipc/repositories";
import {
  buildChapterPrompt,
  DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
  type ChapterSettingCard,
  type PromptSkill,
} from "@/orchestration/prompts/chapter-generation";

/** 去除 HTML 标签（前章内容以 HTML 存储；取「末尾」以纯文本口径） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * 数据装配：读取设定卡 + 前章（order_index 紧邻上一章）末尾 → 组装 `ChapterPromptInput` → `ChatOptions`。
 * **provider 无关**：`model`/`temperature` 由调用方从默认 `model_config` 提供。
 */
export async function buildChapterGenerationOptions(params: {
  novelId: number;
  chapterId: number;
  userInstruction: string;
  model: string;
  temperature?: number;
  /** 规避 skill（stage-07 T6 回注；缺省不注入，行为不变） */
  skills?: PromptSkill[];
}): Promise<ChatOptions> {
  const settingCards: ChapterSettingCard[] = (
    await repositories.settingCard.listByNovel(params.novelId)
  ).map((s) => ({ id: s.id, title: s.title, content: s.content }));

  const chapter = await repositories.chapter.get(params.chapterId);
  const siblings = (await repositories.chapter.listByVolume(chapter.volumeId)).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const idx = siblings.findIndex((c) => c.id === chapter.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const previousChapterTail = prev ? stripHtml(prev.content) : "";

  return buildChapterPrompt({
    systemPrompt: DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT,
    settingCards,
    previousChapterTail,
    userInstruction: params.userInstruction,
    skills: params.skills,
    model: params.model,
    temperature: params.temperature,
  });
}
