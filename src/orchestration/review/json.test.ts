import { describe, expect, it } from "vitest";
import { extractJson, parseEvaluationJson } from "./json";

describe("extractJson", () => {
  it("去 ```json 围栏", () => {
    expect(extractJson('```json\n{"score":80}\n```')).toBe('{"score":80}');
  });

  it("去无语言标记围栏", () => {
    expect(extractJson('```\n{"score":80}\n```')).toBe('{"score":80}');
  });

  it("夹取首个 { 至末个 }", () => {
    expect(extractJson('这是评分：{"score":80} 谢谢')).toBe('{"score":80}');
  });

  it("无 JSON 时原样返回（交解析抛错）", () => {
    expect(extractJson("no json here")).toBe("no json here");
  });
});

describe("parseEvaluationJson", () => {
  it("合法 JSON", () => {
    expect(parseEvaluationJson('{"score":88,"reasons":["好"]}')).toEqual({
      score: 88,
      reasons: ["好"],
    });
  });

  it("```json 围栏", () => {
    expect(parseEvaluationJson('```json\n{"score":75,"reasons":["a","b"]}\n```')).toEqual({
      score: 75,
      reasons: ["a", "b"],
    });
  });

  it("前后附解释文字", () => {
    const parsed = parseEvaluationJson('评审如下\n{"score":90,"reasons":"情节紧凑"}\n以上');
    expect(parsed.score).toBe(90);
    expect(parsed.reasons).toEqual(["情节紧凑"]);
  });

  it("score 越界夹取", () => {
    expect(parseEvaluationJson('{"score":150,"reasons":[]}').score).toBe(100);
    expect(parseEvaluationJson('{"score":-5,"reasons":[]}').score).toBe(0);
  });

  it("findings 原样保留", () => {
    expect(
      parseEvaluationJson('{"score":70,"reasons":[],"findings":{"issues":1}}').findings,
    ).toEqual({
      issues: 1,
    });
  });

  it("reasons 缺失归一为空数组", () => {
    expect(parseEvaluationJson('{"score":70}').reasons).toEqual([]);
  });

  it("非法 → 抛错", () => {
    expect(() => parseEvaluationJson("not json")).toThrow();
    expect(() => parseEvaluationJson('{"reasons":[]}')).toThrow(/score/);
    expect(() => parseEvaluationJson("[1,2,3]")).toThrow();
    expect(() => parseEvaluationJson('{"score":"高","reasons":[]}')).toThrow(/score/);
  });
});
