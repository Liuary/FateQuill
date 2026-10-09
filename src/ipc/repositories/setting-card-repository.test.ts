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
  tier: "main",
  created_at: "c",
};

describe("setting-card repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByNovel 按父 id 过滤并映射（含 tier 映射）", async () => {
    invokeMock.mockResolvedValue([row, { ...row, id: 5, novel_id: 8 }]);
    const out = await createSettingCardRepository().listByNovel(7);
    expect(invokeMock).toHaveBeenCalledWith("list_setting_cards", undefined);
    expect(out).toEqual([
      {
        id: 4,
        novelId: 7,
        title: "设定",
        content: "内容",
        kind: "general",
        tier: "main",
        createdAt: "c",
      },
    ]);
  });

  it("listByNovel 传 tier → SQL 层过滤参数透传", async () => {
    invokeMock.mockResolvedValue([{ ...row, tier: "dark" }]);
    const out = await createSettingCardRepository().listByNovel(7, { tier: "dark" });
    expect(invokeMock).toHaveBeenCalledWith("list_setting_cards", { tier: "dark" });
    expect(out[0].tier).toBe("dark");
  });

  it("未知 tier 值 → 回退缺省 short（值域兜底）", async () => {
    invokeMock.mockResolvedValue([{ ...row, tier: "bogus" }]);
    const out = await createSettingCardRepository().listByNovel(7);
    expect(out[0].tier).toBe("short");
  });

  it("create 透传 tier（缺省不带该参数）", async () => {
    invokeMock.mockResolvedValue(row);
    const repo = createSettingCardRepository();
    await repo.create({ novelId: 7, title: "T", content: "C", kind: "general", tier: "dark" });
    expect(invokeMock).toHaveBeenCalledWith("create_setting_card", {
      novelId: 7,
      title: "T",
      content: "C",
      kind: "general",
      tier: "dark",
    });

    invokeMock.mockClear();
    invokeMock.mockResolvedValue(row);
    await repo.create({ novelId: 7, title: "T", content: "C", kind: "general" });
    expect(invokeMock).toHaveBeenCalledWith("create_setting_card", {
      novelId: 7,
      title: "T",
      content: "C",
      kind: "general",
    });
  });

  it("update 透传 tier（缺省不带 → 服务端保留既有分级）", async () => {
    invokeMock.mockResolvedValue({ ...row, tier: "short" });
    const repo = createSettingCardRepository();
    await repo.update(4, { title: "T", content: "C", kind: "general", tier: "short" });
    expect(invokeMock).toHaveBeenCalledWith("update_setting_card", {
      id: 4,
      title: "T",
      content: "C",
      kind: "general",
      tier: "short",
    });

    invokeMock.mockClear();
    invokeMock.mockResolvedValue(row);
    await repo.update(4, { title: "T", content: "C", kind: "general" });
    expect(invokeMock).toHaveBeenCalledWith("update_setting_card", {
      id: 4,
      title: "T",
      content: "C",
      kind: "general",
    });
  });

  it("get 映射 tier 与 createdAt", async () => {
    invokeMock.mockResolvedValue(row);
    const out = await createSettingCardRepository().get(4);
    expect(invokeMock).toHaveBeenCalledWith("get_setting_card", { id: 4 });
    expect(out.createdAt).toBe("c");
    expect(out.tier).toBe("main");
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "setting_card not found" };
    });
    const err = await captureError(createSettingCardRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
  });
});
