import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_THRESHOLD, converge } from "./converge";
import type { ExplorationBranch } from "./types";

const branch = (id: string, temperature: number, settingCardIds: number[]): ExplorationBranch => ({
  id,
  temperature,
  effectiveTemperature: temperature,
  clamped: false,
  status: "done",
  card: { summary: `${id} 摘要`, keyTurns: [], settingCardIds },
});

/** 作品设定卡集（存在性校验基准） */
const existing = new Set([1, 2, 3]);

describe("converge（产出期偏离标注收敛）", () => {
  it("覆盖检查：injected=[1,2]；引用 [1] → coverage 0.5，引用 [1,2] → 1.0", () => {
    const [partial, full] = converge([branch("b0", 0.3, [1]), branch("b1", 0.7, [1, 2])], {
      injectedSettingCardIds: [1, 2],
      existingSettingCardIds: existing,
    });

    expect(partial.deviation?.coverage).toBe(0.5);
    expect(partial.deviation?.flagged).toBe(false); // 等于阈值不判偏离（严格小于）
    expect(partial.weight).toBe(0.5);
    expect(full.deviation?.coverage).toBe(1);
    expect(full.deviation?.flagged).toBe(false);
    expect(full.weight).toBe(1);
  });

  it("存在性校验：引用 [1,99] → 99 被过滤 + 记入 invalidSettingCardIds + flagged", () => {
    const [result] = converge([branch("b0", 0.3, [1, 99])], {
      injectedSettingCardIds: [1],
      existingSettingCardIds: existing,
    });

    expect(result.card?.settingCardIds).toEqual([1]); // 幻觉 id 已过滤
    expect(result.deviation?.invalidSettingCardIds).toEqual([99]);
    expect(result.deviation?.flagged).toBe(true);
    expect(result.deviation?.coverage).toBe(1); // 过滤后覆盖满
    expect(result.weight).toBe(0.5); // 降权（coverage * 0.5）
  });

  it("降权/排序：偏离样本 weight 低于贴合分支；**分支数不变**（不过滤不删）", () => {
    const input = [branch("bad", 0.3, [1, 99]), branch("good", 0.7, [1, 2])];
    const out = converge(input, {
      injectedSettingCardIds: [1, 2],
      existingSettingCardIds: existing,
    });

    expect(out).toHaveLength(input.length); // 不过滤
    const bad = out.find((item) => item.id === "bad")!;
    const good = out.find((item) => item.id === "good")!;
    expect(bad.deviation?.flagged).toBe(true);
    expect(bad.weight!).toBeLessThan(good.weight!);

    // 调用方按 weight 降序排序 → 贴合分支在前
    const ranked = [...out].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    expect(ranked.map((item) => item.id)).toEqual(["good", "bad"]);
  });

  it("可选贴合度：fitScores 低于阈值 → flagged（软依赖，缺省不启用）", () => {
    const [result] = converge([branch("b0", 0.3, [1, 2])], {
      injectedSettingCardIds: [1, 2],
      existingSettingCardIds: existing,
      fitScores: { b0: 0.2 },
    });

    expect(result.deviation?.fitScore).toBe(0.2);
    expect(result.deviation?.flagged).toBe(true);
    expect(result.weight).toBe(0.5); // coverage 1 × 0.5
  });

  it("无注入集：coverage 视为 1（无约束可偏离）", () => {
    const [result] = converge([branch("b0", 0.3, [1])], {
      injectedSettingCardIds: [],
      existingSettingCardIds: existing,
    });
    expect(result.deviation?.coverage).toBe(1);
    expect(result.deviation?.flagged).toBe(false);
  });

  it("缺失引用（存在但未注入）记录，且不单独判偏离", () => {
    const [result] = converge([branch("b0", 0.3, [1, 3])], {
      injectedSettingCardIds: [1],
      existingSettingCardIds: existing,
    });
    expect(result.deviation?.missingSettingCardIds).toEqual([3]);
    expect(result.deviation?.coverage).toBe(1);
    expect(result.deviation?.flagged).toBe(false);
  });

  it("无走向卡（pending/error）的分支不参与收敛", () => {
    const pending: ExplorationBranch = {
      id: "p",
      temperature: 0.3,
      effectiveTemperature: 0.3,
      clamped: false,
      status: "pending",
    };
    const [result] = converge([pending], {
      injectedSettingCardIds: [1],
      existingSettingCardIds: existing,
    });
    expect(result.deviation).toBeUndefined();
    expect(result.weight).toBeUndefined();
  });

  it("覆盖率阈值可配置（默认 0.5）", () => {
    expect(DEFAULT_COVERAGE_THRESHOLD).toBe(0.5);
    const [result] = converge([branch("b0", 0.3, [1])], {
      injectedSettingCardIds: [1, 2],
      existingSettingCardIds: existing,
      coverageThreshold: 0.6,
    });
    expect(result.deviation?.flagged).toBe(true); // 0.5 < 0.6
  });
});
