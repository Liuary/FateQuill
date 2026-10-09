import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { ModelConfig } from "@/domain/models/model-config";
import { estimateCost } from "@/orchestration/exploration/cost";
import { useExplorationStore } from "@/store/explorationStore";
import { useExploration } from "./useExploration";

const hoisted = vi.hoisted(() => ({ invokeMock: vi.fn(), providerStream: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (...args: unknown[]) => hoisted.providerStream(...args),
  }),
}));

const config: ModelConfig = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  baseUrl: "https://api.example.com",
  modelName: "m",
  temperature: 0.7,
  isDefault: true,
  createdAt: "c",
  updatedAt: "u",
};

const card = JSON.stringify({ summary: "走向", keyTurns: [], settingCardIds: [] });

/** 正常回放：等待（可被 signal 中止）后回一块走向卡 */
function normalStream() {
  return (async function* () {
    yield { delta: card };
  })();
}

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) =>
    cmd === "list_setting_cards" ? Promise.resolve([]) : Promise.resolve(undefined),
  );
  hoisted.providerStream.mockReset();
  hoisted.providerStream.mockImplementation(() => normalStream());
  useExplorationStore.setState({
    intent: "北上",
    temperatures: [0.3, 0.7, 1.1],
    branches: [],
    running: false,
    selectedBranchId: null,
    collapsedIds: [],
  });
});

describe("useExploration（并发 / 成本 / 失败处理，T5）", () => {
  it("成本预估随温度数变化（分支数 ×（输出上限 + 输入估算））", () => {
    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));
    expect(result.current.cost.tokens).toBe(estimateCost(3).tokens);
    expect(result.current.cost.note).toContain("分支数");

    act(() => {
      useExplorationStore.setState({ temperatures: [0.3, 0.7] });
    });
    expect(result.current.cost.tokens).toBe(estimateCost(2).tokens);
  });

  it("并发上限可调（默认 3）", () => {
    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));
    expect(result.current.concurrency).toBe(3);
    act(() => {
      result.current.setConcurrency(5);
    });
    expect(result.current.concurrency).toBe(5);
  });

  it("retryBranch 仅重跑该分支（不影响其余分支）", async () => {
    useExplorationStore.setState({
      branches: [
        { id: "b0", temperature: 0.3, effectiveTemperature: 0.3, clamped: false, status: "done" },
        {
          id: "b1",
          temperature: 0.7,
          effectiveTemperature: 0.7,
          clamped: false,
          status: "error",
          error: "boom",
        },
      ],
    });
    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));

    const callsBefore = hoisted.providerStream.mock.calls.length;
    await act(async () => {
      await result.current.retryBranch("b1");
    });

    expect(hoisted.providerStream.mock.calls.length).toBe(callsBefore + 1); // 仅重跑一次
    const branches = useExplorationStore.getState().branches;
    expect(branches).toHaveLength(2); // 未影响其它分支
    expect(branches.find((item) => item.id === "b0")?.status).toBe("done");
    expect(branches.find((item) => item.id === "b1")?.status).toBe("done"); // 重试成功
    expect(branches.find((item) => item.id === "b1")?.card?.summary).toBe("走向");
  });

  it("abort 全部停止：在跑分支中止、排队分支不启动（无完成结果）", async () => {
    // 挂起流：仅响应 signal 中止
    hoisted.providerStream.mockImplementation((...args: unknown[]) =>
      (async function* () {
        const options = args[0] as { signal?: AbortSignal } | undefined;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 50);
          options?.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            resolve();
          });
        });
        yield { delta: card };
      })(),
    );

    const { result } = renderHook(() => useExploration({ novelId: 1, chapterId: null, config }));

    let running: Promise<void> | undefined;
    act(() => {
      running = result.current.run();
    });
    await waitFor(() => expect(useExplorationStore.getState().branches).toHaveLength(3));

    await act(async () => {
      result.current.abort();
      await running;
    });

    const branches = useExplorationStore.getState().branches;
    expect(branches.every((branch) => branch.status !== "done")).toBe(true); // 无完成结果
    expect(useExplorationStore.getState().running).toBe(false); // 无悬挂
  });
});
