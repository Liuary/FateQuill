/**
 * 误报率标注样本集验收（stage-11 T3）
 *
 * 口径：**L1 自动口径**（纯函数、离线、零 LLM）——在 ≥3 章**预埋冲突**样本集上计算
 * `误报率 = 误报数 / 报出总数`，断言 ≤ `MISREPORT_THRESHOLD`（占位 0.2，**待用户拍板**）；
 * 同时断言**召回**（预埋冲突全部检出）与**证据完整性**（卡 `content` 均为章节原文逐字片段）。
 *
 * 说明：**L2 语义口径**需真实模型调用，属人工协验/真机范畴（见 `report.md` 数据状态）。
 */

import { describe, expect, it } from "vitest";
import { MISREPORT_THRESHOLD } from "@/orchestration/consistency/report";
import { runL1Rules, type L1Card } from "@/orchestration/consistency/rules";
import type { ConflictType } from "@/orchestration/consistency/types";
import conflict01 from "./samples/conflict-01.txt?raw";
import conflict02 from "./samples/conflict-02.txt?raw";
import conflict03 from "./samples/conflict-03.txt?raw";
import rawGroundTruth from "./samples/ground-truth.json";

interface GroundTruth {
  threshold: number;
  chapters: {
    file: string;
    title: string;
    cards: L1Card[];
    expectedConflicts: { aId: number; bId: number; type: ConflictType }[];
  }[];
}

// JSON 导入被推断为宽化字面量（`type` 为 string），此处收窄为领域类型
const groundTruth = rawGroundTruth as unknown as GroundTruth;

const texts: Record<string, string> = {
  "conflict-01.txt": conflict01,
  "conflict-02.txt": conflict02,
  "conflict-03.txt": conflict03,
};

const keyOf = (report: { aId: number; bId: number; type: string }) =>
  `${report.aId}|${report.bId}|${report.type}`;

describe("误报率标注样本集（≥3 章预埋冲突；L1 自动口径）", () => {
  it("样本集规模 ≥3 章且含预埋冲突真值", () => {
    expect(groundTruth.chapters.length).toBeGreaterThanOrEqual(3);
    for (const chapter of groundTruth.chapters) {
      expect(chapter.expectedConflicts.length).toBeGreaterThan(0);
    }
    expect(groundTruth.threshold).toBe(MISREPORT_THRESHOLD);
  });

  it("证据完整性：每张卡的 `content` 均为章节原文**逐字片段**（零幻觉前置）", () => {
    for (const chapter of groundTruth.chapters) {
      const text = texts[chapter.file];
      expect(text, `缺样本文件 ${chapter.file}`).toBeTruthy();
      for (const card of chapter.cards) {
        expect(text).toContain(card.content);
      }
    }
  });

  it("L1 检出全部预埋冲突（召回）且误报率 ≤ MISREPORT_THRESHOLD", () => {
    let reported = 0;
    let falsePositives = 0;
    let missed = 0;

    for (const chapter of groundTruth.chapters) {
      const reports = runL1Rules(chapter.cards);
      const truth = new Set(chapter.expectedConflicts.map(keyOf));
      const reportedKeys = new Set(reports.map(keyOf));

      reported += reports.length;
      falsePositives += reports.filter((report) => !truth.has(keyOf(report))).length;
      missed += [...truth].filter((key) => !reportedKeys.has(key)).length;
    }

    expect(reported).toBeGreaterThan(0); // 有报出才有分母（避免"零报出"伪通过）
    expect(missed).toBe(0); // 召回：预埋冲突全部检出
    // 样本集实测锚点（3 章各 1 条预埋冲突；L1 无误报）——变更样本/规则时须同步核对
    expect(reported).toBe(3);
    expect(falsePositives).toBe(0);
    const misreportRate = falsePositives / reported;
    expect(misreportRate).toBeLessThanOrEqual(MISREPORT_THRESHOLD);
  });
});
