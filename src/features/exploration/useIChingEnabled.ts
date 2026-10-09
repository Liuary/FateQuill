/**
 * 易经可选开关（stage-09 T4）
 *
 * localStorage `fatequill.iching.enabled`；**缺省关闭**（未开启时相关入口不可见）。
 * 由 op-004 引入（供 T4/T5 共用）；op-005 补**开关 UI** 与装配注入。
 */

import { useCallback, useState } from "react";

export const ICHING_ENABLED_STORAGE_KEY = "fatequill.iching.enabled";

/** 读取开关（缺省 / 存储不可用 → false） */
function readEnabled(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  try {
    return localStorage.getItem(ICHING_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** 易经可选开关（缺省关闭） */
export function useIChingEnabled(): { enabled: boolean; setEnabled: (value: boolean) => void } {
  const [enabled, setEnabledState] = useState<boolean>(readEnabled);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof localStorage === "undefined") {
      return;
    }
    try {
      localStorage.setItem(ICHING_ENABLED_STORAGE_KEY, String(value));
    } catch {
      // 存储不可用（隐私模式/配额）：仅会话内生效
    }
  }, []);

  return { enabled, setEnabled };
}
