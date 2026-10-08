import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createCharacterRepository } from "./character-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("character repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByNovel 过滤父 id 并将 profile JSON 解析为对象", async () => {
    invokeMock.mockResolvedValue([
      { id: 1, novel_id: 7, name: "林默", profile: '{"age":20}' },
      { id: 2, novel_id: 8, name: "他人", profile: "{}" },
    ]);
    const out = await createCharacterRepository().listByNovel(7);
    expect(invokeMock).toHaveBeenCalledWith("list_characters", undefined);
    expect(out).toEqual([{ id: 1, novelId: 7, name: "林默", profile: { age: 20 } }]);
  });

  it("create 将 profile 序列化为 JSON 字符串", async () => {
    invokeMock.mockResolvedValue({ id: 1, novel_id: 7, name: "林默", profile: '{"age":20}' });
    await createCharacterRepository().create({ novelId: 7, name: "林默", profile: { age: 20 } });
    expect(invokeMock).toHaveBeenCalledWith("create_character", {
      novelId: 7,
      name: "林默",
      profile: '{"age":20}',
    });
  });

  it("profile 非法 JSON 时回退空对象", async () => {
    invokeMock.mockResolvedValue({ id: 1, novel_id: 7, name: "林默", profile: "not-json" });
    const out = await createCharacterRepository().get(1);
    expect(out.profile).toEqual({});
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "VALIDATION", message: "name required" };
    });
    const err = await captureError(
      createCharacterRepository().create({ novelId: 7, name: "", profile: {} }),
    );
    expect(err).toBeInstanceOf(IpcError);
  });
});
