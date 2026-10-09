import type { Material, MaterialSourceType, MaterialStatus } from "@/domain/models/material";

/** 素材仓储接口（TS；实现见 `src/ipc/repositories`） */
export interface MaterialRepository {
  /** 保存素材（入库即 `confirmed`；`candidate` 预留，REV-013） */
  save(input: {
    sourceType: MaterialSourceType;
    sourceModel: string;
    excerpt: string;
    position?: { contextBefore?: string; contextAfter?: string };
    reason: string;
    label: string;
    chapterId: number | null;
    status?: MaterialStatus;
  }): Promise<Material>;

  /** 列出/检索素材（status / sourceType 过滤 + query 模糊检索；时间倒序） */
  list(filter?: {
    status?: MaterialStatus;
    sourceType?: MaterialSourceType;
    query?: string;
  }): Promise<Material[]>;

  /** 删除素材（**被 skill 引用则拒绝**，REV-012） */
  remove(id: number): Promise<void>;
}
