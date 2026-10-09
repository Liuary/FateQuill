/**
 * 全自动创作域统一出口（stage-12 T2）
 *
 * **可注入依赖 + 纯函数决策**；不使用任何网络/存储 API（IO 经 `AutopilotDeps` 注入）。
 */

export * from "./types";
export * from "./decide";
export * from "./breaker";
export * from "./chain";
