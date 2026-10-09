import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { ExplorationBranch } from "@/orchestration/exploration/types";
import { useExplorationStore } from "@/store/explorationStore";
import { BranchCompare } from "./BranchCompare";

const branch = (
  id: string,
  temperature: number,
  keyTurns: string[],
  over: Partial<ExplorationBranch> = {},
): ExplorationBranch => ({
  id,
  temperature,
  effectiveTemperature: over.clamped ? 1 : temperature,
  clamped: false,
  status: "done",
  card: { summary: `${id} 走向`, keyTurns, settingCardIds: [3] },
  ...over,
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  useExplorationStore.setState({
    intent: "",
    temperatures: [0.3, 0.7, 1.1],
    branches: [],
    running: false,
    selectedBranchId: null,
    collapsedIds: [],
  });
});

describe("BranchCompare（分支对比视图）", () => {
  it("并排渲染 N 卡（按温度排序）并标注独有关键转折", async () => {
    useExplorationStore.setState({
      branches: [
        branch("t2", 1.1, ["结盟", "叛变"], { clamped: true }),
        branch("t0", 0.3, ["遇袭", "结盟"]),
        branch("t1", 0.7, ["结盟"]),
      ],
    });
    render(<BranchCompare />);

    await waitFor(() => expect(screen.getAllByTestId("branch-card")).toHaveLength(3));
    // 按温度升序并排
    const cards = screen.getAllByTestId("branch-card");
    expect(cards[0].textContent).toContain("0.3");
    expect(cards[1].textContent).toContain("0.7");
    expect(cards[2].textContent).toContain("1.1");
    // clamp 标注
    expect(cards[2].textContent).toContain("已按 provider 区间 clamp");
    // 差异标注：独有关键转折（0.3→遇袭、1.1→叛变）；共现（结盟）不标注
    expect(within(cards[0]).getByTestId("unique-turn")).toHaveTextContent("遇袭");
    expect(within(cards[1]).queryByTestId("unique-turn")).toBeNull();
    expect(within(cards[2]).getByTestId("unique-turn")).toHaveTextContent("叛变");
    expect(within(cards[0]).getByTestId("shared-turn")).toHaveTextContent("结盟");
    // 设定卡引用
    expect(cards[0].textContent).toContain("引用设定卡: 3");
  });

  it("折叠 → 内容收起；再展开恢复", async () => {
    useExplorationStore.setState({ branches: [branch("t0", 0.3, ["遇袭"])] });
    render(<BranchCompare />);
    await waitFor(() => expect(screen.getAllByTestId("branch-card")).toHaveLength(1));

    expect(screen.getByText("t0 走向")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "折叠" }));
    expect(screen.queryByText("t0 走向")).toBeNull(); // 内容收起

    fireEvent.click(screen.getByRole("button", { name: "展开" }));
    expect(screen.getByText("t0 走向")).toBeInTheDocument();
  });

  it("选中分支 → store 记录 selectedBranchId（再次点击取消）", async () => {
    useExplorationStore.setState({ branches: [branch("t0", 0.3, ["甲"])] });
    render(<BranchCompare />);
    await waitFor(() => expect(screen.getAllByTestId("branch-card")).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "选中" }));
    expect(useExplorationStore.getState().selectedBranchId).toBe("t0");

    fireEvent.click(screen.getByRole("button", { name: "选中" }));
    expect(useExplorationStore.getState().selectedBranchId).toBeNull();
  });

  it("无分支 → 空态", () => {
    render(<BranchCompare />);
    expect(screen.getByText("暂无分支")).toBeInTheDocument();
  });
});
