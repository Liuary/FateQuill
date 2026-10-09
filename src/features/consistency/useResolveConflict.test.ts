import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ConflictRecord } from "@/domain/models/conflict-record";
import { useConsistencyFocusStore } from "@/store/consistencyStore";
import { locateEvidence, useResolveConflict } from "./useResolveConflict";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const CARD_CONTENT = "旧志记载：渡鸦已死于第七次潮灾。";

const cardRow = {
  id: 3,
  novel_id: 1,
  title: "渡鸦",
  content: CARD_CONTENT,
  kind: "世界观",
  tier: "main",
  created_at: "c",
};

const conflictRow = {
  id: 7,
  novel_id: 1,
  a_id: 3,
  b_id: 9,
  type: "life-status",
  evidence: "渡鸦：「渡鸦已死于第七次潮灾」 ｜「渡鸦尚在人间」",
  severity: "high",
  status: "open",
  action: "",
  created_at: "c",
  resolved_at: null,
};

const conflict: ConflictRecord = {
  id: 7,
  novelId: 1,
  aId: 3,
  bId: 9,
  type: "life-status",
  evidence: conflictRow.evidence,
  severity: "high",
  status: "open",
  action: "",
  createdAt: "c",
  resolvedAt: null,
};

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "get_setting_card") return Promise.resolve(cardRow);
    if (cmd === "update_setting_card") return Promise.resolve(cardRow);
    if (cmd === "resolve_conflict_record") return Promise.resolve(conflictRow);
    return Promise.resolve(undefined);
  });
  useConsistencyFocusStore.setState({ focus: null });
});

describe("locateEvidence（verbatim 定位；缺失回退卡首）", () => {
  it("优先命中 `「…」` 引文（L1 证据形态）", () => {
    expect(locateEvidence(CARD_CONTENT, conflict.evidence)).toEqual({
      index: 5,
      length: "渡鸦已死于第七次潮灾".length,
    });
  });

  it("引文未命中 → 逐段回退；全不命中 → **回退卡首**（0,0）", () => {
    expect(locateEvidence(CARD_CONTENT, "渡鸦已死于第七次潮灾")).toEqual({
      index: 5,
      length: "渡鸦已死于第七次潮灾".length,
    });
    expect(locateEvidence(CARD_CONTENT, "不存在的片段 ｜ 也不存在")).toEqual({
      index: 0,
      length: 0,
    });
    expect(locateEvidence(CARD_CONTENT, "")).toEqual({ index: 0, length: 0 });
  });
});

describe("useResolveConflict（四动作处置）", () => {
  it("change_tier：改分级（update 传 tier）+ 处置留痕（action=change_tier）", async () => {
    const { result } = renderHook(() => useResolveConflict());

    let ok = false;
    await act(async () => {
      ok = await result.current.resolve(conflict, "change_tier", { tier: "dark" });
    });

    expect(ok).toBe(true);
    expect(argsOf("update_setting_card")).toEqual({
      id: 3,
      title: "渡鸦",
      content: CARD_CONTENT,
      kind: "世界观",
      tier: "dark",
    });
    expect(argsOf("resolve_conflict_record")).toEqual({ id: 7, action: "change_tier" });
  });

  it("change_tier：未指定分级 → 缺省保守 `short`", async () => {
    const { result } = renderHook(() => useResolveConflict());
    await act(async () => {
      await result.current.resolve(conflict, "change_tier");
    });
    expect(argsOf("update_setting_card")?.tier).toBe("short");
  });

  it("edit：**跳转定位**（focus 置位，命中 evidence 片段）+ 留痕（action=edit），**不改卡内容**", async () => {
    const onResolved = vi.fn();
    const { result } = renderHook(() => useResolveConflict({ onResolved }));

    await act(async () => {
      await result.current.resolve(conflict, "edit");
    });

    expect(useConsistencyFocusStore.getState().focus).toEqual({
      cardId: 3,
      index: 5,
      length: "渡鸦已死于第七次潮灾".length,
    });
    expect(invokeMock.mock.calls.some((call) => call[0] === "update_setting_card")).toBe(false);
    expect(argsOf("resolve_conflict_record")).toEqual({ id: 7, action: "edit" });
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("edit：evidence 未逐字命中 → 回退卡首（index 0 / length 0）", async () => {
    const { result } = renderHook(() => useResolveConflict());
    await act(async () => {
      await result.current.resolve({ ...conflict, evidence: "完全不相干的依据" }, "edit");
    });
    expect(useConsistencyFocusStore.getState().focus).toEqual({ cardId: 3, index: 0, length: 0 });
  });

  it("false_positive / ignore：**不读卡**，仅处置留痕（动作各自区分）", async () => {
    const { result } = renderHook(() => useResolveConflict());

    await act(async () => {
      await result.current.resolve(conflict, "false_positive");
    });
    expect(argsOf("resolve_conflict_record")).toEqual({ id: 7, action: "false_positive" });

    invokeMock.mockClear();
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "resolve_conflict_record" ? Promise.resolve(conflictRow) : Promise.resolve(undefined),
    );
    await act(async () => {
      await result.current.resolve(conflict, "ignore");
    });
    expect(argsOf("resolve_conflict_record")).toEqual({ id: 7, action: "ignore" });
    expect(invokeMock.mock.calls.some((call) => call[0] === "get_setting_card")).toBe(false);
  });

  it("失败不抛穿：置 `error` 并返回 `false`", async () => {
    invokeMock.mockImplementation(() => Promise.reject(new Error("ipc down")));
    const { result } = renderHook(() => useResolveConflict());

    let ok = true;
    await act(async () => {
      ok = await result.current.resolve(conflict, "ignore");
    });
    expect(ok).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
