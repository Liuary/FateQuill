import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BenchPanel } from "./BenchPanel";

describe("BenchPanel（DEV 基准面板：折叠式、默认收起）", () => {
  it("默认收起：仅一行小按钮，**编辑区与读数不渲染**（不遮挡工作区）", () => {
    render(<BenchPanel />);

    expect(screen.getByTestId("bench-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("bench-body")).toBeNull();
    // 三个基准按钮不可见（收起态）
    expect(screen.queryByText("运行延迟基准（200 次插入）")).toBeNull();
  });

  it("点击展开 → 三项基准与读数齐备、编辑区受高度约束；再点收起", () => {
    render(<BenchPanel />);

    fireEvent.click(screen.getByTestId("bench-toggle"));
    const body = screen.getByTestId("bench-body");
    expect(body).toBeInTheDocument();

    // 三项基准功能文案不变
    expect(screen.getByText("运行延迟基准（200 次插入）")).toBeInTheDocument();
    expect(screen.getByText("统计 .ProseMirror 实例数")).toBeInTheDocument();
    expect(screen.getByText("记录堆增幅")).toBeInTheDocument();
    // 三条读数文案不变
    expect(body.textContent).toContain("P95");
    expect(body.textContent).toContain("实例数");
    expect(body.textContent).toContain("堆增幅");
    // 展开态编辑区有高度约束（不再铺满整屏）
    expect(body.querySelector(".max-h-48")).toBeTruthy();

    fireEvent.click(screen.getByTestId("bench-toggle"));
    expect(screen.queryByTestId("bench-body")).toBeNull();
  });
});
