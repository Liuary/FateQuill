import { useCallback, useEffect, useState } from "react";
import type { ModelConfig } from "@/domain/models/model-config";
import { repositories } from "@/ipc/repositories";
import { keyringExists } from "@/ipc/keyring";

export type GenerationAvailability = "loading" | "ready" | "no-config" | "no-key";

export interface AvailabilityState {
  state: GenerationAvailability;
  config: ModelConfig | null;
}

/** 判定生成可用性：需存在 `model_config` 且对应 keyring 有 Key */
async function loadAvailability(): Promise<AvailabilityState> {
  const configs = await repositories.modelConfig.list();
  if (configs.length === 0) {
    return { state: "no-config", config: null };
  }
  const config = configs.find((c) => c.isDefault) ?? configs[0];
  const hasKey = await keyringExists(config.provider, config.label);
  return { state: hasKey ? "ready" : "no-key", config };
}

/** 生成可用性 hook（无 config / 无 Key → 引导 Settings） */
export function useGenerationAvailability() {
  const [avail, setAvail] = useState<AvailabilityState>({ state: "loading", config: null });

  const reload = useCallback(async () => {
    setAvail(await loadAvailability());
  }, []);

  useEffect(() => {
    let alive = true;
    void loadAvailability().then(
      (r) => {
        if (alive) setAvail(r);
      },
      () => {
        // 读取失败（如 IPC 未就绪）→ 视为不可用，避免未处理拒绝
        if (alive) setAvail({ state: "no-config", config: null });
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  return { state: avail.state, config: avail.config, reload };
}
