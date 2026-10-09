/**
 * 素材导出（stage-07 T4）
 *
 * 职责：把素材列表导出为 **JSON / CSV** 文本，并提供浏览器下载封装（**默认仅本地**——无任何上传）。
 */

import type { Material } from "@/domain/models/material";

/** CSV 单元格转义（含 `,`/`"`/换行时加引号并转义内引号） */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 归一为 ISO 8601（REV-020②）：SQLite `datetime('now')` 的 UTC `YYYY-MM-DD HH:MM:SS` → `...Z`；非法原样返回 */
export function toIsoDateTime(value: string): string {
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?$/.test(text)) {
    return text.endsWith("Z") ? text : `${text}Z`; // 已是 ISO 形态
  }
  const sqlite = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(text);
  if (sqlite) {
    return `${sqlite[1]}T${sqlite[2]}Z`; // SQLite UTC → ISO 8601
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

/** 素材列表 → JSON 文本（2 空格缩进；纯函数） */
export function materialsToJson(materials: Material[]): string {
  return JSON.stringify(materials, null, 2);
}

/** 素材列表 → CSV 文本（含表头；纯函数） */
export function materialsToCsv(materials: Material[]): string {
  const header = [
    "id",
    "sourceType",
    "sourceModel",
    "excerpt",
    "reason",
    "label",
    "chapterId",
    "status",
    "createdAt",
    "contextBefore",
    "contextAfter",
  ];
  const rows = materials.map((material) =>
    [
      material.id,
      material.sourceType,
      material.sourceModel,
      material.excerpt,
      material.reason,
      material.label,
      material.chapterId,
      material.status,
      toIsoDateTime(material.createdAt), // REV-020②：统一 ISO 8601
      material.position.contextBefore ?? "",
      material.position.contextAfter ?? "",
    ].map(csvCell),
  );
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/** 触发浏览器下载（仅本地生成 Blob，不上传） */
export function downloadExport(name: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
