/**
 * 标注编排（stage-07 T3）
 *
 * 职责：受控标签校验 → verbatim 定位（前后文 ≤50）→ 经 `material` 仓储入库（`status=confirmed`）。
 * **通道透传（REV-011）**：`sourceType` 取自**被标注项自带的通道**（交叉 / 采样 / 用户手动），
 * 不在本 hook 内写死。
 */

import { useCallback, useState } from "react";
import type { Material, MaterialSourceType } from "@/domain/models/material";
import { repositories } from "@/ipc/repositories";
import { isValidTag, type ResearchTag } from "@/orchestration/research/tags";
import { locateExcerpt } from "./locate";

/** 被标注项（引文 + 自带通道 + 来源模型） */
export interface AnnotationTarget {
  excerpt: string;
  sourceType: MaterialSourceType;
  sourceModel: string;
}

export interface AnnotationValues {
  reason: string;
  tag: ResearchTag | string;
  note: string;
}

/** 标注入库编排 */
export function useAnnotation() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 保存标注：`content` 为定位用正文（缺省则不做定位，`position` 置空上下文）。
   * 标签非法 → 置 `error="invalid-tag"` 并**不写库**。
   */
  const save = useCallback(
    async (
      target: AnnotationTarget,
      values: AnnotationValues,
      content = "",
    ): Promise<Material | null> => {
      if (!isValidTag(values.tag)) {
        setError("invalid-tag"); // 受控枚举：非法标签拒绝
        return null;
      }
      setError(null);
      setSaving(true);
      try {
        const located = content && target.excerpt ? locateExcerpt(content, target.excerpt) : null;
        // 备注并入 reason（material 表无 note 列；备注为用户补充说明）
        const reason = [values.reason, values.note].filter(Boolean).join("\n");
        return await repositories.material.save({
          sourceType: target.sourceType, // 三通道透传（REV-011）
          sourceModel: target.sourceModel,
          excerpt: target.excerpt, // excerpt 为引文唯一权威（REV-016①）
          position: located
            ? { contextBefore: located.contextBefore, contextAfter: located.contextAfter }
            : {},
          reason,
          label: values.tag,
          chapterId: null,
          status: "confirmed",
        });
      } catch {
        // 入库失败（如 IPC 异常 / VALIDATION）：**捕获并提示**（REV-019），不抛出
        setError("save-failed");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { save, saving, error };
}
