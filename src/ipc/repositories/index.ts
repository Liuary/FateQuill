import { createNovelRepository } from "./novel-repository";
import { createVolumeRepository } from "./volume-repository";
import { createChapterRepository } from "./chapter-repository";
import { createSettingCardRepository } from "./setting-card-repository";
import { createCharacterRepository } from "./character-repository";

export { createNovelRepository } from "./novel-repository";
export { createVolumeRepository } from "./volume-repository";
export { createChapterRepository } from "./chapter-repository";
export { createSettingCardRepository } from "./setting-card-repository";
export { createCharacterRepository } from "./character-repository";

/** 各实体仓储实例的组合导出 */
export const repositories = {
  novel: createNovelRepository(),
  volume: createVolumeRepository(),
  chapter: createChapterRepository(),
  settingCard: createSettingCardRepository(),
  character: createCharacterRepository(),
};
