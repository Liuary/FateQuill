import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ModelConfig } from "@/domain/models/model-config";
import {
  CUSTOM_PRESET_ID,
  PROVIDER_PRESETS,
  findPreset,
  presetIdForProvider,
} from "@/domain/models/provider-presets";
import type { ModelConfigCreateInput } from "@/domain/repositories/model-config-repository";
import { keyringSet } from "@/ipc/keyring";

export interface ModelConfigFormProps {
  initial?: ModelConfig;
  onSubmit: (input: ModelConfigCreateInput) => Promise<void>;
  onCancel?: () => void;
}

/**
 * 模型配置新增/编辑表单（Key 经 keyringSet 写入，不回显）。
 *
 * provider 由**预设下拉**选择（含国内主流 OpenAI 兼容厂商与「自定义」）：
 * 选中预设 → **自动填充** `baseUrl` / `modelName`（**字段仍可编辑**）；选「自定义」→ 提供 provider id **文本输入**；
 * 编辑既有配置时按 `initial.provider` **反查预设**（未命中 → 视为自定义并回填该 id）。
 */
export function ModelConfigForm({ initial, onSubmit, onCancel }: ModelConfigFormProps) {
  const { t } = useTranslation("settings");
  const initialProvider = initial?.provider ?? "";
  const [presetId, setPresetId] = useState(
    initialProvider ? presetIdForProvider(initialProvider) : "openai",
  );
  /** 自定义 provider id（仅 `custom` 预设下可编辑；预设下由预设 id 驱动） */
  const [customProvider, setCustomProvider] = useState(
    initialProvider && presetIdForProvider(initialProvider) === CUSTOM_PRESET_ID
      ? initialProvider
      : "",
  );
  const [label, setLabel] = useState(initial?.label ?? "default");
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [modelName, setModelName] = useState(initial?.modelName ?? "");
  const [temperature, setTemperature] = useState(String(initial?.temperature ?? 0.7));
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const isCustom = presetId === CUSTOM_PRESET_ID;
  /** 实际写入 `model_config.provider` 的值 */
  const provider = isCustom ? customProvider.trim() : presetId;

  /** 选择预设：**自动填充** baseUrl / modelName（字段仍可编辑；custom 留空由用户填写） */
  function selectPreset(nextId: string) {
    setPresetId(nextId);
    if (nextId === CUSTOM_PRESET_ID) {
      return; // 自定义：保留用户已填内容（provider id 由文本输入提供）
    }
    const preset = findPreset(nextId);
    if (!preset) {
      return;
    }
    setBaseUrl(preset.baseUrl);
    if (preset.defaultModel) {
      setModelName(preset.defaultModel);
    }
  }

  async function handleSave() {
    if (!provider) {
      return; // 自定义未填 provider id：不提交（避免空 provider 落库）
    }
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
            data-testid="model-provider-select"
            className="border-input h-8 rounded-lg border bg-transparent px-2.5"
            value={presetId}
            onChange={(e) => selectPreset(e.target.value)}
          >
            {PROVIDER_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </label>

        {/* 自定义：provider id 文本输入（写入 model_config.provider 与 keyring 条目） */}
        {isCustom && (
          <label className="flex flex-col gap-1 text-sm">
            {t("providerId")}
            <Input
              data-testid="model-provider-id"
              value={customProvider}
              placeholder="my-gateway"
              onChange={(e) => setCustomProvider(e.target.value)}
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          {t("label")}
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("baseUrl")}
          <Input
            data-testid="model-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("modelName")}
          <Input
            data-testid="model-name"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
          />
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
          <Button data-testid="model-save" disabled={busy || !provider} onClick={handleSave}>
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
