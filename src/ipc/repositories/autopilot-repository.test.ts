import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createAutopilotRepository } from "./autopilot-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const runRow = {
  id: 7,
  novel_id: 1,
  status: "running",
  config_json: '{"config":{},"outline":[]}',
  created_at: "c",
  updated_at: "u",
};

const chapterRow = {
  id: 3,
  run_id: 7,
  chapter_id: null,
  order_index: 1,
  state: "degraded",
  score: 41.5,
  degraded_reason: "重写 2 轮未过阈",
  attempt: 2,
  updated_at: "u",
};

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;

describe("autopilot repository（断点 CRUD 映射与透传）", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("saveRun：`id` 缺省 → 不带该参数（新建）；行映射 snake → camel", async () => {
    invokeMock.mockResolvedValue(runRow);
    const repo = createAutopilotRepository();
    const run = await repo.saveRun({ novelId: 1, status: "running", configJson: '{"a":1}' });
    expect(argsOf("save_autopilot_run")).toEqual({
      novelId: 1,
      status: "running",
      configJson: '{"a":1}',
    });
    expect(run).toEqual({
      id: 7,
      novelId: 1,
      status: "running",
      configJson: '{"config":{},"outline":[]}',
      createdAt: "c",
      updatedAt: "u",
    });

    invokeMock.mockClear();
    invokeMock.mockResolvedValue(runRow);
    await repo.saveRun({ id: 7, novelId: 1, status: "paused", configJson: "{}" });
    expect(argsOf("save_autopilot_run")?.id).toBe(7);
  });

  it("getRun / listRuns：命令与参数正确", async () => {
    invokeMock.mockResolvedValue(runRow);
    await createAutopilotRepository().getRun(7);
    expect(invokeMock).toHaveBeenCalledWith("get_autopilot_run", { id: 7 });

    invokeMock.mockReset();
    invokeMock.mockResolvedValue([runRow]);
    const runs = await createAutopilotRepository().listRuns(1);
    expect(invokeMock).toHaveBeenCalledWith("list_autopilot_runs", { novelId: 1 });
    expect(runs).toHaveLength(1);
  });

  it("saveChapter：缺省补空值（`chapterId`/`score`/`degradedReason`/`attempt`）+ 行映射", async () => {
    invokeMock.mockResolvedValue(chapterRow);
    const chapter = await createAutopilotRepository().saveChapter({
      runId: 7,
      orderIndex: 1,
      state: "degraded",
      score: 41.5,
      degradedReason: "重写 2 轮未过阈",
      attempt: 2,
    });
    expect(argsOf("save_autopilot_chapter")).toEqual({
      runId: 7,
      chapterId: null,
      orderIndex: 1,
      state: "degraded",
      score: 41.5,
      degradedReason: "重写 2 轮未过阈",
      attempt: 2,
    });
    expect(chapter).toEqual({
      id: 3,
      runId: 7,
      chapterId: null,
      orderIndex: 1,
      state: "degraded",
      score: 41.5,
      degradedReason: "重写 2 轮未过阈",
      attempt: 2,
      updatedAt: "u",
    });
  });

  it("listChapters：按 run 查询（续跑依据）", async () => {
    invokeMock.mockResolvedValue([chapterRow]);
    const chapters = await createAutopilotRepository().listChapters(7);
    expect(invokeMock).toHaveBeenCalledWith("list_autopilot_chapters", { runId: 7 });
    expect(chapters[0].degradedReason).toBe("重写 2 轮未过阈");
  });

  it("错误路径归一化为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "NOT_FOUND", message: "autopilot_run not found" };
    });
    const err = await captureError(createAutopilotRepository().getRun(99));
    expect(err).toBeInstanceOf(IpcError);
  });
});
