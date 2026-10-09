import { describe, expect, it } from "vitest";
import { MISREPORT_THRESHOLD, dedupeReports, severityOf, toConflictReport } from "./report";
import type { ConflictReport } from "./types";

const l1: ConflictReport[] = [
  { aId: 1, bId: 2, type: "life-status", evidence: "原文A", severity: "high" },
];

describe("report（报告结构 / 定级 / 合并去重）", () => {
  it("severityOf：生死 high / 时间线 medium / 语义按结论 / 数值 low", () => {
    expect(severityOf("life-status")).toBe("high");
    expect(severityOf("timeline")).toBe("medium");
    expect(severityOf("numeric")).toBe("low");
    expect(severityOf("semantic", "contradiction")).toBe("medium");
    expect(severityOf("semantic", "uncertain")).toBe("low");
  });

  it("dedupeReports：同 `(aId,bId,type)` 去重（保留首次）", () => {
    const dup: ConflictReport[] = [
      ...l1,
      { ...l1[0], evidence: "原文A'" },
      { aId: 1, bId: 2, type: "numeric", evidence: "原文B", severity: "low" },
    ];
    const out = dedupeReports(dup);
    expect(out).toHaveLength(2);
    expect(out[0].evidence).toBe("原文A");
  });

  it('toConflictReport：**仅** L2 `contradiction` 转 `type:"semantic"`（consistent/uncertain 不产出）', () => {
    const reports = toConflictReport(l1, [
      {
        candidateId: 9,
        constraintId: 3,
        verdict: { verdict: "contradiction", reason: "生死互斥", evidence: "渡鸦已死" },
      },
      { candidateId: 9, constraintId: 4, verdict: { verdict: "consistent", reason: "可并存" } },
      { candidateId: 9, constraintId: 5, verdict: { verdict: "uncertain", reason: "无法判断" } },
    ]);

    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({ aId: 1, bId: 2, type: "life-status" });
    expect(reports[1]).toEqual({
      aId: 3,
      bId: 9,
      type: "semantic",
      evidence: "渡鸦已死",
      severity: "medium",
    });
  });

  it("toConflictReport：语义 reports 与 L1 同键时去重；无 evidence 时退回 reason", () => {
    const reports = toConflictReport(
      [{ aId: 3, bId: 9, type: "semantic", evidence: "L1 已有", severity: "low" }],
      [{ candidateId: 9, constraintId: 3, verdict: { verdict: "contradiction", reason: "理由" } }],
    );
    expect(reports).toHaveLength(1);
    expect(reports[0].evidence).toBe("L1 已有");

    const onlyReason = toConflictReport(
      [],
      [
        {
          candidateId: 9,
          constraintId: 3,
          verdict: { verdict: "contradiction", reason: "仅理由" },
        },
      ],
    );
    expect(onlyReason[0].evidence).toBe("仅理由");
  });

  it("误报率阈值常量：占位默认 0.2（**待用户拍板**）", () => {
    expect(MISREPORT_THRESHOLD).toBe(0.2);
  });
});
