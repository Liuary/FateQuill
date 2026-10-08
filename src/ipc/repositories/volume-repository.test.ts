import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createVolumeRepository } from "./volume-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("volume repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByNovel 按父 id 过滤并映射", async () => {
    invokeMock.mockResolvedValue([
      { id: 1, novel_id: 7, title: "v1", order_index: 0 },
      { id: 2, novel_id: 8, title: "v2", order_index: 1 },
    ]);
    const out = await createVolumeRepository().listByNovel(7);
    expect(invokeMock).toHaveBeenCalledWith("list_volumes", undefined);
    expect(out).toEqual([{ id: 1, novelId: 7, title: "v1", orderIndex: 0 }]);
  });

  it("create 透传参数", async () => {
    invokeMock.mockResolvedValue({ id: 3, novel_id: 7, title: "v", order_index: 1 });
    await createVolumeRepository().create({ novelId: 7, title: "v", orderIndex: 1 });
    expect(invokeMock).toHaveBeenCalledWith("create_volume", {
      novelId: 7,
      title: "v",
      orderIndex: 1,
    });
  });

  it("update 读取当前 orderIndex 后更新标题", async () => {
    invokeMock.mockResolvedValue({ id: 3, novel_id: 7, title: "v2", order_index: 2 });
    await createVolumeRepository().update(3, { title: "v2" });
    expect(invokeMock).toHaveBeenNthCalledWith(1, "get_volume", { id: 3 });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "update_volume", {
      id: 3,
      title: "v2",
      orderIndex: 2,
    });
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "volume not found" };
    });
    const err = await captureError(createVolumeRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
  });

  it("reorder 调用 reorder_volumes", async () => {
    invokeMock.mockResolvedValue(undefined);
    await createVolumeRepository().reorder(7, [3, 1, 2]);
    expect(invokeMock).toHaveBeenCalledWith("reorder_volumes", {
      novelId: 7,
      orderedIds: [3, 1, 2],
    });
  });
});
