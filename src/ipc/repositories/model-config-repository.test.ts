import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createModelConfigRepository } from "./model-config-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const row = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  base_url: "https://api.example.com",
  model_name: "gpt-x",
  temperature: 0.7,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};

describe("model-config repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("list 映射 snake_case→camelCase 且 is_default→boolean", async () => {
    invokeMock.mockResolvedValue([row]);
    const out = await createModelConfigRepository().list();
    expect(invokeMock).toHaveBeenCalledWith("list_model_configs", undefined);
    expect(out[0]).toEqual({
      id: 1,
      provider: "openai-compatible",
      label: "default",
      baseUrl: "https://api.example.com",
      modelName: "gpt-x",
      temperature: 0.7,
      isDefault: true,
      createdAt: "c",
      updatedAt: "u",
    });
  });

  it("create 透传 camelCase 参数", async () => {
    invokeMock.mockResolvedValue(row);
    await createModelConfigRepository().create({
      provider: "openai-compatible",
      label: "default",
      baseUrl: "https://api.example.com",
      modelName: "gpt-x",
      temperature: 0.7,
      isDefault: true,
    });
    expect(invokeMock).toHaveBeenCalledWith("create_model_config", {
      provider: "openai-compatible",
      label: "default",
      baseUrl: "https://api.example.com",
      modelName: "gpt-x",
      temperature: 0.7,
      isDefault: true,
    });
  });

  it("remove 调用 delete_model_config", async () => {
    invokeMock.mockResolvedValue(undefined);
    await createModelConfigRepository().remove(1);
    expect(invokeMock).toHaveBeenCalledWith("delete_model_config", { id: 1 });
  });

  it("错误归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "model_config not found" };
    });
    const err = await captureError(createModelConfigRepository().get(9));
    expect(err).toBeInstanceOf(IpcError);
    expect((err as IpcError).code).toBe("NOT_FOUND");
  });
});
