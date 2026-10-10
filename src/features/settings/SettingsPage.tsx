import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelConfigCreateInput } from "@/domain/repositories/model-config-repository";
import { createModelConfigRepository } from "@/ipc/repositories/model-config-repository";
import { ModelConfigForm } from "./ModelConfigForm";
import { ModelConfigList } from "./ModelConfigList";

const repo = createModelConfigRepository();

/** 设置页：模型配置 CRUD + Key 状态（Key 仅写密钥链，不回显） */
export function SettingsPage() {
  const { t } = useTranslation("settings");
  const [items, setItems] = useState<ModelConfig[]>([]);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setItems(await repo.list());
  }

  useEffect(() => {
    let alive = true;
    repo.list().then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleCreate(input: ModelConfigCreateInput) {
    await repo.create(input);
    setShowForm(false);
    await reload();
  }

  async function handleUpdate(id: number, input: ModelConfigCreateInput) {
    await repo.update(id, input);
    setEditing(null);
    await reload();
  }

  async function handleDelete(id: number) {
    await repo.remove(id);
    await reload();
  }

  return (
    // 可读容器：居中 + 统一内边距（与顶部 header 观感一致）
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      {/* 标题与「新增模型配置」按钮**同一行**（左标题、右按钮） */}
      <div data-testid="settings-header" className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t("title")}</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          {t("add")}
        </Button>
      </div>
      {showForm && <ModelConfigForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />}
      {editing && (
        <ModelConfigForm
          initial={editing}
          onSubmit={(input) => handleUpdate(editing.id, input)}
          onCancel={() => setEditing(null)}
        />
      )}
      <ModelConfigList
        items={items}
        onEdit={(c) => {
          setShowForm(false);
          setEditing(c);
        }}
        onDelete={handleDelete}
      />
    </section>
  );
}
