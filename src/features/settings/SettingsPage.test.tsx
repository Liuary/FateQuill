import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import { SettingsPage } from "./SettingsPage";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([]);
    return Promise.resolve(undefined);
  });
});

describe("SettingsPage（布局对齐；stage-03 op-009）", () => {
  it("可读容器：居中 + 统一内边距（`mx-auto` / `max-w-3xl` / `p-6`）", () => {
    const { container } = render(<SettingsPage />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("mx-auto");
    expect(section?.className).toContain("max-w-3xl");
    expect(section?.className).toContain("p-6");
  });

  it("「设置」标题与「新增模型配置」按钮**同一行容器**", () => {
    render(<SettingsPage />);
    const header = screen.getByTestId("settings-header");

    // 标题与按钮同属一个 flex 行容器（不再各占一行）
    expect(within(header).getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "新增模型配置" })).toBeInTheDocument();
    expect(header.className).toContain("justify-between");
  });
});
