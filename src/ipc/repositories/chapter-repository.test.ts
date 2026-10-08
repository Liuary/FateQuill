import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createChapterRepository } from "./chapter-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const row = {
  id: 5,
  volume_id: 3,
  title: "Ch1",
  content: "<p>hi</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  word_count: 0,
  created_at: "c",
  updated_at: "u",
};

describe("chapter repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByVolume 按父 id 过滤并完整映射多字段", async () => {
    invokeMock.mockResolvedValue([row, { ...row, id: 6, volume_id: 99 }]);
    const out = await createChapterRepository().listByVolume(3);
    expect(invokeMock).toHaveBeenCalledWith("list_chapters", undefined);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      id: 5,
      volumeId: 3,
      title: "Ch1",
      content: "<p>hi</p>",
      contentFormat: "html",
      orderIndex: 0,
      status: "draft",
      wordCount: 0,
      createdAt: "c",
      updatedAt: "u",
    });
  });

  it("create（默认 draft）仅调用 create_chapter", async () => {
    invokeMock.mockResolvedValue(row);
    await createChapterRepository().create({
      volumeId: 3,
      title: "Ch1",
      content: "<p>hi</p>",
      contentFormat: "html",
      orderIndex: 0,
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("create_chapter", {
      volumeId: 3,
      title: "Ch1",
      content: "<p>hi</p>",
      contentFormat: "html",
      orderIndex: 0,
    });
  });

  it("update 透传全部字段", async () => {
    invokeMock.mockResolvedValue({ ...row, status: "archived" });
    await createChapterRepository().update(5, {
      title: "Ch1b",
      content: "text",
      contentFormat: "plaintext",
      status: "archived",
      orderIndex: 1,
    });
    expect(invokeMock).toHaveBeenCalledWith("update_chapter", {
      id: 5,
      title: "Ch1b",
      content: "text",
      contentFormat: "plaintext",
      status: "archived",
      orderIndex: 1,
    });
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "VALIDATION", message: "bad" };
    });
    const err = await captureError(createChapterRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
  });
});
