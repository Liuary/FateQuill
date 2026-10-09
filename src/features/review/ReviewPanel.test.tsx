import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import i18n from "@/app/i18n";
import {
  DEFAULT_WEIGHTS,
  weightedTotal,
  type EvaluationBundle,
} from "@/orchestration/review/aggregate";
import { createEvaluatorRegistry } from "@/orchestration/review/evaluator";
import type { Evaluator, ReviewDimension } from "@/orchestration/review/types";
import { useReviewStore } from "@/store/reviewStore";
import { ReviewPanel } from "./ReviewPanel";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  replaceSpy: vi.fn(),
  disposeSpy: vi.fn(),
  rewriteSpy: vi.fn(),
  registryHolder: { current: null as unknown },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/review/register", () => ({
  registerBuiltinEvaluators: () => hoisted.registryHolder.current,
}));
vi.mock("@/orchestration/review/rewrite", () => ({ rewriteChapter: hoisted.rewriteSpy }));
vi.mock("@/features/editor/EditorController", () => ({
  createEditorController: () => ({
    appendChunk: vi.fn(),
    flushPending: vi.fn(),
    replaceContent: hoisted.replaceSpy,
    dispose: hoisted.disposeSpy,
  }),
}));

const cfgRow = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  base_url: "https://api.example.com",
  model_name: "m",
  temperature: 0,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};

const fakeEditor = { getHTML: () => "<p>正文</p>" } as unknown as Editor;

/** 构造脚本化评估器 */
const fixedEvaluator = (
  dimension: ReviewDimension,
  score: number,
  reasons: string[] = [],
): Evaluator => ({
  id: dimension,
  evaluate: async () => ({ score, reasons }),
});

function registryWith(...evaluators: Evaluator[]) {
  const registry = createEvaluatorRegistry();
  for (const evaluator of evaluators) {
    registry.register(evaluator);
  }
  return registry;
}

/** 构造版本池条目（totalScore 按默认权重计算） */
function version(
  id: string,
  label: string,
  round: number,
  scores: Partial<Record<ReviewDimension, number>>,
  reasons: Partial<Record<ReviewDimension, string[]>> = {},
) {
  const results: EvaluationBundle = {};
  for (const [dimension, score] of Object.entries(scores) as [ReviewDimension, number][]) {
    results[dimension] = { score, reasons: reasons[dimension] ?? [] };
  }
  return {
    id,
    label,
    content: `<p>${label}</p>`,
    round,
    results,
    totalScore: weightedTotal(results, DEFAULT_WEIGHTS),
  };
}

function seed(versions: ReturnType<typeof version>[]) {
  useReviewStore.setState({
    versions,
    weights: { ...DEFAULT_WEIGHTS },
    activeVersionId: null,
    autoRewrite: true,
    maxRounds: 2,
    needsHumanReview: false,
  });
}

const items = () => screen.getAllByTestId("version-item");
const labels = () => items().map((el) => el.textContent ?? "");

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    return Promise.resolve(undefined);
  });
  hoisted.replaceSpy.mockReset();
  hoisted.disposeSpy.mockReset();
  hoisted.rewriteSpy.mockReset();
  hoisted.registryHolder.current = registryWith(fixedEvaluator("plot", 80));
  seed([]);
});

describe("ReviewPanel", () => {
  it("渲染四维分数与理由", async () => {
    seed([
      version(
        "v1",
        "初版",
        0,
        { plot: 50, worldview: 80, compliance: 90, humanity: 70 },
        { plot: ["冲突推进乏力", "伏笔未呼应"] },
      ),
    ]);
    const { container } = render(<ReviewPanel novelId={1} chapterId={1} editor={fakeEditor} />);

    await waitFor(() => expect(items()).toHaveLength(1));
    const text = container.textContent ?? "";
    expect(text).toContain("剧情");
    expect(text).toContain("世界观");
    expect(text).toContain("合规");
    expect(text).toContain("真人感");
    expect(text).toContain("冲突推进乏力");
    expect(text).toContain("伏笔未呼应");
    // 四维分数可见
    for (const score of ["50", "80", "90", "70"]) {
      expect(text).toContain(score);
    }
  });

  it("版本按加权总分排序；采纳 → replaceContent 且 dispose（REV-008）", async () => {
    seed([
      version("v1", "初版", 0, { plot: 50, humanity: 50 }),
      version("v2", "重写1", 1, { plot: 90, humanity: 90 }),
    ]);
    render(<ReviewPanel novelId={1} chapterId={1} editor={fakeEditor} />);

    await waitFor(() => expect(items()).toHaveLength(2));
    expect(labels()[0]).toContain("重写1"); // 总分高者在前
    expect(labels()[1]).toContain("初版");

    fireEvent.click(within(items()[0]).getByRole("button", { name: "采纳" }));
    await waitFor(() => expect(hoisted.replaceSpy).toHaveBeenCalledWith("<p>重写1</p>"));
    expect(hoisted.disposeSpy).toHaveBeenCalled(); // REV-008：用后 dispose
    expect(useReviewStore.getState().activeVersionId).toBe("v2");
  });

  it("合规低分：显示人工裁决提示，且触发重写不调用重写（仅人工裁决）", async () => {
    hoisted.registryHolder.current = registryWith(fixedEvaluator("compliance", 40, ["含广告导流"]));
    seed([version("v1", "初版", 0, { compliance: 40, plot: 90 })]);

    const { container } = render(<ReviewPanel novelId={1} chapterId={1} editor={fakeEditor} />);
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(container.textContent).toContain("人工裁决"); // complianceManual 提示

    fireEvent.click(screen.getByRole("button", { name: "触发重写" }));
    await waitFor(() => expect(container.textContent).toContain("请人工处理")); // needsHuman 提示
    expect(hoisted.rewriteSpy).not.toHaveBeenCalled(); // 合规不触发自动重写
  });

  it("改判 → 总分与排序更新", async () => {
    seed([
      version("v1", "初版", 0, { plot: 50, humanity: 50 }),
      version("v2", "重写1", 1, { plot: 60, humanity: 60 }),
    ]);
    render(<ReviewPanel novelId={1} chapterId={1} editor={fakeEditor} />);

    await waitFor(() => expect(items()).toHaveLength(2));
    expect(labels()[0]).toContain("重写1"); // 60 在 50 之前

    // 选中初版 → 面板展示其四维；改判剧情 50 → 100
    fireEvent.click(within(items()[1]).getAllByRole("button")[0]);
    await waitFor(() => expect(useReviewStore.getState().activeVersionId).toBe("v1"));

    const plotInput = screen.getAllByRole("spinbutton")[0]; // 维度顺序：剧情/世界观/合规/真人感
    fireEvent.change(plotInput, { target: { value: "100" } });

    await waitFor(() => expect(labels()[0]).toContain("初版")); // 75 反超 60
    expect(labels()[1]).toContain("重写1");
  });
});
