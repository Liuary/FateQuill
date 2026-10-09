import { describe, expect, it } from "vitest";
import {
  CATEGORY_WEIGHT,
  COMPLIANCE_RULES,
  COMPLIANCE_RULES_VERSION,
  scanCompliance,
} from "./compliance-rules";

describe("COMPLIANCE_RULES 词表", () => {
  it("版本常量存在（语义化）", () => {
    expect(COMPLIANCE_RULES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("id 唯一", () => {
    const ids = COMPLIANCE_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("五类目齐备且均有扣分权重", () => {
    const categories = COMPLIANCE_RULES.map((r) => r.category);
    for (const category of categories) {
      expect(CATEGORY_WEIGHT[category]).toBeGreaterThan(0);
    }
    expect([...new Set(categories)].sort()).toEqual([
      "ad",
      "politics",
      "porn",
      "values",
      "violence",
    ]);
  });

  it("正则均可编译", () => {
    for (const rule of COMPLIANCE_RULES) {
      expect(() => new RegExp(rule.pattern, "gi")).not.toThrow();
    }
  });
});

describe("scanCompliance", () => {
  it("命中返回 ruleId / 类目 / match", () => {
    const hits = scanCompliance("请点击下方的二维码关注");
    const hit = hits.find((h) => h.ruleId === "ad-001");
    expect(hit).toBeTruthy();
    expect(hit?.category).toBe("ad");
    expect(hit?.match).toContain("二维码");
  });

  it("无命中返回空数组", () => {
    expect(scanCompliance("清晨的光落在窗台上，阿禾把粥盛好")).toEqual([]);
  });

  it("非法正则跳过、不阻断整体扫描", () => {
    const hits = scanCompliance("加微信", [
      { id: "bad", category: "ad", pattern: "([", note: "坏正则" },
      { id: "good", category: "ad", pattern: "加微信", note: "好正则" },
    ]);
    expect(hits.map((h) => h.ruleId)).toEqual(["good"]);
  });
});
