import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/app/i18n";
import { ConfirmInline } from "./ConfirmInline";

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
});

describe("ConfirmInline（内联二次确认）", () => {
  it("确认 → onConfirm（onCancel 不触发）", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmInline prompt="危险操作" onConfirm={onConfirm} onCancel={onCancel} />);

    expect(screen.getByText("危险操作")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("取消 → onCancel（onConfirm 不触发）", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmInline prompt="危险操作" onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("可自定义按钮文案", () => {
    render(
      <ConfirmInline
        prompt="p"
        confirmLabel="就这样"
        cancelLabel="算了"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "就这样" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "算了" })).toBeInTheDocument();
  });
});
