/**
 * 冲突记录列表与检测（stage-11 T4）
 *
 * 职责：加载冲突记录（**落库、跨会话可查**）；触发检测并**落库新检出**：
 * - `detectL1`：L1 规则（离线纯函数，零幻觉）→ `save_conflict_record`（同 `(aId,bId,type)` 已存在则跳过）；
 * - `reviewL2`：L2 语义复核（需模型）→ `contradiction` 时转报告并落库 `semantic`。
 */

import { useCallback, useEffect, useState } from "react";
import type { ConflictRecord } from "@/domain/models/conflict-record";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelRef } from "@/orchestration/types";
import type { ConflictReport } from "@/orchestration/consistency/types";
import { runL2 } from "@/orchestration/consistency/judge";
import { toConflictReport, type SemanticFinding } from "@/orchestration/consistency/report";
import { runL1Rules } from "@/orchestration/consistency/rules";
import { repositories } from "@/ipc/repositories";
import { resolveProviderForConfig } from "@/features/generation/resolve-provider";

/** 冲突对键（`(aId,bId,type)`）：去重用 */
const keyOf = (report: { aId: number; bId: number; type: string }) =>
  `${report.aId}|${report.bId}|${report.type}`;

async function loadConflicts(novelId: number | null): Promise<ConflictRecord[]> {
  if (novelId == null) {
    return [];
  }
  return repositories.conflictRecord.listByNovel(novelId);
}

/** 冲突记录列表 + 检测（L1 规则 / L2 语义） */
export function useConflicts(novelId: number | null) {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setConflicts(await loadConflicts(novelId));
  }, [novelId]);

  useEffect(() => {
    let alive = true;
    void loadConflicts(novelId).then(
      (rows) => {
        if (alive) {
          setConflicts(rows);
        }
      },
      () => {
        // 读取失败（IPC 未就绪）：空态展示，不阻断
        if (alive) {
          setConflicts([]);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [novelId]);

  /** 落库一批报告（跳过已有同 `(aId,bId,type)` 记录）→ 返回新增条数 */
  const persistNew = useCallback(
    async (reports: ConflictReport[], known: ConflictRecord[]): Promise<number> => {
      if (novelId == null) {
        return 0;
      }
      const seen = new Set(known.map((record) => keyOf(record)));
      let saved = 0;
      for (const report of reports) {
        const key = keyOf(report);
        if (seen.has(key)) {
          continue; // 已有记录（含已处置）→ 不重复落库
        }
        seen.add(key);
        await repositories.conflictRecord.save({
          novelId,
          aId: report.aId,
          bId: report.bId,
          type: report.type,
          evidence: report.evidence,
          severity: report.severity,
        });
        saved += 1;
      }
      return saved;
    },
    [novelId],
  );

  /** L1 检测（纯函数、零成本）→ 新检出落库；返回新增条数（失败 → 0 + `error`） */
  const detectL1 = useCallback(async (): Promise<number> => {
    if (novelId == null) {
      return 0;
    }
    setDetecting(true);
    setError(null);
    try {
      const cards = await repositories.settingCard.listByNovel(novelId);
      const reports = runL1Rules(
        cards.map((card) => ({ id: card.id, title: card.title, content: card.content })),
      );
      const known = await repositories.conflictRecord.listByNovel(novelId);
      const saved = await persistNew(reports, known);
      await reload();
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return 0;
    } finally {
      setDetecting(false);
    }
  }, [novelId, persistNew, reload]);

  /** L2 语义复核（需模型）：`contradiction` → 落库 `semantic` 报告；返回是否报出 */
  const reviewL2 = useCallback(
    async (conflict: ConflictRecord, config: ModelConfig): Promise<boolean> => {
      if (novelId == null) {
        return false;
      }
      setDetecting(true);
      setError(null);
      try {
        const cards = await repositories.settingCard.listByNovel(novelId);
        const candidate = cards.find((card) => card.id === conflict.aId);
        const constraint = cards.find((card) => card.id === conflict.bId);
        if (!candidate || !constraint) {
          return false;
        }
        const provider = resolveProviderForConfig(config);
        const modelRef: ModelRef = { providerId: config.provider, model: config.modelName };
        const outcome = await runL2({
          candidate: { id: candidate.id, name: candidate.title, content: candidate.content },
          constraints: [
            { id: constraint.id, title: constraint.title, content: constraint.content },
          ],
          modelRef,
          // 非流式收口（判定温度 0，见 JUDGE_SYSTEM_PROMPT 契约）
          streamFor: (options) => provider.stream(options),
        });
        const findings: SemanticFinding[] = [
          { candidateId: candidate.id, constraintId: constraint.id, verdict: outcome },
        ];
        const reports = toConflictReport([], findings);
        const known = await repositories.conflictRecord.listByNovel(novelId);
        await persistNew(reports, known);
        await reload();
        return reports.length > 0;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        return false;
      } finally {
        setDetecting(false);
      }
    },
    [novelId, persistNew, reload],
  );

  return { conflicts, reload, detectL1, reviewL2, detecting, error };
}
