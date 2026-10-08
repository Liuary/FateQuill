import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("合并类名", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("处理 Tailwind 冲突", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
