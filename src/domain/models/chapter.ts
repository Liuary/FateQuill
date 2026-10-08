import type { ChapterStatus, ContentFormat } from "../values";

/** 章节：正文与元数据 */
export interface Chapter {
  id: number;
  volumeId: number;
  title: string;
  content: string;
  contentFormat: ContentFormat;
  orderIndex: number;
  status: ChapterStatus;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}
