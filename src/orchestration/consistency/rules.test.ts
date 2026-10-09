import { describe, expect, it } from "vitest";
import { extractAssertions, runL1Rules } from "./rules";

describe("runL1Rules（L1 结构化冲突：零幻觉 / 零成本）", () => {
  it("生死状态冲突：同实体两卡「已死 / 尚在人间」→ 报 life-status（high）", () => {
    const reports = runL1Rules([
      { id: 1, title: "渡鸦", content: "旧志记载：渡鸦已死于第七次潮灾。" },
      { id: 2, title: "渡鸦", content: "商队名册：渡鸦尚在人间，仍在峡口贩盐。" },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ aId: 1, bId: 2, type: "life-status", severity: "high" });
    // evidence 为原文逐字句子（零幻觉）
    expect(reports[0].evidence).toContain("渡鸦已死于第七次潮灾");
    expect(reports[0].evidence).toContain("渡鸦尚在人间");
  });

  it("时间线冲突：同实体两卡年份不同 → 报 timeline（medium）", () => {
    const reports = runL1Rules([
      { id: 1, title: "雾隐峡", content: "峡口石碑刻字：雾隐峡建峡于729年。" },
      { id: 2, title: "雾隐峡", content: "口述录：雾隐峡建峡于803年，晚得多。" },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ aId: 1, bId: 2, type: "timeline", severity: "medium" });
  });

  it("数值冲突：同实体数量不同 → 报 numeric（low）", () => {
    const reports = runL1Rules([
      { id: 1, title: "执灯人", content: "名册记：现役执灯人共36人。" },
      { id: 2, title: "执灯人", content: "税簿却写：现役执灯人共12人。" },
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ aId: 1, bId: 2, type: "numeric", severity: "low" });
  });

  it("一致卡（值相同 / 无结构化断言 / 未提及实体）→ **不报**（宁缺毋滥）", () => {
    expect(
      runL1Rules([
        { id: 1, title: "执灯人", content: "名册记：现役执灯人共36人。" },
        { id: 2, title: "执灯人", content: "税簿也记：现役执灯人共36人。" },
      ]),
    ).toEqual([]);

    // 无结构化断言（纯叙述）
    expect(
      runL1Rules([
        { id: 1, title: "潮汐律", content: "潮汐律规定：月相更替之时，海面随之涨落。" },
        { id: 2, title: "潮汐律", content: "潮汐律补注：涨落与雾隐峡水位无关。" },
      ]),
    ).toEqual([]);

    // 未提及实体（标题不在句中出现）→ 不产出断言
    expect(
      runL1Rules([
        { id: 1, title: "执灯人", content: "名册记：现役灯夫共36人。" },
        { id: 2, title: "执灯人", content: "税簿却写：现役灯夫共12人。" },
      ]),
    ).toEqual([]);
  });

  it("同卡自比不报；中文数字不做解析（避免误判）", () => {
    expect(
      runL1Rules([{ id: 1, title: "执灯人", content: "执灯人共36人。执灯人另有12人。" }]),
    ).toEqual([]);
    // 中文数字（「第七次」「两百年前」）不参与 L1（保守）
    expect(
      runL1Rules([
        { id: 1, title: "执灯人", content: "执灯人已死。" },
        { id: 2, title: "执灯人", content: "执灯人尚在人间。" },
      ]),
    ).toHaveLength(1); // 生死仍可判定（非数字）
  });

  it("extractAssertions：实体须在句中出现；生死互斥句不产出断言", () => {
    const assertions = extractAssertions([
      { id: 1, title: "渡鸦", content: "渡鸦已死。渡鸦尚在人间。无关句子。" },
    ]);
    // 两句互斥句**各自**成立（同卡 → 不构成跨卡冲突）
    expect(assertions.map((a) => a.attribute)).toEqual(["life-status", "life-status"]);
    expect(assertions.map((a) => a.value)).toEqual(["dead", "alive"]);
    // 同句同时含生死两词 → 跳过（不确定）
    expect(
      extractAssertions([{ id: 1, title: "渡鸦", content: "渡鸦已死，但传言它尚在人间。" }]),
    ).toEqual([]);
  });
});
