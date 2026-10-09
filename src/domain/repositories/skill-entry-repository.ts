import type { SkillEntry, SkillExample } from "@/domain/models/skill-entry";

/** skill 条目写入输入 */
export interface SkillEntryInput {
  version: string;
  title: string;
  rule: string;
  examples?: SkillExample[];
  sourceMaterialIds: number[];
}

/** 规避经验条目仓储接口（TS；实现见 `src/ipc/repositories`） */
export interface SkillEntryRepository {
  save(input: SkillEntryInput): Promise<SkillEntry>;
  update(id: number, input: SkillEntryInput): Promise<SkillEntry>;
  /** 加载全部 skill（供生成链路注入，op-007） */
  list(): Promise<SkillEntry[]>;
  remove(id: number): Promise<void>;
}
