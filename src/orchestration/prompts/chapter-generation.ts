import type { ChatOptions, ChatMessage } from "@/orchestration/types";

/** 提示模板版本（stage-07 skill 注入以此为锚点） */
export const CHAPTER_GENERATION_PROMPT_VERSION = "1.0.0";

/** 预算（默认值，可配置；单位=字符数） */
export const PROMPT_BUDGET = {
  system: 1000,
  settingCards: 2000,
  prevTail: 2000,
  total: 8000,
} as const;

/** v0.1 单 Agent 系统提示（版本化常量）：简体中文小说创作助手，去 AI 味，输出仅正文 */
export const DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT =
  "你是简体中文长篇小说创作助手。请以克制、自然的文风续写正文，避免套话、排比与过度修饰，去除“AI 味”。" +
  "忠实于既有设定与前文语气，只输出正文本身，不要解释、不要标题、不要代码块。";

export interface ChapterSettingCard {
  id: number;
  title: string;
  content: string;
}

export interface ChapterPromptInput {
  systemPrompt: string;
  settingCards: ChapterSettingCard[];
  previousChapterTail: string; // 前章末尾（HTML/纯文本；此处按预算取末尾）
  userInstruction: string; // 本章要求（不裁）
  model: string;
  temperature?: number;
}

type Budget = typeof PROMPT_BUDGET;

const head = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n));
const tail = (s: string, n: number): string => (s.length <= n ? s : s.slice(s.length - n));

/** 设定卡拼接（按序，`标题: 内容`）并累计裁剪至 ≤ limit */
function joinSettingCards(cards: ChapterSettingCard[], limit: number): string {
  let out = "";
  for (const card of cards) {
    const piece = `${card.title}: ${card.content}`;
    const candidate = out ? `${out}\n${piece}` : piece;
    if (candidate.length <= limit) {
      out = candidate;
      continue;
    }
    const remain = limit - out.length - (out ? 1 : 0);
    if (remain > 0) {
      out = `${out}${out ? "\n" : ""}${head(piece, remain)}`;
    }
    break;
  }
  return out;
}

/**
 * 组装章节生成 `ChatOptions`（**provider 无关**）：
 * - 系统 ≤ system 预算；用户指令**不裁**；
 * - 设定卡 ≤ settingCards 预算；前文取**末尾** ≤ prevTail 预算；
 * - 合计超 total 时按「**设定卡 → 前文**」裁剪（系统/指令不裁）。
 */
export function buildChapterPrompt(
  input: ChapterPromptInput,
  budgetOverride?: Partial<Budget>,
): ChatOptions {
  const budget: Budget = { ...PROMPT_BUDGET, ...budgetOverride };

  const system = head(input.systemPrompt, budget.system);
  const instruction = input.userInstruction; // 不裁
  let settings = joinSettingCards(input.settingCards, budget.settingCards);
  let prevTail = tail(input.previousChapterTail, budget.prevTail);

  const totalLen = () => system.length + settings.length + prevTail.length + instruction.length;

  if (totalLen() > budget.total) {
    // ① 先削设定卡（可清空）
    const roomForSettings = budget.total - (system.length + prevTail.length + instruction.length);
    settings = roomForSettings <= 0 ? "" : head(settings, roomForSettings);
    // ② 仍超再削前文（可清空）
    if (totalLen() > budget.total) {
      const roomForTail = budget.total - (system.length + instruction.length + settings.length);
      prevTail = roomForTail <= 0 ? "" : tail(prevTail, roomForTail);
    }
  }

  const userContent = [settings, prevTail, instruction].filter(Boolean).join("\n\n");
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: userContent },
  ];
  return { model: input.model, temperature: input.temperature, messages };
}
