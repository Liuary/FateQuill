import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { SettingCardsPanel } from "./SettingCardsPanel";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const cardRow = (id: number, title: string, content: string, kind = "general") => ({
  id,
  novel_id: 1,
  title,
  content,
  kind,
  created_at: "c",
});

let rows: unknown[];

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  rows = [cardRow(1, "魔法体系", "以元素为本"), cardRow(2, "地理", "大陆")];
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_setting_cards") return Promise.resolve(rows);
    if (cmd === "create_setting_card") return Promise.resolve(cardRow(3, "新", "x"));
    if (cmd === "update_setting_card") return Promise.resolve(cardRow(1, "改", "y"));
    if (cmd === "delete_setting_card") return Promise.resolve(undefined);
    return Promise.resolve(undefined);
  });
});

describe("SettingCardsPanel", () => {
  it("渲染列表（复用 list_setting_cards 仓储命令）", async () => {
    render(<SettingCardsPanel novelId={1} />);
    await waitFor(() => expect(screen.getByText("魔法体系")).toBeInTheDocument());
    expect(screen.getByText("地理")).toBeInTheDocument();
    expect(invokeMock.mock.calls.some((c) => c[0] === "list_setting_cards")).toBe(true);
  });

  it("新增 → create_setting_card 且 reload", async () => {
    render(<SettingCardsPanel novelId={1} />);
    await waitFor(() => expect(screen.getByText("魔法体系")).toBeInTheDocument());
    const before = invokeMock.mock.calls.filter((c) => c[0] === "list_setting_cards").length;

    fireEvent.click(screen.getByText("新增设定卡"));
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "新卡" } });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "create_setting_card")).toBe(true),
    );
    await waitFor(() => {
      const after = invokeMock.mock.calls.filter((c) => c[0] === "list_setting_cards").length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("编辑 → update_setting_card", async () => {
    render(<SettingCardsPanel novelId={1} />);
    await waitFor(() => expect(screen.getByText("魔法体系")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("编辑")[0]);
    await waitFor(() => expect(screen.getByText("保存")).toBeInTheDocument());
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "update_setting_card")).toBe(true),
    );
  });

  it("删除 → delete_setting_card", async () => {
    render(<SettingCardsPanel novelId={1} />);
    await waitFor(() => expect(screen.getByText("魔法体系")).toBeInTheDocument());
    fireEvent.click(screen.getAllByText("删除")[0]);
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "delete_setting_card")).toBe(true),
    );
  });
});
