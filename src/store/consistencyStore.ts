/**
 * 一致性域跨面板状态（stage-11 T4）
 *
 * 职责：承载**处置「编辑设定卡」的定位请求**——一致性面板发起
 * （`requestFocus`：卡 id + `evidence` 在卡内容中的命中区间），
 * 供 `WorkspaceLayout`（切到设定卡 tab）与 `SettingCardsPanel`/`SettingCardForm`（打开该卡并选中片段）消费。
 * 会话内存、**不落库**；独立 `create()`。
 */

import { create } from "zustand";

/** 定位请求（`index` 为命中起点，`length` 为命中长度；未命中 → `index:0, length:0` 即**回退卡首**） */
export interface ConsistencyFocus {
  cardId: number;
  index: number;
  length: number;
}

interface ConsistencyFocusState {
  focus: ConsistencyFocus | null;
  requestFocus: (focus: ConsistencyFocus) => void;
  clearFocus: () => void;
}

export const useConsistencyFocusStore = create<ConsistencyFocusState>((set) => ({
  focus: null,
  requestFocus: (focus) => set({ focus }),
  clearFocus: () => set({ focus: null }),
}));
