import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useExplorationStore } from "@/store/explorationStore";
import { IChingPanel } from "./IChingPanel";

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  useExplorationStore.setState({ casting: null });
});

describe("IChingPanel（起卦面板）", () => {
  it("随机起卦（种子 42）→ 渲染本卦/之卦与解读", async () => {
    render(<IChingPanel />);
    expect(screen.getByText("尚未起卦")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "随机起卦" }));

    await waitFor(() => expect(useExplorationStore.getState().casting).toBeTruthy());
    expect(screen.getByTestId("ben-gua")).toBeInTheDocument();
    expect(screen.getByTestId("zhi-gua")).toBeInTheDocument();
    expect(screen.getByTestId("zhuxi-reading")).toBeInTheDocument();
    expect(screen.getAllByTestId("reading-verse").length).toBeGreaterThan(0);
  });

  it("种子复现：同种子两次起卦结果一致", async () => {
    render(<IChingPanel />);
    fireEvent.click(screen.getByRole("button", { name: "随机起卦" }));
    await waitFor(() => expect(useExplorationStore.getState().casting).toBeTruthy());
    const first = useExplorationStore.getState().casting;

    fireEvent.click(screen.getByRole("button", { name: "随机起卦" }));
    const second = useExplorationStore.getState().casting;
    expect(second?.benGua.name).toBe(first?.benGua.name);
    expect(second?.changingLines).toEqual(first?.changingLines);
  });

  it("手动起卦（乾 + 初爻变）→ 本卦乾 / 之卦姤 / 变爻高亮 / 一爻变解读", async () => {
    render(<IChingPanel />);
    fireEvent.change(screen.getByLabelText("本卦二进制"), { target: { value: "111111" } });
    fireEvent.change(screen.getByLabelText("变爻下标"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "手动起卦" }));

    await waitFor(() => expect(useExplorationStore.getState().casting?.benGua.name).toBe("乾"));
    expect(useExplorationStore.getState().casting?.zhiGua.name).toBe("姤");
    expect(screen.getByTestId("ben-gua").textContent).toContain("乾");
    expect(screen.getByTestId("zhi-gua").textContent).toContain("姤");
    expect(screen.getAllByTestId("changing-line")).toHaveLength(1); // 变爻高亮
    expect(screen.getByTestId("zhuxi-reading").textContent).toContain("一爻变");
    // 经文原样展示（不译）
    expect(screen.getAllByTestId("reading-verse")[0].textContent).toContain("潜龙勿用");
  });

  it("不呈现时间起卦入口（v0.3 推迟）", () => {
    render(<IChingPanel />);
    expect(screen.queryByText(/时间/)).toBeNull();
    expect(screen.queryByText(/干支|农历|time/i)).toBeNull();
    // 仅两种起卦入口
    expect(screen.getByRole("button", { name: "随机起卦" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手动起卦" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
