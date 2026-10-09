/**
 * 素材库面板（stage-07 BUG-001 修复）
 *
 * 职责：**浏览 + 检索（status / source_type / 关键字）+ 导出（JSON/CSV）+ 删除**
 * ——使 T4 交付的素材库在 UI 层可达（DoD「可检索、可导出」；默认仅本地，无上传）。
 */

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialSourceType, MaterialStatus } from "@/domain/models/material";
import { downloadExport, materialsToCsv, materialsToJson } from "./export";
import { useMaterialLibrary } from "./useMaterialLibrary";

const STATUS_OPTIONS: MaterialStatus[] = ["candidate", "confirmed"];
const SOURCE_TYPE_OPTIONS: MaterialSourceType[] = [
  "multi_model_creation",
  "multi_model_cross",
  "user_manual",
];

/** 素材库面板 */
export function MaterialLibrary() {
  const { t } = useTranslation("research");
  const { materials, state, actionError, filter, setFilter, reload, remove } = useMaterialLibrary();

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t("materialLibrary")}</h3>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1">
          {t("materialFilterStatus")}
          <select
            className="border-input rounded border p-1"
            value={filter.status ?? ""}
            onChange={(event) =>
              setFilter({
                ...filter,
                status: (event.target.value || undefined) as MaterialStatus | undefined,
              })
            }
          >
            <option value="">{t("materialFilterAll")}</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          {t("materialFilterSourceType")}
          <select
            className="border-input rounded border p-1"
            value={filter.sourceType ?? ""}
            onChange={(event) =>
              setFilter({
                ...filter,
                sourceType: (event.target.value || undefined) as MaterialSourceType | undefined,
              })
            }
          >
            <option value="">{t("materialFilterAll")}</option>
            {SOURCE_TYPE_OPTIONS.map((sourceType) => (
              <option key={sourceType} value={sourceType}>
                {sourceType}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1">
          {t("materialFilterKeyword")}
          <Input
            className="w-32"
            value={filter.query ?? ""}
            onChange={(event) => setFilter({ ...filter, query: event.target.value || undefined })}
          />
        </label>

        <Button variant="outline" onClick={() => void reload()}>
          {t("refresh")}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            downloadExport("materials.json", materialsToJson(materials), "application/json")
          }
        >
          {t("exportJson")}
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadExport("materials.csv", materialsToCsv(materials), "text/csv")}
        >
          {t("exportCsv")}
        </Button>
      </div>

      {actionError === "delete-referenced" && (
        <p className="text-destructive text-xs">{t("deleteReferenced")}</p>
      )}
      {actionError === "delete-failed" && (
        <p className="text-destructive text-xs">{t("deleteFailed")}</p>
      )}

      {state === "loading" ? (
        <p className="text-xs opacity-70">{t("loading")}</p>
      ) : materials.length === 0 ? (
        <p className="text-xs opacity-70">{t("materialEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {materials.map((material) => (
            <li
              key={material.id}
              data-testid="material-row"
              className="border-border/40 flex flex-col gap-1 rounded border p-1"
            >
              <span className="text-xs opacity-70">
                {material.sourceModel} ｜ {material.sourceType} ｜ {material.status}
              </span>
              <span>{material.excerpt}</span>
              <span className="text-xs opacity-70">
                {material.reason} ｜ {material.label}
              </span>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => void remove(material.id)}
              >
                {t("delete")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
