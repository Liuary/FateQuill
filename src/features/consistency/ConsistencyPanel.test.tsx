import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import { useConsistencyFocusStore } from "@/store/consistencyStore";
import { ConsistencyPanel } from "./ConsistencyPanel";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const cfgRow = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  base_url: "https://api.example.com",
  model_name: "m",
  temperature: 0.7,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};

const conflictRow = (over: Record<string, unknown> = {}) => ({
  id: 7,
  novel_id: 1,
  a_id: 3,
  b_id: 9,
  type: "life-status",
  evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
  severity: "high",
  status: "open",
  action: "",
  created_at: "c",
  resolved_at: null,
  ...over,
});

let conflictRows: unknown[];

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  conflictRows = [conflictRow(), conflictRow({ id: 8, status: "resolved", action: "edit" })];
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
    if (cmd === "keyring_exists") return Promise.resolve(true);
    if (cmd === "list_conflict_records") return Promise.resolve(conflictRows);
    if (cmd === "list_setting_cards") return Promise.resolve([]);
    if (cmd === "resolve_conflict_record") return Promise.resolve(conflictRow());
    return Promise.resolve(undefined);
  });
  useConsistencyFocusStore.setState({ focus: null });
});

describe("ConsistencyPanel（冲突列表 + 处置入口）", () => {
  it("渲染**落库的跨会话冲突记录**（含状态）+ 四处置按钮可用", async () => {
    render(<ConsistencyPanel novelId={1} />);

    await waitFor(() => expect(screen.getAllByTestId("conflict-card")).toHaveLength(2));
    expect(invokeMock).toHaveBeenCalledWith("list_conflict_records", { novelId: 1 });
    // 状态呈现（open / resolved）
    expect(screen.getByText("待处置")).toBeInTheDocument();
    expect(screen.getByText("已处置")).toBeInTheDocument();
    // 四处置入口 + 语义复核（已配置模型）
    expect(screen.getAllByTestId("action-change-tier")).toHaveLength(2);
    expect(screen.getAllByTestId("action-edit")).toHaveLength(2);
    expect(screen.getAllByTestId("action-false-positive")).toHaveLength(2);
    expect(screen.getAllByTestId("action-ignore")).toHaveLength(2);
    expect(screen.getAllByTestId("action-review-l2")).toHaveLength(2);
  });

  it("无冲突 → 空态", async () => {
    conflictRows = [];
    render(<ConsistencyPanel novelId={1} />);
    await waitFor(() => expect(screen.getByText("暂无冲突记录")).toBeInTheDocument());
    expect(screen.queryByTestId("conflict-card")).not.toBeInTheDocument();
  });

  it("「标记误报」→ 调 `resolve_conflict_record`（action=false_positive）并刷新列表", async () => {
    render(<ConsistencyPanel novelId={1} />);
    await waitFor(() => expect(screen.getAllByTestId("conflict-card")).toHaveLength(2));
    const before = invokeMock.mock.calls.filter(
      (call) => call[0] === "list_conflict_records",
    ).length;

    fireEvent.click(screen.getAllByTestId("action-false-positive")[0]);

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("resolve_conflict_record", {
        id: 7,
        action: "false_positive",
      }),
    );
    await waitFor(() => {
      const after = invokeMock.mock.calls.filter(
        (call) => call[0] === "list_conflict_records",
      ).length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("「编辑设定卡」→ 发出定位请求（focus 置位，供设定卡面板消费）", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_model_configs") return Promise.resolve([cfgRow]);
      if (cmd === "keyring_exists") return Promise.resolve(true);
      if (cmd === "list_conflict_records") return Promise.resolve(conflictRows);
      if (cmd === "get_setting_card") {
        return Promise.resolve({
          id: 3,
          novel_id: 1,
          title: "渡鸦",
          content: "渡鸦已死",
          kind: "世界观",
          tier: "main",
          created_at: "c",
        });
      }
      if (cmd === "resolve_conflict_record") return Promise.resolve(conflictRow());
      return Promise.resolve(undefined);
    });
    render(<ConsistencyPanel novelId={1} />);
    await waitFor(() => expect(screen.getAllByTestId("conflict-card")).toHaveLength(2));

    fireEvent.click(screen.getAllByTestId("action-edit")[0]);

    await waitFor(() => expect(useConsistencyFocusStore.getState().focus).not.toBeNull());
    expect(useConsistencyFocusStore.getState().focus?.cardId).toBe(3);
  });

  it("「检测冲突」→ 运行 L1 并落库新检出（无卡 → 零新增）", async () => {
    render(<ConsistencyPanel novelId={1} />);
    await waitFor(() => expect(screen.getAllByTestId("conflict-card")).toHaveLength(2));

    fireEvent.click(screen.getByTestId("detect-conflicts"));

    await waitFor(() =>
      expect(invokeMock.mock.calls.some((call) => call[0] === "list_setting_cards")).toBe(true),
    );
    // 无设定卡（list_setting_cards → []）→ 不产生 save_conflict_record
    expect(invokeMock.mock.calls.some((call) => call[0] === "save_conflict_record")).toBe(false);
  });
});
