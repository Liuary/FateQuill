import { describe, expect, it } from "vitest";
import { diffBranches } from "./diff";
import type { ExplorationBranch } from "./types";

const branch = (id: string, temperature: number, keyTurns: string[]): ExplorationBranch => ({
  id,
  temperature,
  effectiveTemperature: temperature,
  clamped: false,
  status: "done",
  card: { summary: `${id} 摘要`, keyTurns, settingCardIds: [1] },
});

describe("diffBranches（跨分支差异：keyTurns 精确集合差）", () => {
  it("3 分支：部分独有 / 部分共现", () => {
    const diffs = diffBranches([
      branch("b0", 0.3, ["遇袭", "结盟"]),
      branch("b1", 0.7, ["结盟"]),
      branch("b2", 1.1, ["结盟", "叛变"]),
    ]);

    expect(diffs.map((diff) => diff.branchId)).toEqual(["b0", "b1", "b2"]);
    expect(diffs[0].sharedKeyTurns).toEqual(["结盟"]);
    expect(diffs[0].uniqueKeyTurns).toEqual(["遇袭"]);
    expect(diffs[1].uniqueKeyTurns).toEqual([]); // 仅共现
    expect(diffs[1].sharedKeyTurns).toEqual(["结盟"]);
    expect(diffs[2].uniqueKeyTurns).toEqual(["叛变"]);
    expect(diffs[2].sharedKeyTurns).toEqual(["结盟"]);
  });

  it("精确匹配：不做模糊对齐（空白/大小写差异视为不同转折）", () => {
    const diffs = diffBranches([branch("b0", 0.3, ["结盟"]), branch("b1", 0.7, ["结盟 "])]);
    expect(diffs[0].uniqueKeyTurns).toEqual(["结盟"]);
    expect(diffs[1].uniqueKeyTurns).toEqual(["结盟 "]);
    expect(diffs[0].sharedKeyTurns).toEqual([]);
  });

  it("单分支：全部为独有", () => {
    const diffs = diffBranches([branch("b0", 0.3, ["甲", "乙"])]);
    expect(diffs[0].uniqueKeyTurns).toEqual(["甲", "乙"]);
    expect(diffs[0].sharedKeyTurns).toEqual([]);
  });

  it("同分支内重复 keyTurn 去重", () => {
    const diffs = diffBranches([branch("b0", 0.3, ["甲", "甲"]), branch("b1", 0.7, ["甲"])]);
    expect(diffs[0].uniqueKeyTurns).toEqual([]);
    expect(diffs[0].sharedKeyTurns).toEqual(["甲"]);
  });

  it("无 card / 空 keyTurns → 均为空", () => {
    const empty: ExplorationBranch = {
      id: "b0",
      temperature: 0.3,
      effectiveTemperature: 0.3,
      clamped: false,
      status: "error",
      error: "boom",
    };
    const diffs = diffBranches([empty]);
    expect(diffs[0]).toEqual({ branchId: "b0", uniqueKeyTurns: [], sharedKeyTurns: [] });
  });
});
