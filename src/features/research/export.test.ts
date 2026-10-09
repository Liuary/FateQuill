import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/domain/models/material";
import { downloadExport, materialsToCsv, materialsToJson, toIsoDateTime } from "./export";

const material = (over: Partial<Material> = {}): Material => ({
  id: 1,
  sourceType: "multi_model_creation",
  sourceModel: "modelA",
  excerpt: "她不禁皱眉",
  position: { contextBefore: "前文", contextAfter: "后文" },
  reason: "套话",
  label: "套话",
  chapterId: 3,
  status: "confirmed",
  createdAt: "2026-10-10T00:00:00Z",
  ...over,
});

describe("materialsToJson", () => {
  it("输出 JSON 文本（含 position 上下文）", () => {
    const json = materialsToJson([material()]);
    expect(JSON.parse(json)).toEqual([material()]);
  });
});

describe("materialsToCsv", () => {
  it("表头 + 一行数据（字段顺序固定）", () => {
    const lines = materialsToCsv([material()]).split("\n");
    expect(lines[0]).toBe(
      "id,sourceType,sourceModel,excerpt,reason,label,chapterId,status,createdAt,contextBefore,contextAfter",
    );
    expect(lines[1]).toBe(
      "1,multi_model_creation,modelA,她不禁皱眉,套话,套话,3,confirmed,2026-10-10T00:00:00Z,前文,后文",
    );
  });

  it("createdAt 统一为 ISO 8601（REV-020②）", () => {
    // SQLite `datetime('now')`（UTC，无时区标记）→ ISO 8601
    const csv = materialsToCsv([material({ createdAt: "2026-10-10 03:00:00" })]);
    expect(csv.split("\n")[1]).toContain(",2026-10-10T03:00:00Z,");
  });

  it("含逗号/引号/换行的单元格加引号并转义", () => {
    const csv = materialsToCsv([material({ excerpt: "a,b", reason: '含"引号"', label: "换\n行" })]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"含""引号"""');
    expect(csv).toContain('"换\n行"');
  });

  it("chapterId 为 null 时空单元格", () => {
    const cells = materialsToCsv([material({ chapterId: null })])
      .split("\n")[1]
      .split(",");
    expect(cells[6]).toBe("");
  });
});

describe("toIsoDateTime（REV-020②）", () => {
  it("SQLite UTC 形态 → ISO 8601", () => {
    expect(toIsoDateTime("2026-10-10 03:00:00")).toBe("2026-10-10T03:00:00Z");
    expect(toIsoDateTime("2026-10-10T03:00:00")).toBe("2026-10-10T03:00:00Z");
  });

  it("已为 ISO 形态 → 原样（补 Z）", () => {
    expect(toIsoDateTime("2026-10-10T03:00:00Z")).toBe("2026-10-10T03:00:00Z");
  });

  it("其它可解析日期 → ISO；非法 → 原样返回", () => {
    expect(toIsoDateTime("2026-10-10")).toBe("2026-10-10T00:00:00.000Z");
    expect(toIsoDateTime("not a date")).toBe("not a date");
  });
});

describe("downloadExport", () => {
  beforeEach(() => {
    // jsdom 未实现 Blob URL API：桩函数
    URL.createObjectURL = vi.fn(() => "blob:x") as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
  });

  it("本地生成 Blob 并触发下载（不联网/不上传）", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadExport("materials.json", "[]", "application/json");

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    clickSpy.mockRestore();
  });
});
