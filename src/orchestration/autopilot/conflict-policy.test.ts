import { describe, expect, it } from "vitest";
import type { ConflictReport } from "@/orchestration/consistency/types";
import { conflictKey, decideConflictPolicy } from "./conflict-policy";

const conflict: ConflictReport = {
  aId: 1,
  bId: 2,
  type: "life-status",
  evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
  severity: "high",
};

describe("decideConflictPolicy（无人值守冲突策略；两路径均留痕）", () => {
  it('默认（`pauseOnConflict: true`）→ `pause` + 留痕 `status:"open"`（保留用户终裁决）', () => {
    const decision = decideConflictPolicy({ conflict, pauseOnConflict: true });
    expect(decision.action).toBe("pause");
    expect(decision.record).toEqual({
      aId: 1,
      bId: 2,
      type: "life-status",
      evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
      severity: "high",
      status: "open",
      action: "",
    });
  });

  it('**用户显式授权**（`pauseOnConflict: false`）→ `ignore-continue` + 留痕 `status:"ignored"`/`action:"ignore"`', () => {
    const decision = decideConflictPolicy({ conflict, pauseOnConflict: false });
    expect(decision.action).toBe("ignore-continue");
    expect(decision.record).toEqual({
      aId: 1,
      bId: 2,
      type: "life-status",
      evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
      severity: "high",
      status: "ignored",
      action: "ignore",
    });
  });

  it("纯函数：不改入参（深拷贝语义）", () => {
    const input = { conflict: { ...conflict }, pauseOnConflict: false };
    const before = JSON.stringify(input);
    decideConflictPolicy(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("冲突去重键 = `(aId,bId,type)`（同一冲突不重复落库）", () => {
    expect(conflictKey(conflict)).toBe("1|2|life-status");
    expect(conflictKey({ ...conflict })).toBe(conflictKey(conflict));
    expect(conflictKey({ ...conflict, type: "numeric" })).not.toBe(conflictKey(conflict));
  });
});
