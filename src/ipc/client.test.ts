import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { invokeCommand } from "@/ipc/client";

/** 将 promise 的拒绝转为返回值，避免未处理拒绝 */
async function captureError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

describe("invokeCommand", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("透传命令名与参数并返回结果", async () => {
    invokeMock.mockResolvedValue("pong");
    const r = await invokeCommand<string>("ping", { novelId: 1 });
    expect(r).toBe("pong");
    expect(invokeMock).toHaveBeenCalledWith("ping", { novelId: 1 });
  });

  it("Rust 错误结构归一化为 IpcError 且 code 正确", async () => {
    invokeMock.mockRejectedValue({ code: "VALIDATION", message: "bad" });
    const err = await captureError(invokeCommand("create_novel"));
    expect(err).toBeInstanceOf(IpcError);
    expect((err as IpcError).code).toBe("VALIDATION");
  });

  it("未知错误 → INTERNAL", async () => {
    invokeMock.mockRejectedValue(new Error("boom"));
    const err = await captureError(invokeCommand("x"));
    expect(err).toBeInstanceOf(IpcError);
    expect((err as IpcError).code).toBe("INTERNAL");
  });
});
