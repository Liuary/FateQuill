/**
 * 合规评估器（规则引擎，stage-06 T2）
 *
 * 职责：以 `compliance-rules.ts` 的词表 / 正则扫描正文，命中按类目权重扣分（下限 0），
 * 生成 `reasons` 与 `findings.hits`。**无需 Token / Provider**；可选 LLM 复核为占位，
 * 启用时经 `evaluateWithFallback` 兜底（失败降级不抛穿）。合规低分**仅人工裁决，不自动重写**。
 */

import type { Evaluator, ReviewInput } from "../types";
import { evaluateWithFallback } from "../evaluator";
import {
  CATEGORY_WEIGHT,
  COMPLIANCE_RULES,
  scanCompliance,
  type ComplianceHit,
  type ComplianceRule,
} from "../compliance-rules";

/** 构造合规规则评估器（可注入自定义词表 / 可选 LLM 复核评估器） */
export function createComplianceEvaluator(opts?: {
  rules?: ComplianceRule[];
  llmReview?: Evaluator;
}): Evaluator {
  const rules = opts?.rules ?? COMPLIANCE_RULES;
  const llmReview = opts?.llmReview;
  return {
    id: "compliance",
    async evaluate(input: ReviewInput) {
      const hits = scanCompliance(input.content, rules);
      // 同规则去重：每条规则计一次扣分，保留首次命中信息
      const byRule = new Map<string, ComplianceHit>();
      for (const hit of hits) {
        if (!byRule.has(hit.ruleId)) {
          byRule.set(hit.ruleId, hit);
        }
      }
      const reasons: string[] = [];
      let score = 100;
      for (const hit of byRule.values()) {
        score -= CATEGORY_WEIGHT[hit.category];
        reasons.push(`[${hit.category}] ${hit.note}：命中「${hit.match}」`);
      }
      score = Math.max(0, score);

      const findings: Record<string, unknown> = { hits: [...byRule.values()], llmReview: null };

      // 可选 LLM 复核（占位：默认未启用；启用时取更低分并附复核理由）
      if (llmReview) {
        const extra = await evaluateWithFallback(llmReview, input);
        score = Math.min(score, extra.score);
        reasons.push(...extra.reasons.map((r) => `[LLM复核] ${r}`));
        findings.llmReview = extra;
      }

      return { score, reasons, findings };
    },
  };
}
