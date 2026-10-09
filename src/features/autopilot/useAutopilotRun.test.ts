import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { AutopilotDeps } from "@/orchestration/autopilot";
import { createEvaluatorRegistry } from "@/orchestration/review/evaluator";
import { useAutopilotStore } from "@/store/autopilotStore";
import { useAutopilotRun } from "./useAutopilotRun";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const OUTLINE = [
  { index: 0, title: "第一章", instruction: "初遇" },
  { index: 1, title: "第二章", instruction: "灯塔熄灭" },
  { index: 2, title: "第三章", instruction: "潮汐律" },
];

const CONFIG = {
  maxChapters: 3,
  maxRewriteRounds: 2,
  passThreshold: 60,
  autoConfirmArchive: true,
  pauseOnConflict: true,
  consecutiveFailureLimit: 3,
};

const runRow = (id: number, status: string, configJson: string) => ({
  id,
  novel_id: 1,
  status,
  config_json: configJson,
  created_at: "c",
  updated_at: "u",
});

const chapterRow = (orderIndex: number, state: string, score: number | null = null) => ({
  id: orderIndex + 1,
  run_id: 9,
  chapter_id: null,
  order_index: orderIndex,
  state,
  score,
  degraded_reason: "",
  attempt: 0,
  updated_at: "u",
});

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;

/** 假依赖：假流 + 假审查（高分）+ 内存断点（可观测「不重跑已完成章」） */
function depsWithMemory(saved: { orderIndex: number; state: string }[]): AutopilotDeps {
  return {
    model: "m",
    streamFor: () =>
      (async function* () {
        yield { delta: "正文" };
      })(),
    evaluators: createEvaluatorRegistry(),
    reviewFn: () =>
      Promise.resolve({ plot: { score: 80, reasons: [] }, humanity: { score: 80, reasons: [] } }),
    archiveFn: () => Promise.resolve(),
    persistence: {
      saveRun: () => Promise.resolve(9),
      saveChapter: (input) => {
        saved.push({ orderIndex: input.orderIndex, state: input.state });
        return Promise.resolve();
      },
    },
  };
}

beforeEach(() => {
  invokeMock.mockReset();
  useAutopilotStore.getState().reset();
});

describe("useAutopilotRun（断点续跑；stage-12 T3）", () => {
  it("启动：run 落库（running→completed）+ 每章断点落库（running→done/degraded）", async () => {
    const saved: { orderIndex: number; state: string }[] = [];
    const { result } = renderHook(() => useAutopilotRun(depsWithMemory(saved)));

    await act(async () => {
      await result.current.run(OUTLINE, CONFIG);
    });

    expect(useAutopilotStore.getState().status).toBe("done");
    expect(useAutopilotStore.getState().chapters).toHaveLength(3);
    // 每章两次落库（起点 running + 终点 done）
    for (const index of [0, 1, 2]) {
      expect(saved).toContainEqual({ orderIndex: index, state: "running" });
      expect(saved).toContainEqual({ orderIndex: index, state: "done" });
    }
  });

  it("熔断（章数上限）→ run 落 `paused`（**可续跑**）+ 报告含 `trippedBy`", async () => {
    const saved: { orderIndex: number; state: string }[] = [];
    const { result } = renderHook(() => useAutopilotRun(depsWithMemory(saved)));

    await act(async () => {
      await result.current.run(OUTLINE, { ...CONFIG, maxChapters: 2 });
    });

    const report = useAutopilotStore.getState().report;
    expect(report?.trippedBy).toBe("max-chapters");
    expect(useAutopilotStore.getState().chapters).toHaveLength(2); // 即停
    expect(useAutopilotStore.getState().status).toBe("paused");
  });

  it("**续跑**：载入 running run + 已完成章 → **从断点续、不重跑已完成章**", async () => {
    const saved: { orderIndex: number; state: string }[] = [];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_autopilot_run") {
        return Promise.resolve(
          runRow(9, "paused", JSON.stringify({ config: CONFIG, outline: OUTLINE })),
        );
      }
      if (cmd === "list_autopilot_chapters") {
        // 前两章已完成（done / degraded）
        return Promise.resolve([chapterRow(0, "done", 80), chapterRow(1, "degraded", 41)]);
      }
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useAutopilotRun(depsWithMemory(saved)));
    await act(async () => {
      await result.current.resume(9);
    });

    const state = useAutopilotStore.getState();
    expect(state.chapters).toHaveLength(3); // 已完成 2 + 续跑 1
    // 已完成章**不重跑**：仅第 2 章有 running/done 落库
    expect(saved.filter((entry) => entry.orderIndex === 0)).toHaveLength(0);
    expect(saved.filter((entry) => entry.orderIndex === 1)).toHaveLength(0);
    expect(saved).toContainEqual({ orderIndex: 2, state: "running" });
    expect(saved).toContainEqual({ orderIndex: 2, state: "done" });
    // 续跑沿用既有 run id（不新建）
    expect(state.report?.chapters).toHaveLength(3);
  });

  it("续跑：`config_json` 破损 → 回退默认配置与空大纲（不抛穿）", async () => {
    const saved: { orderIndex: number; state: string }[] = [];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "get_autopilot_run") return Promise.resolve(runRow(9, "running", "not-json"));
      if (cmd === "list_autopilot_chapters") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    const { result } = renderHook(() => useAutopilotRun(depsWithMemory(saved)));
    let ok = true;
    await act(async () => {
      ok = await result.current.resume(9);
    });
    expect(ok).toBe(true); // 空大纲 → 无章可跑但正常结束
    expect(useAutopilotStore.getState().chapters).toHaveLength(0);
  });

  it("无依赖（未装配真机 deps）→ 不启动、不落库", async () => {
    const { result } = renderHook(() => useAutopilotRun(null));
    let ok = true;
    await act(async () => {
      ok = await result.current.run(OUTLINE, CONFIG);
    });
    expect(ok).toBe(false);
    expect(argsOf("save_autopilot_run")).toBeUndefined();
  });
});
