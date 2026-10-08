import type { Novel } from "@/domain/models/novel";

/** 小说仓储接口（纯 TS，仅依赖领域模型） */
export interface NovelRepository {
  list(): Promise<Novel[]>;
  get(id: number): Promise<Novel>;
  create(input: { title: string; synopsis: string }): Promise<Novel>;
  update(id: number, input: { title: string; synopsis: string }): Promise<Novel>;
  remove(id: number): Promise<void>;
}
