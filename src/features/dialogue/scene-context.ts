/**
 * 场景上下文装载（stage-10 op-009，BUG-001 修复）
 *
 * 职责：为对话生成提供**公共场景**三块——**设定卡** + **前章末尾** + **用户场景指令**（会话态）。
 * 取值口径与 stage-08 `build-exploration-options` 一致（同卷排序取前章、**去 HTML 标签**），
 * 并把「前章末尾」按 stage-05 `PROMPT_BUDGET.prevTail` **限长取末尾**（避免无界 prompt 增长）。
 *
 * 失败**不阻断**：装载异常降级为空值（生成仍可进行，仅缺该块）。
 * **复用既有 IPC**（`list_setting_cards` / `get_chapter` / `list_chapters`），零新增依赖 / 无迁移。
 */

import { useEffect, useState } from "react";
import { repositories } from "@/ipc/repositories";
import type { PublicContextInput } from "@/orchestration/dialogue/context";
import { PROMPT_BUDGET } from "@/orchestration/prompts/chapter-generation";

/** 场景上下文输入（`PublicContextInput` 的**场景三块子集**，此处**必填**——由 `useSceneContext` 保证；
 *  `history` 由编排实时从会话 store 取） */
export type SceneContextInput = Required<
  Pick<PublicContextInput, "settingCards" | "previousChapterTail" | "sceneInstruction">
>;

/** 设定卡（公共场景设定；`{ title, content }` 形态） */
export interface SceneSettingCard {
  title: string;
  content: string;
}

/** 前章末尾**限长**（与 stage-05 生成预算 `prevTail` 同源，单位=字符） */
export const PREVIOUS_TAIL_LIMIT: number = PROMPT_BUDGET.prevTail;

/** 去 HTML 标签（按可见文本入 prompt，口径与 stage-05/08 一致） */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** 取末尾限长（超出则保留末尾 `PREVIOUS_TAIL_LIMIT` 字符） */
function tail(text: string, limit: number = PREVIOUS_TAIL_LIMIT): string {
  return text.length <= limit ? text : text.slice(text.length - limit);
}

/** 装载设定卡（失败 → 空数组，不阻断生成） */
async function loadSettingCards(novelId: number): Promise<SceneSettingCard[]> {
  const cards = await repositories.settingCard.listByNovel(novelId);
  return cards.map((card) => ({ title: card.title, content: card.content }));
}

/**
 * 装载「前章末尾」：当前章 → 同卷兄弟章按 `orderIndex` 排序 → **前一章** `content` 去标签取末尾；
 * 无前章 / 未选章 → 空串。
 */
async function loadPreviousChapterTail(chapterId: number | null): Promise<string> {
  if (chapterId == null) {
    return "";
  }
  const chapter = await repositories.chapter.get(chapterId);
  const siblings = (await repositories.chapter.listByVolume(chapter.volumeId)).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const index = siblings.findIndex((sibling) => sibling.id === chapter.id);
  const previous = index > 0 ? siblings[index - 1] : null;
  return previous ? tail(stripHtml(previous.content)) : "";
}

export interface SceneContext extends SceneContextInput {
  /** 更新用户场景指令（会话态） */
  setSceneInstruction: (value: string) => void;
}

/** 场景上下文装载 hook（设定卡 + 前章末尾 + 会话态场景指令） */
export function useSceneContext(input: {
  novelId: number | null;
  chapterId?: number | null;
}): SceneContext {
  const { novelId, chapterId = null } = input;
  const [settingCards, setSettingCards] = useState<SceneSettingCard[]>([]);
  const [previousChapterTail, setPreviousChapterTail] = useState("");
  const [sceneInstruction, setSceneInstruction] = useState("");

  // 设定卡（随作品变化重载；失败 → 空数组）
  useEffect(() => {
    let alive = true;
    if (novelId == null) {
      return;
    }
    void loadSettingCards(novelId).then(
      (cards) => {
        if (alive) {
          setSettingCards(cards);
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：降级为空，不阻断生成
        if (alive) {
          setSettingCards([]);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  // 前章末尾（随当前章变化重载；无前章 → 空串）
  useEffect(() => {
    let alive = true;
    void loadPreviousChapterTail(chapterId).then(
      (tailText) => {
        if (alive) {
          setPreviousChapterTail(tailText);
        }
      },
      () => {
        // 读取失败：降级为空串
        if (alive) {
          setPreviousChapterTail("");
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [chapterId]);

  return { settingCards, previousChapterTail, sceneInstruction, setSceneInstruction };
}
