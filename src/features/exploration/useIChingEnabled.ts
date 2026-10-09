/**
 * 易经可选开关（stage-09 T4）
 *
 * **单例共享**（BUG-001 修复）：状态提升至 `explorationStore.ichingEnabled`，
 * `ExplorationPanel`（开关 UI）与 `useExploration`（装配注入）**共用同一 store 状态**，
 * 运行时切换**即时生效**（store 订阅驱动同步重渲染，无需重载）。
 *
 * API 不变：`{ enabled, setEnabled }`；持久化 `localStorage['fatequill.iching.enabled']`（缺省关闭）。
 */

import { ICHING_ENABLED_STORAGE_KEY, useExplorationStore } from "@/store/explorationStore";

export { ICHING_ENABLED_STORAGE_KEY };

/** 易经开关（store 单例，跨组件共享；运行时切换即时生效） */
export function useIChingEnabled(): { enabled: boolean; setEnabled: (value: boolean) => void } {
  const enabled = useExplorationStore((s) => s.ichingEnabled);
  const setEnabled = useExplorationStore((s) => s.setIChingEnabled);
  return { enabled, setEnabled };
}
