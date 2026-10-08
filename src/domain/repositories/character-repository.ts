import type { Character } from "@/domain/models/character";

/** 角色仓储接口（纯 TS，仅依赖领域模型） */
export interface CharacterRepository {
  listByNovel(novelId: number): Promise<Character[]>;
  get(id: number): Promise<Character>;
  create(input: {
    novelId: number;
    name: string;
    profile: Record<string, unknown>;
  }): Promise<Character>;
  update(id: number, input: { name: string; profile: Record<string, unknown> }): Promise<Character>;
  remove(id: number): Promise<void>;
}
