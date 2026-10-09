import { describe, expect, it } from "vitest";
import { Registry, createRegistries } from "./registry";
import type { ModelProvider } from "./types";

const fake = (id: string): ModelProvider => ({ id, async *stream() {} });

describe("Registry", () => {
  it("register/resolve/list", () => {
    const r = new Registry<ModelProvider>();
    r.register(fake("a"));
    expect(r.resolve("a").id).toBe("a");
    expect(r.list()).toHaveLength(1);
  });

  it("重复注册抛错", () => {
    const r = new Registry<ModelProvider>();
    r.register(fake("a"));
    expect(() => r.register(fake("a"))).toThrow(/duplicate/);
  });

  it("未注册 resolve 抛错", () => {
    const r = new Registry<ModelProvider>();
    expect(() => r.resolve("x")).toThrow(/not registered/);
  });

  it("replace 覆盖", () => {
    const r = new Registry<ModelProvider>();
    r.register(fake("a"));
    r.replace({ ...fake("a"), id: "a" });
    expect(r.has("a")).toBe(true);
  });

  it("createRegistries 三注册表齐备", () => {
    const reg = createRegistries();
    expect(reg.providers && reg.agents && reg.pipelines).toBeTruthy();
  });
});
