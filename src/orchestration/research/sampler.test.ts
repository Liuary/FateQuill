import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chunk, ModelProvider } from "@/orchestration/types";
import { repositories } from "@/ipc/repositories";
import { useEditorStore } from "@/store/editorStore";
import { useGenerationStore } from "@/store/generationStore";
import { buildSamplingMessages, runSampling } from "./sampler";
import type { MaterialCandidate, SamplingModel } from "./types";

/**
 * 假模型：把生命周期写入 `events`（用于判定**串行**——前一模型结束才启动后一模型），
 * 并按字符 yield 文本。
 */
function fakeModel(
  label: string,
  text: string,
  events: string[],
  configId = label === "A" ? 1 : 2,
): SamplingModel {
  const provider: ModelProvider = {
    id: `provider-${label}`,
    async *stream(): AsyncIterable<Chunk> {
      events.push(`${label}:start`);
      for (const char of text) {
        yield { delta: char };
      }
      events.push(`${label}:end`);
    },
  };
  return { configId, providerId: "openai-compatible", label, model: `model-${label}`, provider };
}

beforeEach(() => {
  useEditorStore.setState({
    currentNovelId: null,
    currentChapterId: null,
    saveStatus: "saved",
    lastSavedAt: null,
  });
  useGenerationStore.getState().reset();
});

describe("runSampling（串行逐模型）", () => {
  it("逐模型串行调用（A 结束才启动 B）并各产出一条候选", async () => {
    const events: string[] = [];
    const candidates: MaterialCandidate[] = [];

    await runSampling(
      [fakeModel("A", "甲文本", events), fakeModel("B", "乙文本", events)],
      "自由发挥写一段",
      (candidate) => candidates.push(candidate),
    );

    expect(events).toEqual(["A:start", "A:end", "B:start", "B:end"]); // 串行（非并发）
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.sourceModel)).toEqual(["A", "B"]);
    expect(candidates.every((c) => c.sourceType === "multi_model_creation")).toBe(true);
    expect(candidates.map((c) => c.content)).toEqual(["甲文本", "乙文本"]);
  });

  it("停止采样：已采集候选保留，未开始的模型不再调用", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const candidates: MaterialCandidate[] = [];

    await runSampling(
      [fakeModel("A", "甲文本", events), fakeModel("B", "乙文本", events)],
      "指令",
      (candidate) => {
        candidates.push(candidate);
        controller.abort(); // 采集到 A 后立即停止
      },
      controller.signal,
    );

    expect(events).toEqual(["A:start", "A:end"]); // B 未启动
    expect(candidates).toHaveLength(1); // 已采集候选保留
    expect(candidates[0].sourceModel).toBe("A");
  });

  it("流循环内中止：当前模型已收文本保留为候选，后续模型不再启动", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    const candidates: MaterialCandidate[] = [];
    const partial: SamplingModel = {
      configId: 1,
      providerId: "x",
      label: "A",
      model: "m",
      provider: {
        id: "p",
        async *stream(): AsyncIterable<Chunk> {
          events.push("A:start");
          yield { delta: "前半" };
          controller.abort(); // 流中途中止
          yield { delta: "后半" };
        },
      },
    };

    await runSampling(
      [partial, fakeModel("B", "乙", events)],
      "指令",
      (c) => candidates.push(c),
      controller.signal,
    );

    expect(events).not.toContain("B:start"); // 后续模型未启动
    expect(candidates).toHaveLength(1);
    expect(candidates[0].content).toBe("前半"); // 已收文本保留
  });

  it("采样 prompt 无预算裁剪（自由创作 system + 原始指令）", () => {
    const messages = buildSamplingMessages("写一段雨夜追逐");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("自由创作采样");
    expect(messages[1].content).toBe("写一段雨夜追逐");
  });

  it("无副作用：chapter.update 零调用、editor/generation 快照不变", async () => {
    const updateSpy = vi.spyOn(repositories.chapter, "update");
    useEditorStore.setState({
      currentNovelId: 1,
      currentChapterId: 2,
      saveStatus: "saved",
      lastSavedAt: null,
    });
    const editorBefore = useEditorStore.getState();
    const generationBefore = useGenerationStore.getState();
    const events: string[] = [];

    await runSampling([fakeModel("A", "甲文本", events)], "指令", () => {});

    expect(updateSpy).not.toHaveBeenCalled(); // 不落 chapter
    expect(useEditorStore.getState()).toBe(editorBefore); // 不进正文/不自动保存（无 setState）
    expect(useGenerationStore.getState()).toBe(generationBefore); // 不触发生成/审查链路
  });
});
