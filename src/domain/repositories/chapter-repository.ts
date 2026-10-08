import type { Chapter } from "@/domain/models/chapter";
import type { ChapterStatus, ContentFormat } from "@/domain/values";

/** 章节创建入参 */
export interface ChapterCreateInput {
  volumeId: number;
  title: string;
  content: string;
  contentFormat: ContentFormat;
  orderIndex: number;
  /** 可选：创建后如需非默认（draft）状态则附加更新 */
  status?: ChapterStatus;
}

/** 章节更新入参（整体替换） */
export interface ChapterUpdateInput {
  title: string;
  content: string;
  contentFormat: ContentFormat;
  status: ChapterStatus;
  orderIndex: number;
}

/** 章节仓储接口（纯 TS，仅依赖领域模型） */
export interface ChapterRepository {
  listByVolume(volumeId: number): Promise<Chapter[]>;
  get(id: number): Promise<Chapter>;
  create(input: ChapterCreateInput): Promise<Chapter>;
  update(id: number, input: ChapterUpdateInput): Promise<Chapter>;
  remove(id: number): Promise<void>;
}
