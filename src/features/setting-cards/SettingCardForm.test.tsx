import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { SettingCardForm } from "./SettingCardForm";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(undefined);
});

describe("SettingCardForm（tier 四级下拉；BUG-001 修复）", () => {
  it("选 `tier=dark` + 填名称 → `onSubmit` 收到 `{title,content,kind,tier}`", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<SettingCardForm onSubmit={onSubmit} onCancel={() => {}} />);

    // 四级选项齐备（与 `SETTING_CARD_TIERS` 一致，缺省 conservative `short`）
    const tierSelect = screen.getByTestId("setting-card-tier") as HTMLSelectElement;
    expect(tierSelect.value).toBe("short");
    expect([...tierSelect.options].map((option) => option.value)).toEqual([
      "main",
      "dark",
      "short",
      "temp",
    ]);

    fireEvent.change(screen.getByRole("textbox", { name: /名称/ }), {
      target: { value: "幕后身份" },
    });
    fireEvent.change(tierSelect, { target: { value: "dark" } });
    fireEvent.click(screen.getByText("保存"));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        title: "幕后身份",
        content: "",
        kind: "general",
        tier: "dark",
      }),
    );
  });

  it("编辑既有卡 → 表单以**既有 `tier`** 为初值（不回退缺省）", () => {
    render(
      <SettingCardForm
        initial={{
          id: 1,
          novelId: 1,
          title: "主线规则",
          content: "月相更替",
          kind: "general",
          tier: "main",
          createdAt: "c",
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={() => {}}
      />,
    );
    expect((screen.getByTestId("setting-card-tier") as HTMLSelectElement).value).toBe("main");
  });
});
