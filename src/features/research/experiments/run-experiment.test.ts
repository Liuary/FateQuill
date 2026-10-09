import { describe, expect, it } from "vitest";
import type { PromptSkill } from "@/orchestration/prompts/chapter-generation";
import {
  EXPERIMENT_SKILLS,
  EXPERIMENT_TOLERANCE,
  formatReportTable,
  mean,
  runExperiment,
  type DimensionScores,
  type ExperimentSample,
} from "./run-experiment";

const scores = (humanity: number, plot = 70): DimensionScores => ({
  plot,
  worldview: 70,
  compliance: 100,
  humanity,
});

const SAMPLES: ExperimentSample[] = [
  { id: "sample-01", title: "样本一", content: "甲" },
  { id: "sample-02", title: "样本二", content: "乙" },
];

describe("runExperiment（skill 关 / 开对比）", () => {
  it("四维对比表结构：每样本含 baseline/withSkills；真人感主指标与约束判定", async () => {
    const deps = {
      generate: async (_content: string, skills: PromptSkill[]) =>
        skills.length > 0 ? "with" : "base",
      evaluate: async (content: string) => (content === "with" ? scores(80) : scores(70)),
    };

    const report = await runExperiment(SAMPLES, deps);

    expect(report.samples).toHaveLength(2);
    expect(report.samples[0].sampleId).toBe("sample-01");
    expect(report.samples[0].baseline.humanity).toBe(70);
    expect(report.samples[0].withSkills.humanity).toBe(80);
    expect(report.humanityDelta).toBeCloseTo(10); // 主指标
    expect(report.primaryMet).toBe(true);
    expect(report.regressions).toEqual([]);
    expect(report.constraintMet).toBe(true);
    expect(report.tolerance).toBe(EXPERIMENT_TOLERANCE);
  });

  it("注入生效：基线传空 skills，实验传缺省 skill 规则", async () => {
    const seen: number[] = [];
    const deps = {
      generate: async (_content: string, skills: PromptSkill[]) => {
        seen.push(skills.length);
        return "t";
      },
      evaluate: async () => scores(70),
    };
    await runExperiment([{ id: "s", title: "t", content: "x" }], deps);
    expect(seen).toEqual([0, EXPERIMENT_SKILLS.length]);
  });

  it("约束回退：非真人感维度回退超容差 → constraintMet=false（主指标仍可达成）", async () => {
    const deps = {
      generate: async (_content: string, skills: PromptSkill[]) =>
        skills.length > 0 ? "with" : "base",
      evaluate: async (content: string) => (content === "with" ? scores(85, 50) : scores(70, 70)),
    };

    const report = await runExperiment([{ id: "sample-01", title: "样本一", content: "甲" }], deps);

    expect(report.regressions).toEqual([{ sampleId: "sample-01", dimension: "plot", delta: -20 }]);
    expect(report.constraintMet).toBe(false);
    expect(report.primaryMet).toBe(true);
  });

  it("容差内回退不算回退", async () => {
    const deps = {
      generate: async (_content: string, skills: PromptSkill[]) =>
        skills.length > 0 ? "with" : "base",
      evaluate: async (content: string) => (content === "with" ? scores(75, 66) : scores(70, 70)), // plot -4
    };
    const report = await runExperiment([{ id: "s", title: "t", content: "x" }], deps, {
      tolerance: 5,
    });
    expect(report.regressions).toEqual([]);
    expect(report.constraintMet).toBe(true);
  });

  it("formatReportTable：表头 + 逐维行（样本 × 四维）", async () => {
    const deps = {
      generate: async (_content: string, skills: PromptSkill[]) =>
        skills.length > 0 ? "with" : "base",
      evaluate: async (content: string) => (content === "with" ? scores(80) : scores(70)),
    };
    const report = await runExperiment(SAMPLES, deps);
    const table = formatReportTable(report);

    const lines = table.split("\n");
    expect(lines[0]).toBe("| 样本 | 维度 | skill 关 | skill 开 | Δ |");
    expect(lines).toHaveLength(2 + SAMPLES.length * 4); // 表头 + 分隔 + 2 样本 × 4 维
    expect(table).toContain("| sample-01 | humanity | 70 | 80 | +10 |");
  });

  it("mean：空数组为 0", () => {
    expect(mean([])).toBe(0);
    expect(mean([70, 80])).toBe(75);
  });
});
