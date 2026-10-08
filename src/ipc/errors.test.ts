import { describe, expect, it } from "vitest";
import { IpcError, IpcErrorCode, parseIpcError } from "@/ipc/errors";

describe("parseIpcError", () => {
  it("归一化 Rust 错误结构 {code,message,detail}", () => {
    const e = parseIpcError({ code: "NOT_FOUND", message: "novel not found", detail: { id: 1 } });
    expect(e).toBeInstanceOf(IpcError);
    expect(e.code).toBe(IpcErrorCode.NotFound);
    expect(e.message).toBe("novel not found");
    expect(e.detail).toEqual({ id: 1 });
  });

  it("非结构化 Error → INTERNAL", () => {
    const e = parseIpcError(new Error("boom"));
    expect(e.code).toBe(IpcErrorCode.Internal);
    expect(e.message).toBe("boom");
  });

  it("字符串错误 → INTERNAL", () => {
    const e = parseIpcError("oops");
    expect(e.code).toBe(IpcErrorCode.Internal);
    expect(e.message).toBe("oops");
  });
});
