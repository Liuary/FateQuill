import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelConfigCreateInput } from "@/domain/repositories/model-config-repository";
import { keyringSet } from "@/ipc/keyring";

const PROVIDERS = ["openai-compatible", "anthropic"];

export interface ModelConfigFormProps {
  initial?: ModelConfig;
  onSubmit: (input: ModelConfigCreateInput) => Promise<void>;
  onCancel?: () => void;
}

/** 模型配置新增/编辑表单（Key 经 keyringSet 写入，不回显） */
export function ModelConfigForm({ initial, onSubmit, onCancel }: ModelConfigFormProps) {
  const { t } = useTranslation("settings");
  const [provider, setProvider] = useState(initial?.provider ?? PROVIDERS[0]);
  const [label, setLabel] = useState(initial?.label ?? "default");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [temperature, setTemperature] = useState(String(initial?.temperature ?? 0.7));
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await onSubmit({
        provider,
        label,
        baseUrl,
        modelName,
        temperature: Number(temperature),
        isDefault,
      });
      if (apiKey) {
        await keyringSet(provider, label, apiKey);
        setApiKey("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial ? t("edit") : t("add")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("provider")}
          <select
            className="border-input h-8 rounded-lg border bg-transparent px-2.5"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("label")}
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("baseUrl")}
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("modelName")}
          <Input value={modelName} onChange={(e) => setModelName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("temperature")}
          <Input value={temperature} onChange={(e) => setTemperature(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          {t("isDefault")}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("apiKey")}
          <Input
            type="password"
            value={apiKey}
            placeholder={t("apiKeyHint")}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button disabled={busy} onClick={handleSave}>
            {t("save")}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {t("cancel")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
