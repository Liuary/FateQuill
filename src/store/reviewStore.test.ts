import { beforeEach, describe, expect, it } from "vitest";
import { useReviewStore } from "./reviewStore";
import { useEditorStore } from "./editorStore";
import { useGenerationStore } from "./generationStore";
import { DEFAULT_WEIGHTS } from "@/orchestration/review/aggregate";

let seq = 0;

/** 构造版本池条目（仅含剧情 / 真人感两维结果） */
function version(id: string, plot: number, humanity: number, round = 1) {
  seq += 1;
  return {
    id: `${id}-${seq}`,
    label: id,
    content: `<p>${id}</p>`,
    round,
    results: {
      plot: { score: plot, reasons: [] },
      humanity: { score: humanity, reasons: [] },
    },
  };
}

beforeEach(() => {
  useReviewStore.setState({
    versions: [],
    weights: { ...DEFAULT_WEIGHTS },
    activeVersionId: null,
    autoRewrite: true,
    maxRounds: 2,
  });
});

describe("reviewStore（会话级版本池）", () => {
  it("默认：autoRewrite 开、maxRounds=2、权重平衡", () => {
    const state = useReviewStore.getState();
    expect(state.autoRewrite).toBe(true);
    expect(state.maxRounds).toBe(2);
    expect(state.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("addVersion 计算加权总分，且全部版本保留（含非最优）", () => {
    useReviewStore.getState().addVersion(version("初版", 80, 60));
    useReviewStore.getState().addVersion(version("重写1", 60, 90, 2));
    const versions = useReviewStore.getState().versions;
    expect(versions).toHaveLength(2);
    expect(versions[0].totalScore).toBeCloseTo(70);
    expect(versions[1].totalScore).toBeCloseTo(75);
  });

  it("setWeights 重算全部总分（排序翻转）", () => {
    useReviewStore.getState().addVersion(version("v1", 90, 50));
    useReviewStore.getState().addVersion(version("v2", 60, 90));
    expect(useReviewStore.getState().versions[0].totalScore).toBeCloseTo(70);

    useReviewStore.getState().setWeights({ plot: 3, worldview: 1, compliance: 1, humanity: 1 });
    const [v1, v2] = useReviewStore.getState().versions;
    expect(v1.totalScore).toBeCloseTo(80);
    expect(v2.totalScore).toBeCloseTo(67.5);
    expect(v1.totalScore).toBeGreaterThan(v2.totalScore);
  });

  it("setActive / setAutoRewrite", () => {
    useReviewStore.getState().addVersion(version("v1", 80, 80));
    const id = useReviewStore.getState().versions[0].id;
    useReviewStore.getState().setActive(id);
    expect(useReviewStore.getState().activeVersionId).toBe(id);

    useReviewStore.getState().setAutoRewrite(false);
    expect(useReviewStore.getState().autoRewrite).toBe(false);
  });

  it("clear 清空版本池与选中态（保留权重）", () => {
    useReviewStore.getState().addVersion(version("v1", 80, 80));
    useReviewStore.getState().setActive(useReviewStore.getState().versions[0].id);
    useReviewStore.getState().setWeights({ plot: 2, worldview: 1, compliance: 1, humanity: 1 });

    useReviewStore.getState().clear();
    const after = useReviewStore.getState();
    expect(after.versions).toHaveLength(0);
    expect(after.activeVersionId).toBeNull();
    expect(after.weights.plot).toBe(2);
  });

  it("独立 create：与 editorStore / generationStore 互不影响", () => {
    expect(useReviewStore).not.toBe(useEditorStore);
    expect(useReviewStore).not.toBe(useGenerationStore);

    const editorBefore = useEditorStore.getState();
    const generationBefore = useGenerationStore.getState();
    useReviewStore.getState().addVersion(version("v1", 80, 80));
    // 未触发其它 store 的 setState（状态对象同一性不变）
    expect(useEditorStore.getState()).toBe(editorBefore);
    expect(useGenerationStore.getState()).toBe(generationBefore);
  });
});
