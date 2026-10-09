/**
 * 采样编排（stage-07 T1）
 *
 * 职责：列出**全部已配置 `model_config`**（含 Key 状态）供勾选（≥1），经 `resolveProviderForConfig`
 * 构造 `SamplingModel[]` → `runSampling` **串行逐模型**采样 → 产出入 `researchStore.candidates`。
 *
 * **停止采样（REV-010①）**：持 `AbortController`；`stopSampling()` 触发 `abort()`，
 * 调度器在**模型边界 / 流循环内**提前退出；**已采集候选保留**。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import { keyringExists } from "@/ipc/keyring";
import { repositories } from "@/ipc/repositories";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";
import { runSampling } from "@/orchestration/research/sampler";
import type { SamplingModel } from "@/orchestration/research/types";
import { useResearchStore } from "@/store/researchStore";

/** 可选模型项（配置 + Key 存在性） */
export interface SamplingModelOption {
  config: ModelConfig;
  hasKey: boolean;
}

/** 加载全部 `model_config` 及其 Key 状态 */
async function loadOptions(): Promise<SamplingModelOption[]> {
  const configs = await repositories.modelConfig.list();
  return Promise.all(
    configs.map(async (config) => ({
      config,
      hasKey: await keyringExists(config.provider, config.label),
    })),
  );
}

/** 采样编排：勾选模型 → 串行采样；支持停止 */
export function useSampling() {
  const [options, setOptions] = useState<SamplingModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sampling, setSampling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const selectedConfigIds = useResearchStore((s) => s.selectedConfigIds);
  const setSelectedConfigIds = useResearchStore((s) => s.setSelectedConfigIds);

  useEffect(() => {
    let alive = true;
    void loadOptions().then(
      (result) => {
        if (alive) {
          setOptions(result);
          setLoading(false);
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：空态，由 UI 引导设置
        if (alive) {
          setOptions([]);
          setLoading(false);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const selected = options.filter((option) => selectedConfigIds.includes(option.config.id));
  const missingKey = selected.some((option) => !option.hasKey);
  const canSample = !loading && !sampling && selected.length > 0 && !missingKey;

  const startSampling = useCallback(
    async (instruction: string) => {
      const models: SamplingModel[] = options
        .filter((option) => selectedConfigIds.includes(option.config.id) && option.hasKey)
        .map((option) => ({
          configId: option.config.id,
          providerId: option.config.provider,
          label: option.config.label,
          model: option.config.modelName,
          provider: resolveProviderForConfig(option.config),
        }));
      if (models.length === 0) {
        return; // 无可用模型：不启动
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setSampling(true);
      try {
        // 采样产出仅入素材候选：不进正文 / 不自动保存 / 不触发审查 / 无预算裁剪
        await runSampling(
          models,
          instruction,
          (candidate) => useResearchStore.getState().addCandidate(candidate),
          controller.signal,
        );
      } finally {
        abortRef.current = null;
        setSampling(false);
      }
    },
    [options, selectedConfigIds],
  );

  /** 停止采样：abort 后调度器提前退出；**已采集候选保留** */
  const stopSampling = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    options,
    loading,
    sampling,
    selectedConfigIds,
    setSelectedConfigIds,
    canSample,
    missingKey,
    startSampling,
    stopSampling,
  };
}
