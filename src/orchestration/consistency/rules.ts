/**
 * L1 规则校验（stage-11 T3）
 *
 * 职责：**结构化冲突**检出——**纯函数、零 LLM、零网络**（零幻觉 / 零成本）。
 * 口径：从设定卡文本抽取「实体 + 属性 + 值」断言（保守正则），仅当**同一实体的同一属性**
 * 在不同卡上取到**明确矛盾**的值时报告（**宁缺毋滥**，压制误报）；不确定项**不报**（交 L2）。
 *
 * 实体闭集：仅取**卡标题**（不臆造实体名）——这是「零幻觉」的结构性保证：
 * 报告中的 `evidence` 一律为卡文本中的**逐字句子**。
 */

import type { ConflictReport, ConflictType, L1Attribute, ConflictSeverity } from "./types";

/** L1 输入卡（最小面：id / 标题 / 正文） */
export interface L1Card {
  id: number;
  title: string;
  content: string;
}

/** 结构化断言（实体 + 属性 + 值 + **原文句子**） */
export interface L1Assertion {
  cardId: number;
  entity: string;
  attribute: L1Attribute;
  /** 归一值（生死：`dead`/`alive`；时间线 / 数值：数字字符串） */
  value: string;
  /** 断言所在**原文句子**（逐字，供 evidence） */
  sentence: string;
}

/** 死亡语义关键词（保守：仅明确表述） */
const LIFE_DEAD = /(已死|死亡|身亡|已故|殒命|殉难|死于)/;
/** 存活语义关键词（保守：仅明确表述） */
const LIFE_ALIVE = /(存活|活着|在世|健在|未死|尚在人间|尚在人世)/;
/** 时间线：阿拉伯数字 + 年（不做中文数字解析，避免误判） */
const TIMELINE = /(\d{1,4})\s*年/;
/** 数值：阿拉伯数字 + 计量词 */
const NUMERIC = /(\d{1,4})\s*(?:岁|岁数|人|名|枚|件|里|丈|次)/;

/** 句子切分（句末标点 / 分号 / 换行） */
function sentences(content: string): string[] {
  return content
    .split(/[。！？；\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** 提取一张卡上的断言（实体 = 卡标题；实体名须在同一句内出现） */
function assertionsOf(card: L1Card): L1Assertion[] {
  const entity = card.title.trim();
  if (!entity) {
    return [];
  }
  const out: L1Assertion[] = [];
  for (const sentence of sentences(card.content)) {
    if (!sentence.includes(entity)) {
      continue; // 未提及该实体：不产出断言（宁缺毋滥）
    }
    const lifeDead = LIFE_DEAD.test(sentence);
    const lifeAlive = LIFE_ALIVE.test(sentence);
    if (lifeDead !== lifeAlive) {
      // 同一句内生死表述互相矛盾 → 不确定，跳过（避免自相矛盾句误报）
      out.push({
        cardId: card.id,
        entity,
        attribute: "life-status",
        value: lifeDead ? "dead" : "alive",
        sentence,
      });
    }
    const timeline = sentence.match(TIMELINE);
    if (timeline) {
      out.push({
        cardId: card.id,
        entity,
        attribute: "timeline",
        value: timeline[1],
        sentence,
      });
    }
    const numeric = sentence.match(NUMERIC);
    if (numeric) {
      out.push({
        cardId: card.id,
        entity,
        attribute: "numeric",
        value: numeric[1],
        sentence,
      });
    }
  }
  return out;
}

/** 属性 → 冲突类型（一一对应） */
const TYPE_OF: Record<L1Attribute, ConflictType> = {
  "life-status": "life-status",
  timeline: "timeline",
  numeric: "numeric",
};

/** 类型 → 严重度（L1 结构化冲突；生死最重、数值最轻） */
export const L1_SEVERITY: Record<L1Attribute, ConflictSeverity> = {
  "life-status": "high",
  timeline: "medium",
  numeric: "low",
};

/** 抽取全部断言（导出供单测与后续报告使用） */
export function extractAssertions(cards: L1Card[]): L1Assertion[] {
  return cards.flatMap(assertionsOf);
}

/**
 * L1 规则校验：同一实体 + 同一属性在**不同卡**上值**明确不同** → 报告冲突。
 * 返回按 `(aId,bId,type)` 稳定排序的报告列表（无冲突 → 空数组）。
 */
export function runL1Rules(cards: L1Card[]): ConflictReport[] {
  const assertions = extractAssertions(cards);
  const groups = new Map<string, L1Assertion[]>();
  for (const assertion of assertions) {
    const key = `${assertion.entity}|${assertion.attribute}`;
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(assertion);
    } else {
      groups.set(key, [assertion]);
    }
  }

  const reports: ConflictReport[] = [];
  for (const bucket of groups.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const a = bucket[i];
        const b = bucket[j];
        if (a.cardId === b.cardId || a.value === b.value) {
          continue; // 同卡自比 / 值相同（一致）→ 不报
        }
        const [first, second] = a.cardId < b.cardId ? [a, b] : [b, a];
        reports.push({
          aId: first.cardId,
          bId: second.cardId,
          type: TYPE_OF[a.attribute],
          // evidence 为两张卡的原句（逐字）——**零幻觉**
          evidence: `${first.entity}：「${first.sentence}」 ｜「${second.sentence}」`,
          severity: L1_SEVERITY[a.attribute],
        });
      }
    }
  }

  return reports.sort((x, y) => x.aId - y.aId || x.bId - y.bId || x.type.localeCompare(y.type));
}
