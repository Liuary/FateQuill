import { describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import type { ChatOptions, ModelProvider } from "@/orchestration/types";
import { createEditorController } from "@/features/editor/EditorController";
import { editorExtensions } from "@/features/editor/editor-extensions";
import { DEFAULT_WEIGHTS } from "./aggregate";
import { createEvaluatorRegistry, type EvaluatorRegistry } from "./evaluator";
import type { Evaluator, ReviewDimension } from "./types";
import { runReviewLoop, type ReviewArtifact } from "./loop";

/** 假重写 provider：按序回放重写产物（逐字符 yield） */
function rewriteProvider(outputs: string[]) {
  const calls: ChatOptions[] = [];
  let index = 0;
  const provider: ModelProvider & { calls: ChatOptions[] } = {
    id: "fake-rewrite",
    calls,
    async *stream(options: ChatOptions) {
      calls.push(options);
      const text = outputs[Math.min(index, outputs.length - 1)] ?? "";
      index += 1;
      for (const ch of text) {
        yield { delta: ch };
      }
    },
  };
  return provider;
}

/** 假评估器：按调用序返回脚本化分数（超出后取最后一个） */
function scriptedEvaluator(dimension: ReviewDimension, scores: number[]): Evaluator {
  let index = 0;
  return {
    id: dimension,
    async evaluate() {
      const score = scores[Math.min(index, scores.length - 1)] ?? 0;
      index += 1;
      return { score, reasons: score >= 60 ? ["达标"] : [`${dimension} 存在问题`] };
    },
  };
}

function registryWith(...evaluators: Evaluator[]): EvaluatorRegistry {
  const registry = createEvaluatorRegistry();
  for (const evaluator of evaluators) {
    registry.register(evaluator);
  }
  return registry;
}

const collect = () => {
  const artifacts: ReviewArtifact[] = [];
  return { artifacts, onVersion: (v: ReviewArtifact) => artifacts.push(v) };
};

describe("runReviewLoop", () => {
  it("上限 2：持续未通过 → 重写 2 次后转人工", async () => {
    const provider = rewriteProvider(["<p>重写1</p>", "<p>重写2</p>", "<p>重写3</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(scriptedEvaluator("plot", [50, 55, 58, 61])),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(provider.calls).toHaveLength(2); // 上限 2
    expect(result.rounds).toBe(2);
    expect(result.needsHuman).toBe(true);
    // 入池：初版 + 2 次重写
    expect(artifacts.map((v) => v.round)).toEqual([0, 1, 2]);
    expect(artifacts[2].content).toBe("<p>重写2</p>");
  });

  it("重写后通过 → 1 次重写且不转人工", async () => {
    const provider = rewriteProvider(["<p>重写1</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(scriptedEvaluator("plot", [50, 75])),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(provider.calls).toHaveLength(1);
    expect(result).toEqual({ needsHuman: false, rounds: 1 });
    expect(artifacts).toHaveLength(2);
    expect(artifacts[1].results.plot?.score).toBe(75);
  });

  it("初版通过 → 不重写、不转人工", async () => {
    const provider = rewriteProvider(["<p>不应被调用</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(scriptedEvaluator("plot", [80])),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ needsHuman: false, rounds: 0 });
    expect(artifacts).toHaveLength(1);
  });

  it("开关：autoRewrite=false → 不调用重写且转人工", async () => {
    const provider = rewriteProvider(["<p>重写</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(scriptedEvaluator("plot", [30])),
      weights: DEFAULT_WEIGHTS,
      autoRewrite: false,
      onVersion,
    });

    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ needsHuman: true, rounds: 0 });
    expect(artifacts).toHaveLength(1);
  });

  it("合规单维失败 → 不自动重写、转人工（仅人工裁决）", async () => {
    const provider = rewriteProvider(["<p>重写</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(scriptedEvaluator("compliance", [40])),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(provider.calls).toHaveLength(0);
    expect(result).toEqual({ needsHuman: true, rounds: 0 });
    expect(artifacts).toHaveLength(1);
  });

  it("合规 + 其它维度失败 → 仅对非合规维度重写", async () => {
    const provider = rewriteProvider(["<p>重写1</p>"]);
    const { onVersion } = collect();

    await runReviewLoop({
      provider,
      model: "m",
      content: "<p>初版</p>",
      evaluators: registryWith(
        scriptedEvaluator("compliance", [40]),
        scriptedEvaluator("plot", [50, 80]),
      ),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(provider.calls).toHaveLength(1);
    const userMessage = provider.calls[0].messages[1].content;
    expect(userMessage).toContain("[plot]"); // 非合规维度被注入反馈
    expect(userMessage).not.toContain("[compliance]"); // 合规不参与自动重写
  });

  it("入池不自动替换正文：onVersion 收到重写产物，编辑器正文不变且零替换调用", async () => {
    const editor = new Editor({ extensions: editorExtensions, content: "<p>初版正文</p>" });
    const controller = createEditorController(editor);
    const replaceSpy = vi.spyOn(controller, "replaceContent");
    const setContentSpy = vi.spyOn(editor.commands, "setContent");
    const provider = rewriteProvider(["<p>重写正文</p>"]);
    const { artifacts, onVersion } = collect();

    const result = await runReviewLoop({
      provider,
      model: "m",
      content: editor.getHTML(),
      evaluators: registryWith(scriptedEvaluator("plot", [50, 75])),
      weights: DEFAULT_WEIGHTS,
      onVersion,
    });

    expect(artifacts.map((v) => v.content)).toContain("<p>重写正文</p>"); // 产物入池
    expect(replaceSpy).not.toHaveBeenCalled();
    expect(setContentSpy).not.toHaveBeenCalled();
    expect(editor.getHTML()).toBe("<p>初版正文</p>"); // 正文未被自动替换
    expect(result.needsHuman).toBe(false);

    controller.dispose();
    editor.destroy();
  });
});
