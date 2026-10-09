import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import { SkillLibrary } from "./SkillLibrary";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const materialRow = {
  id: 7,
  source_type: "user_manual",
  source_model: "",
  excerpt: "她不禁皱眉",
  position_json: "{}",
  reason: "套话",
  label: "cliche",
  chapter_id: null,
  status: "confirmed",
  created_at: "c",
};

const skillRow = {
  id: 1,
  version: "1.0.0",
  title: "去套话",
  rule: "避免「不禁」等套话",
  examples_json: "[]",
  source_material_ids_json: "[7]",
  created_at: "c",
};

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown>;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_skill_entries") return Promise.resolve([skillRow]);
    if (cmd === "list_materials") return Promise.resolve([materialRow]);
    if (cmd === "save_skill_entry" || cmd === "update_skill_entry")
      return Promise.resolve(skillRow);
    return Promise.resolve(undefined);
  });
});

describe("SkillLibrary（规避 skill 库）", () => {
  it("列出 skill 条目（版本 / 标题 / 规则 / 来源素材数）", async () => {
    const { container } = render(<SkillLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("skill-entry")).toHaveLength(1));

    const text = container.textContent ?? "";
    expect(text).toContain("v1.0.0");
    expect(text).toContain("去套话");
    expect(text).toContain("避免「不禁」等套话");
    expect(text).toContain("来源素材: 1");
  });

  it("归纳：选 confirmed 素材 + 填 rule → save_skill_entry（来源素材 id 引用）", async () => {
    render(<SkillLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("skill-entry")).toHaveLength(1));

    fireEvent.click(screen.getByRole("checkbox")); // 勾选来源素材（id=7）
    fireEvent.change(screen.getByLabelText("标题"), { target: { value: "去翻译腔" } });
    fireEvent.change(screen.getByLabelText("规则"), { target: { value: "避免直译式从句" } });
    fireEvent.change(screen.getByLabelText("示例"), { target: { value: "他很开心 => 他笑了" } });
    fireEvent.click(screen.getByRole("button", { name: "归纳入库" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_skill_entry", expect.anything()),
    );
    expect(argsOf("save_skill_entry").sourceMaterialIds).toEqual([7]);
    expect(argsOf("save_skill_entry").version).toBe("1.0.0");
    expect(argsOf("save_skill_entry").title).toBe("去翻译腔");
    expect(argsOf("save_skill_entry").examples).toEqual([{ bad: "他很开心", good: "他笑了" }]);
  });

  it("编辑 → 更新（版本管理）", async () => {
    render(<SkillLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("skill-entry")).toHaveLength(1));

    fireEvent.click(
      within(screen.getAllByTestId("skill-entry")[0]).getByRole("button", { name: "编辑" }),
    );
    expect(screen.getByLabelText("标题")).toHaveValue("去套话");

    fireEvent.change(screen.getByLabelText("版本"), { target: { value: "1.1.0" } });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("update_skill_entry", expect.anything()),
    );
    expect(argsOf("update_skill_entry").id).toBe(1);
    expect(argsOf("update_skill_entry").version).toBe("1.1.0");
  });

  it("删除 → delete_skill_entry", async () => {
    render(<SkillLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("skill-entry")).toHaveLength(1));

    fireEvent.click(
      within(screen.getAllByTestId("skill-entry")[0]).getByRole("button", { name: "删除" }),
    );

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("delete_skill_entry", { id: 1 }));
  });
});
