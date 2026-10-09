import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import i18n from "@/app/i18n";
import { MaterialLibrary } from "./MaterialLibrary";

const hoisted = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  toJson: vi.fn(() => "JSON"),
  toCsv: vi.fn(() => "CSV"),
  download: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: hoisted.invokeMock }));
// 导出三函数替换为 spy（断言「生产调用非零」与调用参数）
vi.mock("./export", () => ({
  materialsToJson: hoisted.toJson,
  materialsToCsv: hoisted.toCsv,
  downloadExport: hoisted.download,
}));

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  source_type: "multi_model_creation",
  source_model: "modelA",
  excerpt: "她不禁皱眉",
  position_json: "{}",
  reason: "套话",
  label: "cliche",
  chapter_id: null,
  status: "confirmed",
  created_at: "2026-10-10T00:00:00Z",
  ...over,
});

const listCalls = () =>
  hoisted.invokeMock.mock.calls
    .filter((call) => call[0] === "list_materials")
    .map((call) => call[1]);
const lastListArgs = () =>
  listCalls()[listCalls().length - 1] as Record<string, unknown> | undefined;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  hoisted.invokeMock.mockReset();
  hoisted.invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_materials") return Promise.resolve([row()]);
    return Promise.resolve(undefined);
  });
  hoisted.toJson.mockClear();
  hoisted.toCsv.mockClear();
  hoisted.download.mockClear();
});

describe("MaterialLibrary（素材库面板，BUG-001）", () => {
  it("列表渲染素材（来源模型 / 引文 / 理由 / 标签 / 通道 / 状态）", async () => {
    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));

    const item = screen.getAllByTestId("material-row")[0];
    expect(within(item).getByText("她不禁皱眉")).toBeInTheDocument();
    const text = item.textContent ?? "";
    expect(text).toContain("modelA");
    expect(text).toContain("multi_model_creation");
    expect(text).toContain("confirmed");
    expect(text).toContain("套话");
    expect(text).toContain("cliche");
  });

  it("空态提示", async () => {
    hoisted.invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_materials" ? Promise.resolve([]) : Promise.resolve(undefined),
    );
    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getByText("暂无素材")).toBeInTheDocument());
  });

  it("检索：关键字 / status / sourceType 传入 list_materials", async () => {
    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));

    fireEvent.change(screen.getByLabelText("关键字"), { target: { value: "皱眉" } });
    await waitFor(() => expect(lastListArgs()).toMatchObject({ query: "皱眉" }));

    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "confirmed" } });
    await waitFor(() =>
      expect(lastListArgs()).toMatchObject({ status: "confirmed", query: "皱眉" }),
    );

    fireEvent.change(screen.getByLabelText("来源通道"), { target: { value: "user_manual" } });
    await waitFor(() =>
      expect(lastListArgs()).toMatchObject({
        status: "confirmed",
        sourceType: "user_manual",
        query: "皱眉",
      }),
    );
  });

  it("导出：以当前列表调用 export.ts 三函数并下载（文件名/类型正确）", async () => {
    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "导出 JSON" }));
    expect(hoisted.toJson).toHaveBeenCalledTimes(1);
    const jsonArgs = hoisted.toJson.mock.calls as unknown as [{ excerpt: string }[]][];
    expect(jsonArgs[0][0]).toHaveLength(1); // 以「当前列表」调用
    expect(jsonArgs[0][0][0].excerpt).toBe("她不禁皱眉");
    expect(hoisted.download).toHaveBeenCalledWith("materials.json", "JSON", "application/json");

    fireEvent.click(screen.getByRole("button", { name: "导出 CSV" }));
    expect(hoisted.toCsv).toHaveBeenCalledTimes(1);
    expect(hoisted.download).toHaveBeenCalledWith("materials.csv", "CSV", "text/csv");
  });

  it("删除成功 → delete_material 调用 + 重新加载", async () => {
    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));
    const before = listCalls().length;

    hoisted.invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_materials" ? Promise.resolve([]) : Promise.resolve(undefined),
    );
    fireEvent.click(
      within(screen.getAllByTestId("material-row")[0]).getByRole("button", { name: "删除" }),
    );

    await waitFor(() =>
      expect(hoisted.invokeMock).toHaveBeenCalledWith("delete_material", { id: 1 }),
    );
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before)); // reload
    await waitFor(() => expect(screen.queryAllByTestId("material-row")).toHaveLength(0));
  });

  it("删除被拒（FK_VIOLATION，REV-012）→ 拒绝提示且列表未移除", async () => {
    hoisted.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_materials") return Promise.resolve([row()]);
      if (cmd === "delete_material") {
        return Promise.reject({ code: "FK_VIOLATION", message: "referenced by skill_entry" });
      }
      return Promise.resolve(undefined);
    });

    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));
    fireEvent.click(
      within(screen.getAllByTestId("material-row")[0]).getByRole("button", { name: "删除" }),
    );

    await waitFor(() =>
      expect(screen.getByText("该素材被 skill 引用，无法删除")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("material-row")).toHaveLength(1); // 未移除
  });

  it("其它删除失败 → 通用失败提示", async () => {
    hoisted.invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_materials") return Promise.resolve([row()]);
      if (cmd === "delete_material") return Promise.reject({ code: "INTERNAL", message: "boom" });
      return Promise.resolve(undefined);
    });

    render(<MaterialLibrary />);
    await waitFor(() => expect(screen.getAllByTestId("material-row")).toHaveLength(1));
    fireEvent.click(
      within(screen.getAllByTestId("material-row")[0]).getByRole("button", { name: "删除" }),
    );

    await waitFor(() => expect(screen.getByText("删除失败")).toBeInTheDocument());
  });
});
