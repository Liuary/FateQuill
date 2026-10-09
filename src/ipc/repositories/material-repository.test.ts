import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createMaterialRepository } from "./material-repository";

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
  source_type: "multi_model_cross",
  source_model: "modelA",
  excerpt: "原句",
  position_json: '{"contextBefore":"前","contextAfter":"后"}',
  reason: "套话",
  label: "套话",
  chapter_id: null,
  status: "confirmed",
  created_at: "c",
};

describe("material repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("list 映射 snake_case → camelCase 并解析 position_json", async () => {
    invokeMock.mockResolvedValue([row]);
    const out = await createMaterialRepository().list({ status: "confirmed" });

    expect(invokeMock).toHaveBeenCalledWith("list_materials", {
      status: "confirmed",
      sourceType: undefined,
      query: undefined,
    });
    expect(out).toEqual([
      {
        id: 4,
        sourceType: "multi_model_cross",
        sourceModel: "modelA",
        excerpt: "原句",
        position: { contextBefore: "前", contextAfter: "后" },
        reason: "套话",
        label: "套话",
        chapterId: null,
        status: "confirmed",
        createdAt: "c",
      },
    ]);
  });

  it("save 将 position 序列化为 positionJson 并透传参数", async () => {
    invokeMock.mockResolvedValue(row);
    await createMaterialRepository().save({
      sourceType: "user_manual",
      sourceModel: "",
      excerpt: "原句",
      position: { contextBefore: "前" },
      reason: "r",
      label: "l",
      chapterId: 3,
    });

    expect(invokeMock).toHaveBeenCalledWith("save_material", {
      sourceType: "user_manual",
      sourceModel: "",
      excerpt: "原句",
      positionJson: '{"contextBefore":"前"}',
      reason: "r",
      label: "l",
      chapterId: 3,
      status: undefined,
    });
  });

  it("position_json 非法 → 归一为空上下文（不阻断）", async () => {
    invokeMock.mockResolvedValue([{ ...row, position_json: "not json" }]);
    const out = await createMaterialRepository().list();
    expect(out[0].position).toEqual({});
  });

  it("remove 错误路径归一为 IpcError（如被 skill 引用拒绝）", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "FK_VIOLATION", message: "material is referenced by skill_entry" };
    });
    const err = await captureError(createMaterialRepository().remove(1));
    expect(err).toBeInstanceOf(IpcError);
  });
});
