import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ModelConfig } from "@/domain/models/model-config";
import { keyringDelete, keyringExists } from "@/ipc/keyring";

export interface ModelConfigListProps {
  items: ModelConfig[];
  onEdit: (item: ModelConfig) => void;
  onDelete: (id: number) => void;
}

/** 模型配置列表（每项显示 Key 状态，可删除 Key） */
export function ModelConfigList({ items, onEdit, onDelete }: ModelConfigListProps) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <ModelConfigItem key={c.id} item={c} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function ModelConfigItem({
  item,
  onEdit,
  onDelete,
}: {
  item: ModelConfig;
  onEdit: (i: ModelConfig) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation("settings");
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    let alive = true;
    keyringExists(item.provider, item.label)
      .then((v) => {
        if (alive) setHasKey(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [item.provider, item.label]);

  async function removeKey() {
    await keyringDelete(item.provider, item.label);
    setHasKey(false);
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-3">
        <div className="text-sm">
          <div className="font-medium">
            {item.provider} / {item.label}
            {item.isDefault ? ` · ${t("isDefault")}` : ""}
          </div>
          <div className="text-muted-foreground">
            {item.baseUrl} · {item.modelName}
          </div>
          <div className="text-xs">{hasKey ? t("keyConfigured") : t("keyMissing")}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(item)}>
            {t("edit")}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(item.id)}>
            {t("delete")}
          </Button>
          {hasKey && (
            <Button variant="outline" size="sm" onClick={removeKey}>
              {t("deleteKey")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
