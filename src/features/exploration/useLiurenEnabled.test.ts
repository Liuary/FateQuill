import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExplorationStore } from "@/store/explorationStore";
import { LIUREN_ENABLED_STORAGE_KEY, useLiurenEnabled } from "./useLiurenEnabled";

beforeEach(() => {
  localStorage.clear();
  useExplorationStore.setState({ liurenEnabled: false, liurenChart: null });
});

describe("useLiurenEnabled（store 单源薄封装；stage-12 T1）", () => {
  it("缺省关闭；`setEnabled` 写 store + `localStorage`", () => {
    const { result } = renderHook(() => useLiurenEnabled());
    expect(result.current.enabled).toBe(false);
    expect(LIUREN_ENABLED_STORAGE_KEY).toBe("fatequill.liuren.enabled");

    act(() => {
      result.current.setEnabled(true);
    });
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(LIUREN_ENABLED_STORAGE_KEY)).toBe("true");
  });

  it("**单例共享**：任一处 `setLiurenEnabled` → 所有消费方即时同步（无重挂载）", () => {
    const first = renderHook(() => useLiurenEnabled());
    const second = renderHook(() => useLiurenEnabled());

    act(() => {
      // 另一处（如 ExplorationPanel 开关）经 store 直接切换
      useExplorationStore.getState().setLiurenEnabled(true);
    });

    expect(first.result.current.enabled).toBe(true);
    expect(second.result.current.enabled).toBe(true);

    act(() => {
      second.result.current.setEnabled(false);
    });
    expect(first.result.current.enabled).toBe(false);
  });
});
