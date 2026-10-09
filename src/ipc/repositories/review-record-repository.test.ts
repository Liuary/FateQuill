import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcError } from "@/ipc/errors";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import { createReviewRecordRepository } from "./review-record-repository";

async function captureError(p: Promise<unknown>): Promise<unknown> {
  return p.then(
    () => {
      throw new Error("expected rejection");
    },
    (e) => e,
  );
}

const row = {
  id: 9,
  chapter_id: 3,
  round: 2,
  dimension: "plot",
  score: 78,
  reasons_json: '["冲突推进乏力","伏笔未呼应"]',
  created_at: "c",
};

describe("review-record repository", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("listByChapter 映射 snake_case → camelCase 并反序列化 reasons", async () => {
    invokeMock.mockResolvedValue([row, { ...row, id: 10, round: 1 }]);
    const out = await createReviewRecordRepository().listByChapter(3);
    expect(invokeMock).toHaveBeenCalledWith("list_review_records", { chapterId: 3 });
    expect(out).toEqual([
      {
        id: 9,
        chapterId: 3,
        round: 2,
        dimension: "plot",
        score: 78,
        reasons: ["冲突推进乏力", "伏笔未呼应"],
        createdAt: "c",
      },
      {
        id: 10,
        chapterId: 3,
        round: 1,
        dimension: "plot",
        score: 78,
        reasons: ["冲突推进乏力", "伏笔未呼应"],
        createdAt: "c",
      },
    ]);
  });

  it("save 发送 camelCase 参数并映射返回", async () => {
    invokeMock.mockResolvedValue(row);
    const out = await createReviewRecordRepository().save({
      chapterId: 3,
      round: 2,
      dimension: "plot",
      score: 78,
      reasons: ["甲"],
    });
    expect(invokeMock).toHaveBeenCalledWith("save_review_record", {
      chapterId: 3,
      round: 2,
      dimension: "plot",
      score: 78,
      reasons: ["甲"],
    });
    expect(out.reasons).toEqual(["冲突推进乏力", "伏笔未呼应"]);
  });

  it("reasons_json 非法 → 归一为空数组（不阻断）", async () => {
    invokeMock.mockResolvedValue([{ ...row, reasons_json: "not json" }]);
    const out = await createReviewRecordRepository().listByChapter(3);
    expect(out[0].reasons).toEqual([]);
  });

  it("错误路径归一为 IpcError", async () => {
    invokeMock.mockImplementation(() => {
      throw { code: "VALIDATION", message: "invalid dimension" };
    });
    const err = await captureError(
      createReviewRecordRepository().save({
        chapterId: 3,
        round: 1,
        dimension: "unknown",
        score: 1,
        reasons: [],
      }),
    );
    expect(err).toBeInstanceOf(IpcError);
  });
});
