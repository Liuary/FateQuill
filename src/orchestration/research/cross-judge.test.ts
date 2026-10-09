import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chunk, ModelProvider } from "@/orchestration/types";
import { useResearchStore } from "@/store/researchStore";
import { extractFlavorExcerpts, mergeByExcerpt } from "./cross-judge";
import type { ModelExcerpts } from "./types";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

/** 假 provider：回放给定文本（分块 yield 以验证聚合） */
function fakeProvider(text: string, chunks = 3): ModelProvider {
  return {
    id: "fake",
    async *stream(): AsyncIterable<Chunk> {
      const size = Math.max(1, Math.ceil(text.length / chunks));
      for (let i = 0; i < text.length; i += size) {
        yield { delta: text.slice(i, i + size) };
      }
    },
  };
}

const excerpts = (model: string, items: [string, string][]): ModelExcerpts => ({
  model,
  excerpts: items.map(([excerpt, reason]) => ({ excerpt, reason })),
});

describe("mergeByExcerpt（verbatim 精确交集 + 命中分级）", () => {
  it("A=[x,y] / B=[y,z] → y 高置信，x/z 待确认", () => {
    const merged = mergeByExcerpt([
      excerpts("A", [
        ["x 句", "套话"],
        ["y 句", "排比"],
      ]),
      excerpts("B", [
        ["y 句", "句式单调"],
        ["z 句", "情感空洞"],
      ]),
    ]);

    const byExcerpt = new Map(merged.map((result) => [result.excerpt, result]));
    expect(merged).toHaveLength(3);
    expect(byExcerpt.get("y 句")?.confidence).toBe("high"); // 命中 ≥2
    expect([...(byExcerpt.get("y 句")?.models ?? [])].sort()).toEqual(["A", "B"]);
    expect(byExcerpt.get("x 句")?.confidence).toBe("pending"); // 命中 =1
    expect(byExcerpt.get("z 句")?.confidence).toBe("pending");
    // 通道标记（REV-011）与定位输出
    expect(merged.every((result) => result.sourceType === "multi_model_cross")).toBe(true);
    expect(byExcerpt.get("y 句")?.positionHint).toBe("y 句");
  });

  it("精确匹配：不做模糊对齐（空白差异视为不同引文）", () => {
    const merged = mergeByExcerpt([
      excerpts("A", [["原句", "套话"]]),
      excerpts("B", [["原句 ", "套话"]]), // 末尾空白不同 → 不同键
    ]);
    expect(merged).toHaveLength(2);
    expect(merged.every((result) => result.confidence === "pending")).toBe(true);
    expect(merged.every((result) => result.models.length === 1)).toBe(true);
  });

  it("同一模型重复命中同一引文只记一次", () => {
    const merged = mergeByExcerpt([
      excerpts("A", [
        ["原句", "r1"],
        ["原句", "r2"],
      ]),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].models).toEqual(["A"]);
    expect(merged[0].confidence).toBe("pending");
  });
});

describe("extractFlavorExcerpts（非流式收口）", () => {
  it("聚合 provider 全文后解析摘取片段", async () => {
    const json = '{"excerpts":[{"excerpt":"她不禁皱眉","reason":"套话"}]}';
    const result = await extractFlavorExcerpts({
      provider: fakeProvider(json),
      model: "A",
      content: "正文",
    });
    expect(result.model).toBe("A");
    expect(result.excerpts).toEqual([{ excerpt: "她不禁皱眉", reason: "套话" }]);
  });

  it("围栏 JSON 亦可解析（容错复用 review/json）", async () => {
    const fenced = '```json\n{"excerpts":[{"excerpt":"仿佛静止","reason":"句式单调"}]}\n```';
    const result = await extractFlavorExcerpts({
      provider: fakeProvider(fenced),
      model: "B",
      content: "正文",
    });
    expect(result.excerpts.map((item) => item.excerpt)).toEqual(["仿佛静止"]);
  });
});

describe("不入库（待确认队列 = 会话内存）", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useResearchStore.setState({ selectedConfigIds: [], candidates: [], pendingResults: [] });
  });

  it("交叉结果仅入 pendingResults（内存），不发生任何 IPC 写", () => {
    const merged = mergeByExcerpt([excerpts("A", [["x 句", "r"]]), excerpts("B", [["x 句", "r"]])]);
    useResearchStore.getState().setPendingResults(merged);

    const pending = useResearchStore.getState().pendingResults;
    expect(pending).toHaveLength(1);
    expect(pending[0].confidence).toBe("high");
    expect(pending[0].sourceType).toBe("multi_model_cross");
    expect(invokeMock).not.toHaveBeenCalled(); // 未落库（无 IPC 写）
  });
});
