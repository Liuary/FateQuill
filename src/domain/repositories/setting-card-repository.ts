import type { SettingCard } from "@/domain/models/setting-card";

/** 设定卡仓储接口（纯 TS，仅依赖领域模型） */
export interface SettingCardRepository {
  listByNovel(novelId: number): Promise<SettingCard[]>;
  get(id: number): Promise<SettingCard>;
  create(input: {
    novelId: number;
    title: string;
    content: string;
    kind: string;
  }): Promise<SettingCard>;
  update(id: number, input: { title: string; content: string; kind: string }): Promise<SettingCard>;
  remove(id: number): Promise<void>;
}
