import { describe, expect, it } from "vitest";
import type { ChatOptions, Chunk } from "@/orchestration/types";
import sample from "@/features/consistency/experiments/samples/sample-01.txt?raw";
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractOptions,
  parseExtraction,
  toPlainText,
  verifyEvidence,
} from "./extract";
import { runExtraction } from "./run";
import type { ExtractedSetting } from "./types";

const modelRef = { providerId: "openai-compatible", model: "m" };
const chapterText = sample;

/** 假取流（返回固定文本 / 抛错） */
const streamOf = (text: string) => (): AsyncIterable<Chunk> =>
  (async function* () {
    yield { delta: text };
  })();
const failingStream = () => (): AsyncIterable<Chunk> => {
  throw new Error("stream down");
};

const setting = (over: Partial<ExtractedSetting> = {}): ExtractedSetting => ({
  name: "潮汐律",
  kind: "世界观",
  suggestedTier: "main",
  content: "月相更替时海面涨落",
  evidence: "月相更替之时，海面会随之涨落三丈",
  ...over,
});

const jsonOf = (settings: unknown[]) => JSON.stringify({ settings });

describe("extract（抽取：输出契约 + evidence 原文回查）", () => {
  it("buildExtractOptions：system = 输出契约；user 含章节正文", () => {
    const options: ChatOptions = buildExtractOptions({ chapterText, modelRef });
    expect(options.model).toBe("m");
    expect(options.messages[0].content).toBe(EXTRACTION_SYSTEM_PROMPT);
    expect(options.messages[0].content).toContain("suggestedTier");
    expect(options.messages[1].content).toContain("潮汐律规定");
  });

  it("toPlainText：去 HTML 标签并折叠空白（与抽取/回查同源）", () => {
    expect(toPlainText("<p>月相  更替</p>\n<p>海面涨落</p>")).toBe("月相 更替 海面涨落");
  });

  it("parseExtraction：JSON 容错（```json 围栏）+ 缺字段候选丢弃", () => {
    const raw = [
      "```json",
      jsonOf([
        setting(),
        setting({ name: "", evidence: "x" }), // 缺名称 → 丢弃
        setting({ name: "无依据", evidence: "" }), // 缺 evidence → 丢弃
        "not-an-object", // 非对象 → 丢弃
      ]),
      "```",
    ].join("\n");
    const parsed = parseExtraction(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("潮汐律");
    expect(parsed[0].suggestedTier).toBe("main");
  });

  it("parseExtraction：未知 suggestedTier → 回退 short；顶层非法 → 抛错", () => {
    expect(
      parseExtraction(jsonOf([setting({ suggestedTier: "bogus" as never })]))[0].suggestedTier,
    ).toBe("short");
    expect(() => parseExtraction("not json at all")).toThrow();
    expect(() => parseExtraction(JSON.stringify({ settings: "nope" }))).toThrow();
  });

  it("verifyEvidence：规范化空白后按**子串**断言（跨空白差异仍通过）", () => {
    expect(verifyEvidence(setting(), chapterText)).toBe(true);
    expect(verifyEvidence(setting({ evidence: "雾隐峡两侧的灯塔" }), chapterText)).toBe(true);
    // 跨行片段（原文换行处）：规范化空白后仍为子串
    expect(verifyEvidence(setting({ evidence: "光源。 执灯人自两百年前" }), chapterText)).toBe(
      true,
    );
    // 幻觉（正文不存在）→ false
    expect(verifyEvidence(setting({ evidence: "潮汐律由海神亲授" }), chapterText)).toBe(false);
    expect(verifyEvidence(setting({ evidence: "" }), chapterText)).toBe(false);
  });
});

describe("runExtraction（编排：已知实体抽出 / 不匹配剔除 / 失败不抛穿）", () => {
  it("已知实体被抽出，且 evidence 均为原文子串", async () => {
    const raw = jsonOf([
      setting(),
      setting({
        name: "雾隐峡",
        kind: "地理",
        suggestedTier: "short",
        evidence: "雾隐峡两侧的灯塔",
      }),
      setting({
        name: "执灯人",
        kind: "身份",
        suggestedTier: "dark",
        evidence: "执灯人自两百年前起便守在峡口",
      }),
    ]);
    const result = await runExtraction({
      chapterText,
      existingNames: [],
      modelRef,
      streamFor: streamOf(raw),
    });

    expect(result.ok).toBe(true);
    expect(result.candidates.map((c) => c.name)).toEqual(["潮汐律", "雾隐峡", "执灯人"]);
    expect(result.candidates.map((c) => c.suggestedTier)).toEqual(["main", "short", "dark"]);
    for (const candidate of result.candidates) {
      expect(chapterText).toContain(candidate.evidence); // **原文回查**
      expect(candidate.evidenceVerified).toBe(true);
    }
  });

  it("evidence 不匹配者被**剔除**（防幻觉硬闸）", async () => {
    const raw = jsonOf([
      setting(),
      setting({ name: "海神契约", evidence: "海神以潮汐为誓" }), // 正文不存在 → 剔除
    ]);
    const result = await runExtraction({
      chapterText,
      existingNames: [],
      modelRef,
      streamFor: streamOf(raw),
    });
    expect(result.ok).toBe(true);
    expect(result.candidates.map((c) => c.name)).toEqual(["潮汐律"]);
  });

  it("零命中为**合法空态**（ok:true, candidates:[]）", async () => {
    const result = await runExtraction({
      chapterText,
      existingNames: [],
      modelRef,
      streamFor: streamOf(jsonOf([])),
    });
    expect(result).toEqual({ ok: true, candidates: [] });
  });

  it("收口 / 解析异常 → `ok:false`（失败不抛穿）", async () => {
    const broken = await runExtraction({
      chapterText,
      existingNames: [],
      modelRef,
      streamFor: failingStream(),
    });
    expect(broken.ok).toBe(false);
    expect(broken.candidates).toEqual([]);
    expect(broken.error).toContain("stream down");

    const badJson = await runExtraction({
      chapterText,
      existingNames: [],
      modelRef,
      streamFor: streamOf("抱歉，我无法完成。"),
    });
    expect(badJson.ok).toBe(false);
    expect(badJson.error).toBeTruthy();
  });
});
