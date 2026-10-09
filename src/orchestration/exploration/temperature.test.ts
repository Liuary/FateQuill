import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPERATURES,
  PROVIDER_TEMPERATURE_RANGE,
  TEMPERATURE_STORAGE_KEY,
  clampTemperature,
  loadTemperatures,
  saveTemperatures,
} from "./temperature";

describe("clampTemperature（per-provider 越界标注）", () => {
  it("anthropic 1.1 → clamp 至 1 且标注；openai-compatible 1.1 不 clamp", () => {
    expect(clampTemperature(1.1, "anthropic")).toEqual({ effective: 1, clamped: true });
    expect(clampTemperature(1.1, "openai-compatible")).toEqual({ effective: 1.1, clamped: false });
  });

  it("下界 clamp（负数 → min）", () => {
    expect(clampTemperature(-0.5, "openai-compatible")).toEqual({ effective: 0, clamped: true });
  });

  it("未知 provider 回退 [0,2]", () => {
    expect(clampTemperature(1.1, "unknown-provider")).toEqual({ effective: 1.1, clamped: false });
    expect(clampTemperature(3, "unknown-provider")).toEqual({ effective: 2, clamped: true });
  });

  it("边界值不视为越界", () => {
    expect(clampTemperature(0, "anthropic")).toEqual({ effective: 0, clamped: false });
    expect(clampTemperature(1, "anthropic")).toEqual({ effective: 1, clamped: false });
  });

  it("provider 区间表", () => {
    expect(PROVIDER_TEMPERATURE_RANGE["openai-compatible"]).toEqual([0, 2]);
    expect(PROVIDER_TEMPERATURE_RANGE.anthropic).toEqual([0, 1]);
  });
});

describe("温度集持久化（localStorage）", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("默认温度集为 {0.3, 0.7, 1.1}", () => {
    expect([...DEFAULT_TEMPERATURES]).toEqual([0.3, 0.7, 1.1]);
    expect(loadTemperatures()).toEqual([0.3, 0.7, 1.1]);
  });

  it("save → load 往返", () => {
    saveTemperatures([0.2, 0.9]);
    expect(localStorage.getItem(TEMPERATURE_STORAGE_KEY)).toBe("[0.2,0.9]");
    expect(loadTemperatures()).toEqual([0.2, 0.9]);
  });

  it("损坏 / 非法 / 空内容 → 回退默认集", () => {
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, "not json");
    expect(loadTemperatures()).toEqual([0.3, 0.7, 1.1]);
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, JSON.stringify(["x", null]));
    expect(loadTemperatures()).toEqual([0.3, 0.7, 1.1]);
    localStorage.setItem(TEMPERATURE_STORAGE_KEY, JSON.stringify([]));
    expect(loadTemperatures()).toEqual([0.3, 0.7, 1.1]);
  });
});
