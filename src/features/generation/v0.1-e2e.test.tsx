import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import i18n from "@/app/i18n";
import type { Chunk } from "@/orchestration/types";
import { repositories } from "@/ipc/repositories";
import { useGenerationStore } from "@/store/generationStore";
import { WorkspaceLayout } from "@/features/editor/WorkspaceLayout";

const { invokeMock, streamHolder } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  streamHolder: { fn: null as null | ((signal?: AbortSignal) => AsyncIterable<Chunk>) },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@/orchestration/providers/openai-compatible", () => ({
  createOpenAiCompatibleProvider: () => ({
    id: "openai-compatible",
    stream: (options: { signal?: AbortSignal }) => streamHolder.fn!(options.signal),
  }),
}));

const novelRow = { id: 1, title: "书一", synopsis: "", created_at: "c", updated_at: "u" };
const volRow = { id: 1, novel_id: 1, title: "卷一", order_index: 0 };
const chRow = {
  id: 1,
  volume_id: 1,
  title: "第一章",
  content: "<p>正文</p>",
  content_format: "html",
  order_index: 0,
  status: "draft",
  created_at: "c",
  updated_at: "u",
};
const cfgRow = {
  id: 1,
  provider: "openai-compatible",
  label: "default",
  base_url: "https://api.example.com",
  model_name: "m",
  temperature: 0.7,
  is_default: 1,
  created_at: "c",
  updated_at: "u",
};

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  useGenerationStore.getState().reset();
  streamHolder.fn = () =>
    (async function* () {
      for (let i = 0; i < 6; i += 1) yield { delta: "生成文" };
    })();
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "list_novels":
        return Promise.resolve([novelRow]);
      case "create_novel":
        return Promise.resolve(novelRow);
      case "list_volumes":
        return Promise.resolve([volRow]);
      case "create_volume":
        return Promise.resolve(volRow);
      case "list_chapters":
        return Promise.resolve([chRow]);
      case "create_chapter":
        return Promise.resolve(chRow);
      case "get_chapter":
        return Promise.resolve(chRow);
      case "update_chapter":
        return Promise.resolve(chRow);
      case "list_model_configs":
        return Promise.resolve([cfgRow]);
      case "keyring_exists":
        return Promise.resolve(true);
      case "list_setting_cards":
        return Promise.resolve([]);
      case "create_setting_card":
        return Promise.resolve({
          id: 1,
          novel_id: 1,
          title: "设定A",
          content: "",
          kind: "general",
          created_at: "c",
        });
      default:
        return Promise.resolve(undefined);
    }
  });
});

describe("v0.1 全链路 E2E（mock）", () => {
  it("建书/卷章 → 载入编辑器 → 生成直插 → 保存设定卡", async () => {
    // ① 数据层：经仓储建书/卷/章（→ IPC 命令）
    await repositories.novel.create({ title: "书一", synopsis: "" });
    await repositories.volume.create({ novelId: 1, title: "卷一", orderIndex: 0 });
    await repositories.chapter.create({
      volumeId: 1,
      title: "第一章",
      content: "",
      contentFormat: "html",
      orderIndex: 0,
    });
    expect(invokeMock.mock.calls.some((c) => c[0] === "create_novel")).toBe(true);
    expect(invokeMock.mock.calls.some((c) => c[0] === "create_volume")).toBe(true);
    expect(invokeMock.mock.calls.some((c) => c[0] === "create_chapter")).toBe(true);

    // ② UI：渲染工作区 → 选中第 1 章 → 编辑器就绪
    let editor: Editor | null = null;
    render(
      <WorkspaceLayout
        onEditorReady={(e) => {
          editor = e;
        }}
      />,
    );
    await waitFor(() => expect(screen.getByText("第一章")).toBeInTheDocument());
    fireEvent.click(screen.getByText("第一章"));
    await waitFor(() => expect(document.body.textContent).toContain("正文"));
    await waitFor(() => expect(editor).toBeTruthy());

    // ③ 生成（模式 A 直插）：面板输入指令 → 开始生成；代理指标断言
    const dispatchSpy = vi.spyOn(editor!.view, "dispatch");
    const setContentSpy = vi.spyOn(editor!.commands, "setContent");
    fireEvent.change(screen.getByLabelText("本章要求"), { target: { value: "续写一段" } });
    fireEvent.click(screen.getByText("开始生成"));

    await waitFor(() => expect(editor!.getText()).toContain("生成文"));
    expect(dispatchSpy.mock.calls.length).toBeLessThanOrEqual(6 / 2); // 直插节流（代理指标）
    expect(setContentSpy).not.toHaveBeenCalled(); // 无整文档重设

    // ④ 保存设定卡（切 tab → 新增 → 保存）
    fireEvent.click(screen.getByText("设定卡"));
    await waitFor(() => expect(screen.getByText("新增设定卡")).toBeInTheDocument());
    fireEvent.click(screen.getByText("新增设定卡"));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "设定A" } });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "create_setting_card")).toBe(true),
    );
  });
});
