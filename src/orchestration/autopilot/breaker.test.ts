import { describe, expect, it } from "vitest";
import { checkBreakers, estimateTokens } from "./breaker";
import { defaultAutopilotConfig } from "./types";

describe("checkBreakers（熔断三层；触发即停 + 出报告）", () => {
  it("① 预算：累计 token 达 `budgetLimit` → `budget`；**未配置 → 永不触发**", () => {
    const config = defaultAutopilotConfig({ budgetLimit: 1000, maxChapters: 50 });
    const tripped = checkBreakers(
      { spentTokens: 1000, consecutiveFailures: 0, producedChapters: 1 },
      config,
    );
    expect(tripped.tripped).toBe(true);
    expect(tripped.reason).toBe("budget");
    expect(tripped.detail).toContain("预算上限");

    const unbounded = defaultAutopilotConfig({ maxChapters: 50 }); // 无 budgetLimit
    expect(
      checkBreakers({ spentTokens: 999999, consecutiveFailures: 0, producedChapters: 1 }, unbounded)
        .tripped,
    ).toBe(false);
  });

  it("② 连续失败：连续未达阈章数达 K（**默认 3**）→ `consecutive-failure`", () => {
    const config = defaultAutopilotConfig({ maxChapters: 50 });
    expect(config.consecutiveFailureLimit).toBe(3);
    expect(
      checkBreakers({ spentTokens: 0, consecutiveFailures: 2, producedChapters: 2 }, config)
        .tripped,
    ).toBe(false);

    const tripped = checkBreakers(
      { spentTokens: 0, consecutiveFailures: 3, producedChapters: 3 },
      config,
    );
    expect(tripped.reason).toBe("consecutive-failure");
    expect(tripped.detail).toContain("连续 3 章");
  });

  it("③ 总章数：已产出章数达 `maxChapters` → `max-chapters`", () => {
    const config = defaultAutopilotConfig({ maxChapters: 3 });
    expect(
      checkBreakers({ spentTokens: 0, consecutiveFailures: 0, producedChapters: 2 }, config)
        .tripped,
    ).toBe(false);

    const tripped = checkBreakers(
      { spentTokens: 0, consecutiveFailures: 0, producedChapters: 3 },
      config,
    );
    expect(tripped.reason).toBe("max-chapters");
    expect(tripped.detail).toContain("章数上限");
  });

  it("触发顺序：预算 → 连续失败 → 章数（先命中者为原因）", () => {
    const config = defaultAutopilotConfig({
      budgetLimit: 10,
      consecutiveFailureLimit: 1,
      maxChapters: 1,
    });
    expect(
      checkBreakers({ spentTokens: 10, consecutiveFailures: 1, producedChapters: 1 }, config)
        .reason,
    ).toBe("budget");
    expect(
      checkBreakers({ spentTokens: 0, consecutiveFailures: 1, producedChapters: 1 }, config).reason,
    ).toBe("consecutive-failure");
    expect(
      checkBreakers({ spentTokens: 0, consecutiveFailures: 0, producedChapters: 1 }, config).reason,
    ).toBe("max-chapters");
  });

  it("三层皆未达 → `{ tripped: false }`（无 `reason`）", () => {
    const config = defaultAutopilotConfig({ budgetLimit: 1000, maxChapters: 5 });
    const verdict = checkBreakers(
      { spentTokens: 10, consecutiveFailures: 1, producedChapters: 1 },
      config,
    );
    expect(verdict).toEqual({ tripped: false });
  });

  it("estimateTokens：按字符数估算（中文约 1 字 ≈ 1 token）", () => {
    expect(estimateTokens("雨夜破庙")).toBe(4);
    expect(estimateTokens("")).toBe(0);
  });
});
