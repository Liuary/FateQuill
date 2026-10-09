import { beforeEach, describe, expect, it } from "vitest";
import { IpcError } from "@/ipc/errors";
import { useGenerationStore } from "./generationStore";

beforeEach(() => {
  useGenerationStore.getState().reset();
});

describe("generationStore 边界与迁移", () => {
  it("state 不含文档正文字段（不持正文）", () => {
    const keys = Object.keys(useGenerationStore.getState());
    expect(keys).not.toContain("content");
    expect(keys).not.toContain("html");
    expect(keys).not.toContain("delta");
  });

  it("begin → advance → finish 迁移正确", () => {
    const s = useGenerationStore.getState();
    s.begin(7, "r1");
    const begun = useGenerationStore.getState();
    expect(begun.status).toBe("streaming");
    expect(begun.chapterId).toBe(7);
    expect(begun.requestId).toBe("r1");
    s.advance(42);
    expect(useGenerationStore.getState().progress.chars).toBe(42);
    s.finish();
    expect(useGenerationStore.getState().status).toBe("done");
  });

  it("fail → 收敛 idle + requestId=null + error 展示", () => {
    const s = useGenerationStore.getState();
    s.begin(7, "r1");
    s.fail(new IpcError({ code: "INTERNAL", message: "boom" }));
    const st = useGenerationStore.getState();
    expect(st.status).toBe("idle");
    expect(st.requestId).toBeNull();
    expect(st.error?.message).toBe("boom");
  });

  it("reset → idle + requestId=null + error=null", () => {
    const s = useGenerationStore.getState();
    s.begin(7, "r1");
    s.reset();
    const st = useGenerationStore.getState();
    expect(st.status).toBe("idle");
    expect(st.requestId).toBeNull();
    expect(st.error).toBeNull();
  });
});
