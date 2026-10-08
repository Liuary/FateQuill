import type { Volume } from "@/domain/models/volume";

/** 卷仓储接口（纯 TS，仅依赖领域模型） */
export interface VolumeRepository {
  listByNovel(novelId: number): Promise<Volume[]>;
  get(id: number): Promise<Volume>;
  create(input: { novelId: number; title: string; orderIndex: number }): Promise<Volume>;
  update(id: number, input: { title: string }): Promise<Volume>;
  remove(id: number): Promise<void>;
}
