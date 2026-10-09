import { describe, expect, it } from "vitest";
import { p95 } from "./editor-bench";

describe("p95", () => {
  it("空数组 → 0", () => {
    expect(p95([])).toBe(0);
  });

  it("单样本 → 自身", () => {
    expect(p95([7])).toBe(7);
  });

  it("单调序列 → 第 95 百分位", () => {
    const s = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(p95(s)).toBe(95);
  });

  it("不修改入参", () => {
    const s = [3, 1, 2];
    p95(s);
    expect(s).toEqual([3, 1, 2]);
  });
});
