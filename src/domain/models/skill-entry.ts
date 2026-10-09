/** 规避示例（bad → good 对照） */
export interface SkillExample {
  bad: string;
  good: string;
}

/**
 * 规避经验条目（skill，stage-07 T5）
 *
 * `rule` 为**可执行的规避指令**；来源素材以 `sourceMaterialIds` **id 引用**（不重复存储素材内容，REV-004）。
 */
export interface SkillEntry {
  id: number;
  /** 版本（可管理） */
  version: string;
  title: string;
  rule: string;
  examples: SkillExample[];
  /** 来源素材 id 引用（可追溯） */
  sourceMaterialIds: number[];
  createdAt: string;
}
