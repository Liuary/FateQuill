import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useExplorationStore } from "@/store/explorationStore";
import { LiurenPanel } from "./LiurenPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  useExplorationStore.setState({ liurenEnabled: true, liurenChart: null });
});

describe("LiurenPanel（手动起课；stage-12 T1）", () => {
  it("月将 / 时辰 / 日干支 三项可选，起课后课体入 store 并渲染课体卡", async () => {
    render(<LiurenPanel />);
    expect(screen.getByTestId("liuren-panel")).toBeInTheDocument();

    // 三要素选择器（月将默认 登明（亥）、时辰子、日干支甲子）
    const monthSelect = screen.getByTestId("liuren-month-general") as HTMLSelectElement;
    expect([...monthSelect.options].map((option) => option.value)).toHaveLength(12);
    expect(screen.getByTestId("liuren-hour-branch")).toBeInTheDocument();
    const ganzhiSelect = screen.getByTestId("liuren-day-ganzhi") as HTMLSelectElement;
    expect([...ganzhiSelect.options]).toHaveLength(60); // 六十甲子

    expect(screen.getByText("尚未起课")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("liuren-cast"));

    await waitFor(() => expect(screen.getByTestId("liuren-card")).toBeInTheDocument());
    const chart = useExplorationStore.getState().liurenChart;
    expect(chart).not.toBeNull();
    expect(chart?.dayGanzhi).toBe("甲子");
    expect(chart?.monthGeneral).toBe("亥");
    // 课体卡展示四课与三传
    expect(screen.getByTestId("liuren-card").textContent).toContain("一课");
    expect(screen.getByTestId("liuren-card").textContent).toContain("初传");
  });

  it("运行时切换月将 / 时辰后重新起课 → 课体随之更新（store 覆写）", async () => {
    render(<LiurenPanel />);
    fireEvent.click(screen.getByTestId("liuren-cast"));
    await waitFor(() => expect(useExplorationStore.getState().liurenChart).not.toBeNull());
    const before = useExplorationStore.getState().liurenChart;

    // 月将 = 时辰 → 伏吟课
    fireEvent.change(screen.getByTestId("liuren-hour-branch"), { target: { value: "亥" } });
    fireEvent.click(screen.getByTestId("liuren-cast"));

    await waitFor(() =>
      expect(useExplorationStore.getState().liurenChart?.pattern.name).toBe("伏吟课"),
    );
    expect(useExplorationStore.getState().liurenChart).not.toEqual(before);
  });
});
