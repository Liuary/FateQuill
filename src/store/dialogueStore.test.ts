import { beforeEach, describe, expect, it } from "vitest";
import { useDialogueStore } from "./dialogueStore";

const orders = () => useDialogueStore.getState().entries.map((entry) => entry.orderIndex);
const contents = () => useDialogueStore.getState().entries.map((entry) => entry.content);
const add = (content: string, kind: "dialogue" | "narration" = "narration") =>
  useDialogueStore.getState().addEntry({ kind, content });

beforeEach(() => {
  useDialogueStore.setState({ entries: [], running: false });
});

describe("dialogueStore（会话内存 · orderIndex 恒连续 0..n-1）", () => {
  it("addEntry 追加并自动分配 orderIndex", () => {
    add("一");
    add("二");
    add("三");
    expect(orders()).toEqual([0, 1, 2]);
    expect(contents()).toEqual(["一", "二", "三"]);
  });

  it("insertAt 插入后重排连续", () => {
    add("一");
    add("三");
    useDialogueStore.getState().insertAt(1, { kind: "narration", content: "二" });
    expect(contents()).toEqual(["一", "二", "三"]);
    expect(orders()).toEqual([0, 1, 2]);
  });

  it("insertAt 越界索引 clamp 到两端", () => {
    add("一");
    useDialogueStore.getState().insertAt(99, { kind: "narration", content: "尾" });
    useDialogueStore.getState().insertAt(-5, { kind: "narration", content: "首" });
    expect(contents()).toEqual(["首", "一", "尾"]);
    expect(orders()).toEqual([0, 1, 2]);
  });

  it("removeEntry 删除后重排连续", () => {
    add("一");
    add("二");
    add("三");
    const id = useDialogueStore.getState().entries[1].id;
    useDialogueStore.getState().removeEntry(id);
    expect(contents()).toEqual(["一", "三"]);
    expect(orders()).toEqual([0, 1]);
  });

  it("moveEntry 相邻交换并重排；越界原样", () => {
    add("一");
    add("二");
    add("三");
    const last = useDialogueStore.getState().entries[2].id;
    useDialogueStore.getState().moveEntry(last, -1);
    expect(contents()).toEqual(["一", "三", "二"]);
    expect(orders()).toEqual([0, 1, 2]);

    const first = useDialogueStore.getState().entries[0].id;
    useDialogueStore.getState().moveEntry(first, -1); // 越界上移
    expect(contents()).toEqual(["一", "三", "二"]);
    expect(orders()).toEqual([0, 1, 2]);
  });

  it("updateEntry 行内编辑（内容 / 说话人）", () => {
    const created = add("原文", "dialogue");
    useDialogueStore.getState().updateEntry(created.id, { content: "改后", speakerName: "林砚" });
    const entry = useDialogueStore.getState().entries[0];
    expect(entry.content).toBe("改后");
    expect(entry.speakerName).toBe("林砚");
  });

  it("dialogue 条目携带说话人信息", () => {
    const created = useDialogueStore
      .getState()
      .addEntry({ kind: "dialogue", speakerId: 1, speakerName: "林砚", content: "你确定要走？" });
    expect(created.kind).toBe("dialogue");
    expect(created.speakerId).toBe(1);
    expect(useDialogueStore.getState().entries[0].speakerName).toBe("林砚");
    expect(useDialogueStore.getState().entries[0].orderIndex).toBe(0);
  });

  it("setRunning / clear", () => {
    add("一");
    useDialogueStore.getState().setRunning(true);
    expect(useDialogueStore.getState().running).toBe(true);

    useDialogueStore.getState().clear();
    expect(useDialogueStore.getState().entries).toEqual([]);
    expect(useDialogueStore.getState().running).toBe(false);
  });
});
