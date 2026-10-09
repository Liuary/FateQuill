import { describe, expect, it } from "vitest";
import type { ChatOptions, Chunk } from "@/orchestration/types";
import {
  JUDGE_SYSTEM_PROMPT,
  buildJudgeOptions,
  parseJudge,
  runL2,
  type JudgeInput,
} from "./judge";

const modelRef = { providerId: "openai-compatible", model: "m" };

const input: JudgeInput = {
  candidate: { id: 9, name: "渡鸦", content: "渡鸦尚在人间，仍在峡口贩盐。" },
  constraints: [{ id: 3, title: "生死志", content: "渡鸦已死于第七次潮灾。" }],
};

const streamOf = (text: string) => (): AsyncIterable<Chunk> =>
  (async function* () {
    yield { delta: text };
  })();
const failingStream = () => (): AsyncIterable<Chunk> => {
  throw new Error("judge down");
};

describe("judge（L2 语义：建议非结论 + 容错降级）", () => {
  it("buildJudgeOptions：system = 判定契约；user 含候选与约束卡（含 id）", () => {
    const options: ChatOptions = buildJudgeOptions({ ...input, modelRef });
    expect(options.temperature).toBe(0);
    expect(options.messages[0].content).toBe(JUDGE_SYSTEM_PROMPT);
    expect(options.messages[1].content).toContain("渡鸦尚在人间");
    expect(options.messages[1].content).toContain("[3] 生死志");
  });

  it("parseJudge：容错围栏 JSON；verdict 合法值；evidence 可选", () => {
    const parsed = parseJudge(
      '```json\n{"verdict":"contradiction","reason":"生死互斥","evidence":"渡鸦已死"}\n```',
    );
    expect(parsed).toEqual({ verdict: "contradiction", reason: "生死互斥", evidence: "渡鸦已死" });
    expect(parseJudge('{"verdict":"consistent","reason":"可并存"}')).toEqual({
      verdict: "consistent",
      reason: "可并存",
    });
  });

  it("parseJudge：verdict 非法 / JSON 非法 → 抛错（交 runL2 降级）", () => {
    expect(() => parseJudge('{"verdict":"maybe","reason":"x"}')).toThrow();
    expect(() => parseJudge("抱歉，我无法判断。")).toThrow();
  });

  it("runL2：产出结论 + **`advisory: true`（建议非结论）** + 约束卡 id", async () => {
    const result = await runL2({
      ...input,
      modelRef,
      streamFor: streamOf('{"verdict":"contradiction","reason":"生死互斥","evidence":"渡鸦已死"}'),
    });
    expect(result.verdict).toBe("contradiction");
    expect(result.advisory).toBe(true);
    expect(result.constraintIds).toEqual([3]);
  });

  it("runL2：JSON 非法 / 收口异常 → 降级 `uncertain`（不抛穿、不误报）", async () => {
    const badJson = await runL2({ ...input, modelRef, streamFor: streamOf("我无法判断") });
    expect(badJson).toMatchObject({ verdict: "uncertain", advisory: true, constraintIds: [3] });

    const broken = await runL2({ ...input, modelRef, streamFor: failingStream() });
    expect(broken.verdict).toBe("uncertain");
    expect(broken.reason).toContain("judge down");
  });
});
