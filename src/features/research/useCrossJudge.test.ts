import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Chunk, ModelProvider } from "@/orchestration/types";
import type { SamplingModel } from "@/orchestration/research/types";
import { useResearchStore } from "@/store/researchStore";
import { useCrossJudge } from "./useCrossJudge";

/** 假模型：回放给定 JSON 文本（逐字符 yield） */
function fakeModel(label: string, respond: () => string, calls: string[] = []): SamplingModel {
  const provider: ModelProvider = {
    id: `provider-${label}`,
    async *stream(): AsyncIterable<Chunk> {
      calls.push(label);
      for (const char of respond()) {
        yield { delta: char };
      }
    },
  };
  return {
    configId: label === "A" ? 1 : 2,
    providerId: "openai-compatible",
    label,
    model: `m-${label}`,
    provider,
  };
}

const json = (items: [string, string][]) =>
  JSON.stringify({ excerpts: items.map(([excerpt, reason]) => ({ excerpt, reason })) });

const candidate = (id: string, content: string, sourceModel = "modelA") => ({
  id,
  sourceType: "multi_model_creation" as const,
  sourceModel,
  content,
  createdAt: 1,
});

beforeEach(() => {
  useResearchStore.setState({ selectedConfigIds: [], candidates: [], pendingResults: [] });
});

describe("useCrossJudge（交叉判断生产接线，REV-018）", () => {
  it("逐模型摘取 → 精确交集合并 → 入待确认队列（sourceType=multi_model_cross）", async () => {
    useResearchStore.setState({ candidates: [candidate("c1", "正文一")] });
    const calls: string[] = [];
    const models = [
      fakeModel(
        "A",
        () =>
          json([
            ["x 句", "套话"],
            ["y 句", "排比"],
          ]),
        calls,
      ),
      fakeModel(
        "B",
        () =>
          json([
            ["y 句", "句式单调"],
            ["z 句", "空洞"],
          ]),
        calls,
      ),
    ];

    const { result } = renderHook(() => useCrossJudge(models));
    await act(async () => {
      await result.current.runCrossJudge();
    });

    expect(calls).toEqual(["A", "B"]); // 逐模型摘取
    const pending = useResearchStore.getState().pendingResults;
    expect(pending).toHaveLength(3);
    expect(pending.every((item) => item.sourceType === "multi_model_cross")).toBe(true);
    const byExcerpt = new Map(pending.map((item) => [item.excerpt, item]));
    expect(byExcerpt.get("y 句")?.confidence).toBe("high");
    expect([...(byExcerpt.get("y 句")?.models ?? [])].sort()).toEqual(["m-A", "m-B"]);
    expect(byExcerpt.get("x 句")?.confidence).toBe("pending");
    expect(result.current.crossing).toBe(false);
  });

  it("单模型摘取失败 → 容错跳过（其余模型结果仍入列）", async () => {
    useResearchStore.setState({ candidates: [candidate("c1", "正文一")] });
    const ok = fakeModel("A", () => json([["x 句", "套话"]]));
    const broken: SamplingModel = {
      configId: 2,
      providerId: "openai-compatible",
      label: "B",
      model: "m-B",
      provider: {
        id: "provider-B",
        // 摘取失败：provider 直接抛错（无迭代器）
        stream(): AsyncIterable<Chunk> {
          throw new Error("provider failed");
        },
      },
    };

    const { result } = renderHook(() => useCrossJudge([ok, broken]));
    await act(async () => {
      await result.current.runCrossJudge();
    });

    const pending = useResearchStore.getState().pendingResults;
    expect(pending).toHaveLength(1);
    expect(pending[0].excerpt).toBe("x 句");
    expect(pending[0].models).toEqual(["m-A"]);
  });

  it("无候选 / 无模型：不启动（不入列、不调用 provider）", async () => {
    const calls: string[] = [];
    const models = [fakeModel("A", () => json([["x 句", "r"]]), calls)];

    // 无候选
    const { result } = renderHook(() => useCrossJudge(models));
    await act(async () => {
      await result.current.runCrossJudge();
    });
    expect(useResearchStore.getState().pendingResults).toEqual([]);
    expect(calls).toEqual([]);

    // 无模型
    useResearchStore.setState({ candidates: [candidate("c1", "正文")], pendingResults: [] });
    const { result: noModel } = renderHook(() => useCrossJudge([]));
    await act(async () => {
      await noModel.current.runCrossJudge();
    });
    expect(useResearchStore.getState().pendingResults).toEqual([]);
  });

  it("停止：候选中止后不再处理后续候选（已合并结果保留）", async () => {
    useResearchStore.setState({
      candidates: [candidate("c1", "正文一"), candidate("c2", "正文二")],
    });
    const hookRef: { current: ReturnType<typeof useCrossJudge> | null } = { current: null };
    const model: SamplingModel = {
      configId: 1,
      providerId: "openai-compatible",
      label: "A",
      model: "m-A",
      provider: {
        id: "provider-A",
        async *stream(): AsyncIterable<Chunk> {
          yield { delta: json([["x 句", "r"]]) };
          hookRef.current?.stopCrossJudge(); // 处理完本候选后停止
        },
      },
    };

    const { result } = renderHook(() => useCrossJudge([model]));
    hookRef.current = result.current;
    await act(async () => {
      await result.current.runCrossJudge();
    });

    // 未处理第二个候选 → 仅一份结果（否则 "x 句" 会出现两次）
    expect(useResearchStore.getState().pendingResults.map((item) => item.excerpt)).toEqual([
      "x 句",
    ]);
  });
});
