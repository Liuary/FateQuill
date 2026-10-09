import type { SettingCard, SettingCardTier } from "@/domain/models/setting-card";

/** 设定卡分级过滤选项（`tier` 缺省 → 不过滤） */
export interface SettingCardListOptions {
  tier?: SettingCardTier;
}

/** 设定卡仓储接口（纯 TS，仅依赖领域模型） */
export interface SettingCardRepository {
  listByNovel(novelId: number, opts?: SettingCardListOptions): Promise<SettingCard[]>;
  get(id: number): Promise<SettingCard>;
  create(input: {
    novelId: number;
    title: string;
    content: string;
    kind: string;
    /** 缺省 → `'short'`（DB 层默认值兜底） */
    tier?: SettingCardTier;
  }): Promise<SettingCard>;
  update(
    id: number,
    input: {
      title: string;
      content: string;
      kind: string;
      /** 缺省 → **保留既有分级**（不静默降级） */
      tier?: SettingCardTier;
    },
  ): Promise<SettingCard>;
  remove(id: number): Promise<void>;
  /** 归档批量落库（**事务**：全成功或全回滚）；返回按输入顺序创建的行 */
  saveExtracted(
    novelId: number,
    items: { title: string; content: string; kind: string; tier?: SettingCardTier }[],
  ): Promise<SettingCard[]>;
}
