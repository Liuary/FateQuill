import { describe, expect, it } from "vitest";
import { dedupeByName } from "./dedupe";
import type { ExtractedSetting } from "./types";

const candidate = (name: string): ExtractedSetting => ({
  name,
  kind: "世界观",
  suggestedTier: "short",
  content: "内容",
  evidence: "原文片段",
});

describe("dedupeByName（名称精确去重）", () => {
  it("同名（既有卡）→ duplicate；否则 new", () => {
    const out = dedupeByName([candidate("潮汐律"), candidate("雾隐峡")], ["潮汐律", "执灯人"]);
    expect(out.map((c) => [c.name, c.status])).toEqual([
      ["潮汐律", "duplicate"],
      ["雾隐峡", "new"],
    ]);
    expect(out.every((c) => c.evidenceVerified)).toBe(true);
  });

  it("trim 后比较（首尾空白不产生重复卡）", () => {
    const out = dedupeByName([candidate("  潮汐律 ")], ["潮汐律"]);
    expect(out[0].status).toBe("duplicate");
  });

  it("名称大小写 / 别名 / 语义相似**不**视为重复（v0.5 局限声明）", () => {
    const out = dedupeByName(
      [candidate("Tide Law"), candidate("潮汐法则")],
      ["tide law", "潮汐律"],
    );
    expect(out.map((c) => c.status)).toEqual(["new", "new"]);
  });

  it("无既有卡 / 空名单 → 全部 new", () => {
    expect(dedupeByName([candidate("甲")], []).map((c) => c.status)).toEqual(["new"]);
    expect(dedupeByName([candidate("甲")], ["  "]).map((c) => c.status)).toEqual(["new"]);
  });
});
