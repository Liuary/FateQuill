import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { Chapter } from "@/domain/models/chapter";
import type { Volume } from "@/domain/models/volume";
import { OutlineTree } from "./OutlineTree";
import { computeDropAction } from "./useOutline";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

// 领域对象（camelCase）——供纯函数测试
const dvol = (id: number, orderIndex: number): Volume => ({
  id,
  novelId: 1,
  title: `卷${id}`,
  orderIndex,
});
const dch = (id: number, volumeId: number, orderIndex: number, title: string): Chapter => ({
  id,
  volumeId,
  title,
  content: "",
  contentFormat: "html",
  orderIndex,
  status: "draft",
  wordCount: 0,
  createdAt: "c",
  updatedAt: "u",
});

// 行对象（snake_case）——供 invoke mock
const vrow = (id: number, order_index: number) => ({
  id,
  novel_id: 1,
  title: `卷${id}`,
  order_index,
});
const crow = (id: number, volume_id: number, order_index: number, title: string) => ({
  id,
  volume_id,
  title,
  content: "",
  content_format: "html",
  order_index,
  status: "draft",
  word_count: 0,
  created_at: "c",
  updated_at: "u",
});

let chapterRows: unknown[];

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  chapterRows = [crow(11, 1, 0, "第一章"), crow(12, 1, 1, "第二章"), crow(21, 2, 0, "第三章")];
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_volumes") return Promise.resolve([vrow(1, 0), vrow(2, 1)]);
    if (cmd === "list_chapters") return Promise.resolve(chapterRows);
    if (cmd === "create_chapter") return Promise.resolve(crow(99, 1, 1, "新章"));
    if (cmd === "create_volume") return Promise.resolve(vrow(3, 2));
    return Promise.resolve(undefined);
  });
});

describe("computeDropAction", () => {
  const volumes = [dvol(1, 0), dvol(2, 1)];
  const map: Record<number, Chapter[]> = {
    1: [dch(11, 1, 0, "a"), dch(12, 1, 1, "b")],
    2: [dch(21, 2, 0, "c")],
  };

  it("同卷章排序 → reorder_chapters 新序", () => {
    expect(computeDropAction("c-11", "c-12", 1, volumes, map)).toEqual({
      kind: "reorder_chapters",
      volumeId: 1,
      orderedIds: [12, 11],
    });
  });

  it("卷排序 → reorder_volumes 新序", () => {
    expect(computeDropAction("v-1", "v-2", 1, volumes, map)).toEqual({
      kind: "reorder_volumes",
      novelId: 1,
      orderedIds: [2, 1],
    });
  });

  it("跨卷移动 → move_chapter", () => {
    expect(computeDropAction("c-11", "c-21", 1, volumes, map)).toEqual({
      kind: "move_chapter",
      chapterId: 11,
      toVolumeId: 2,
      toIndex: 0,
    });
  });

  it("无位移/跨类型 → null", () => {
    expect(computeDropAction("c-11", "c-11", 1, volumes, map)).toBeNull();
    expect(computeDropAction("v-1", "c-11", 1, volumes, map)).toBeNull();
  });
});

describe("OutlineTree", () => {
  it("按 orderIndex 渲染卷与章", async () => {
    render(<OutlineTree novelId={1} />);
    await waitFor(() => expect(screen.getByText("第一章")).toBeInTheDocument());
    expect(screen.getByText("卷1")).toBeInTheDocument();
    expect(screen.getByText("卷2")).toBeInTheDocument();
    expect(screen.getByText("第三章")).toBeInTheDocument();
  });

  it("点击「新增章」→ create_chapter 且 reload（再次 list_chapters）", async () => {
    render(<OutlineTree novelId={1} />);
    await waitFor(() => expect(screen.getByText("第一章")).toBeInTheDocument());

    const before = invokeMock.mock.calls.filter((c) => c[0] === "list_chapters").length;
    fireEvent.click(screen.getAllByText("新增章")[0]);

    await waitFor(() => {
      expect(invokeMock.mock.calls.some((c) => c[0] === "create_chapter")).toBe(true);
    });
    await waitFor(() => {
      const after = invokeMock.mock.calls.filter((c) => c[0] === "list_chapters").length;
      expect(after).toBeGreaterThan(before);
    });
  });

  it("点击「新增卷」→ create_volume", async () => {
    render(<OutlineTree novelId={1} />);
    await waitFor(() => expect(screen.getByText("第一章")).toBeInTheDocument());
    fireEvent.click(screen.getByText("新增卷"));
    await waitFor(() => {
      expect(invokeMock.mock.calls.some((c) => c[0] === "create_volume")).toBe(true);
    });
  });
});
