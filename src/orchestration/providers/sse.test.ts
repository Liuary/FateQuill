import { describe, expect, it } from "vitest";
import { parseSseBlock, parseSseStream } from "./sse";

describe("parseSseBlock", () => {
  it("解析 event 与 data", () => {
    expect(parseSseBlock("event: foo\ndata: bar")).toEqual({ event: "foo", data: "bar" });
  });

  it("多行 data 以 \\n 连接", () => {
    expect(parseSseBlock("data: a\ndata: b")).toEqual({ event: undefined, data: "a\nb" });
  });

  it("忽略注释行", () => {
    expect(parseSseBlock(": comment\ndata: x")).toEqual({ event: undefined, data: "x" });
  });

  it("空块/仅注释返回 null", () => {
    expect(parseSseBlock("")).toBeNull();
    expect(parseSseBlock(": only comment")).toBeNull();
  });

  it("data 后单个空格剥离", () => {
    expect(parseSseBlock("data: hello")).toEqual({ event: undefined, data: "hello" });
  });
});

describe("parseSseStream", () => {
  it("按空行切分多事件", () => {
    const out = parseSseStream("data: a\n\ndata: b\n\n");
    expect(out.map((e) => e.data)).toEqual(["a", "b"]);
  });
});
