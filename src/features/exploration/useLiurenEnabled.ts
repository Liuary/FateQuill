/**
 * 大六壬可选开关（stage-12 T1）
 *
 * **单例共享**（同 stage-09 易经开关范式，规避「多份 `useState` 各持状态」缺陷）：
 * 状态提升至 `explorationStore.liurenEnabled`——`ExplorationPanel`（开关 UI）、
 * `LiurenPanel`（面板显隐）与 `useExploration`（引导注入）**共用同一 store 状态**，运行时切换**即时生效**。
 *
 * 持久化 `localStorage['fatequill.liuren.enabled']`（**缺省关闭**）。
 */

import { LIUREN_ENABLED_STORAGE_KEY, useExplorationStore } from "@/store/explorationStore";

export { LIUREN_ENABLED_STORAGE_KEY };

/** 大六壬开关（store 单例，跨组件共享；运行时切换即时生效） */
export function useLiurenEnabled(): { enabled: boolean; setEnabled: (value: boolean) => void } {
  const enabled = useExplorationStore((s) => s.liurenEnabled);
  const setEnabled = useExplorationStore((s) => s.setLiurenEnabled);
  return { enabled, setEnabled };
}
