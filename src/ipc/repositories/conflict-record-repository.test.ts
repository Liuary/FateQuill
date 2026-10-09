import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createConflictRecordRepository } from "./conflict-record-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const row = {
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
};

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;

describe("conflict-record repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("save：透传 camelCase 参数（冲突类型走 `conflictType`）+ 行映射", async () => {
    invokeMock.mockResolvedValue(row);
    const saved = await createConflictRecordRepository().save({
      novelId: 1,
      aId: 3,
      bId: 9,
      type: "life-status",
      evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
      severity: "high",
    });

    expect(argsOf("save_conflict_record")).toEqual({
      novelId: 1,
      aId: 3,
      bId: 9,
      conflictType: "life-status",
      evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
      severity: "high",
    });
    expect(saved).toEqual({
      id: 7,
      novelId: 1,
      aId: 3,
      bId: 9,
      type: "life-status",
      evidence: "渡鸦已死 ｜ 渡鸦尚在人间",
      severity: "high",
      status: "open",
      action: "",
      createdAt: "c",
      resolvedAt: null,
    });
  });

  it("listByNovel / get：命令参数与映射（`resolved_at` → `resolvedAt`）", async () => {
    invokeMock.mockResolvedValue([
      { ...row, status: "resolved", action: "change_tier", resolved_at: "r" },
    ]);
    const list = await createConflictRecordRepository().listByNovel(1);
    expect(invokeMock).toHaveBeenCalledWith("list_conflict_records", { novelId: 1 });
    expect(list[0].status).toBe("resolved");
    expect(list[0].action).toBe("change_tier");
    expect(list[0].resolvedAt).toBe("r");

    invokeMock.mockReset();
    invokeMock.mockResolvedValue(row);
    await createConflictRecordRepository().get(7);
    expect(invokeMock).toHaveBeenCalledWith("get_conflict_record", { id: 7 });
  });

  it("resolve：动作透传（`false_positive` / `ignore` 由服务端映射为 ignored）", async () => {
    invokeMock.mockResolvedValue({ ...row, status: "ignored", action: "false_positive" });
    const resolved = await createConflictRecordRepository().resolve(7, "false_positive");
    expect(invokeMock).toHaveBeenCalledWith("resolve_conflict_record", {
      id: 7,
      action: "false_positive",
    });
    expect(resolved.status).toBe("ignored");

    invokeMock.mockReset();
    invokeMock.mockResolvedValue(row);
    await createConflictRecordRepository().remove(7);
    expect(invokeMock).toHaveBeenCalledWith("delete_conflict_record", { id: 7 });
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "conflict_record not found" };
    });
    const err = await captureError(createConflictRecordRepository().get(99));
    expect(err).toBeInstanceOf(IpcError);
  });
});
