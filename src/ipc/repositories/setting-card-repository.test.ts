import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createSettingCardRepository } from "./setting-card-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const row = {
  id: 4,
  novel_id: 7,
  title: "设定",
  content: "内容",
  kind: "general",
  created_at: "c",
};

describe("setting-card repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByNovel 按父 id 过滤并映射", async () => {
    invokeMock.mockResolvedValue([row, { ...row, id: 5, novel_id: 8 }]);
    const out = await createSettingCardRepository().listByNovel(7);
    expect(invokeMock).toHaveBeenCalledWith("list_setting_cards", undefined);
    expect(out).toEqual([
      { id: 4, novelId: 7, title: "设定", content: "内容", kind: "general", createdAt: "c" },
    ]);
  });

  it("get 映射 createdAt", async () => {
    invokeMock.mockResolvedValue(row);
    const out = await createSettingCardRepository().get(4);
    expect(invokeMock).toHaveBeenCalledWith("get_setting_card", { id: 4 });
    expect(out.createdAt).toBe("c");
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "setting_card not found" };
    });
    const err = await captureError(createSettingCardRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
  });
});
