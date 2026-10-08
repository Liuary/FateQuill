import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createNovelRepository } from "./novel-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("novel repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("list 映射 snake_case→camelCase", async () => {
    invokeMock.mockResolvedValue([
      { id: 1, title: "t", synopsis: "s", created_at: "c", updated_at: "u" },
    ]);
    const out = await createNovelRepository().list();
    expect(invokeMock).toHaveBeenCalledWith("list_novels", undefined);
    expect(out[0]).toEqual({ id: 1, title: "t", synopsis: "s", createdAt: "c", updatedAt: "u" });
  });

  it("create 透传 camelCase 参数", async () => {
    invokeMock.mockResolvedValue({
      id: 2,
      title: "x",
      synopsis: "",
      created_at: "c",
      updated_at: "u",
    });
    await createNovelRepository().create({ title: "x", synopsis: "" });
    expect(invokeMock).toHaveBeenCalledWith("create_novel", { title: "x", synopsis: "" });
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "novel not found" };
    });
    const err = await captureError(createNovelRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
    expect((err as IpcError).code).toBe("NOT_FOUND");
  });
});
