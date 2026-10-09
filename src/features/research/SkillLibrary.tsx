/**
 * skill 管理区（stage-07 T5）
 *
 * 职责：列出规避经验条目（版本 / 标题 / 规则 / 来源素材数）+ **归纳表单**
 * （选 `confirmed` 素材 + 填 `version`/`title`/`rule`/`examples`）+ 编辑 / 删除。
 * 归纳**需人工参与**（不做自动归纳）。
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SkillEntry } from "@/domain/models/skill-entry";
import { parseExamples, useSkillLibrary } from "./useSkillLibrary";

/** 归纳表单初值 */
const EMPTY_FORM = { version: "1.0.0", title: "", rule: "", examples: "" };

/** skill 库管理区 */
export function SkillLibrary() {
  const { t } = useTranslation("research");
  const { entries, materials, state, actionError, save, update, remove } = useSkillLibrary();

  const [form, setForm] = useState(EMPTY_FORM);
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const toggleSource = (id: number) => {
    setSourceIds((ids) =>
      ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id],
    );
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSourceIds([]);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    const payload = {
      version: form.version,
      title: form.title,
      rule: form.rule,
      examples: parseExamples(form.examples),
      sourceMaterialIds: sourceIds,
    };
    const ok = editingId === null ? await save(payload) : await update(editingId, payload);
    if (ok) {
      resetForm();
    }
  };

  const handleEdit = (entry: SkillEntry) => {
    setEditingId(entry.id);
    setSourceIds(entry.sourceMaterialIds);
    setForm({
      version: entry.version,
      title: entry.title,
      rule: entry.rule,
      examples: entry.examples.map((example) => `${example.bad} => ${example.good}`).join("\n"),
    });
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-medium">{t("skills.title")}</h3>

      {state === "loading" ? (
        <p className="text-xs opacity-70">{t("loading")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.length === 0 ? (
            <li className="text-xs opacity-70">{t("skills.empty")}</li>
          ) : (
            entries.map((entry) => (
              <li
                key={entry.id}
                data-testid="skill-entry"
                className="border-border/40 flex flex-col gap-1 rounded border p-1"
              >
                <span>
                  v{entry.version} ｜ {entry.title}
                  <span className="text-xs opacity-70">
                    {" "}
                    （{t("skills.sourceMaterials")}: {entry.sourceMaterialIds.length}）
                  </span>
                </span>
                <span className="text-xs opacity-70">{entry.rule}</span>
                <span className="flex gap-2">
                  <Button variant="outline" onClick={() => handleEdit(entry)}>
                    {t("skills.edit")}
                  </Button>
                  <Button variant="outline" onClick={() => void remove(entry.id)}>
                    {t("skills.delete")}
                  </Button>
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      <h4 className="text-xs opacity-70">{t("skills.induct")}</h4>

      <label className="flex items-center gap-2">
        {t("skills.version")}
        <Input
          className="w-24"
          value={form.version}
          onChange={(event) => setForm({ ...form, version: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        {t("skills.name")}
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        {t("skills.rule")}
        <Input
          value={form.rule}
          onChange={(event) => setForm({ ...form, rule: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1">
        {t("skills.examples")}
        <textarea
          className="border-input min-h-12 rounded border p-1"
          placeholder={t("skills.examplesHint")}
          value={form.examples}
          onChange={(event) => setForm({ ...form, examples: event.target.value })}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs opacity-70">{t("skills.sourceMaterials")}</span>
        {materials.length === 0 ? (
          <span className="text-xs opacity-70">{t("skills.noMaterials")}</span>
        ) : (
          materials.map((material) => (
            <label key={material.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sourceIds.includes(material.id)}
                onChange={() => toggleSource(material.id)}
              />
              <span className="opacity-70">{material.excerpt.slice(0, 20)}</span>
            </label>
          ))
        )}
      </div>

      {actionError && <p className="text-destructive text-xs">{t("skills.saveFailed")}</p>}

      <div className="flex gap-2">
        <Button
          disabled={form.title.trim().length === 0 || form.rule.trim().length === 0}
          onClick={() => void handleSubmit()}
        >
          {editingId === null ? t("skills.induct") : t("skills.update")}
        </Button>
        {editingId !== null && (
          <Button variant="outline" onClick={resetForm}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </section>
  );
}
