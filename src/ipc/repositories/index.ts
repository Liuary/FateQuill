import { createNovelRepository } from "./novel-repository";
import { createVolumeRepository } from "./volume-repository";
import { createChapterRepository } from "./chapter-repository";
import { createSettingCardRepository } from "./setting-card-repository";
import { createCharacterRepository } from "./character-repository";
import { createModelConfigRepository } from "./model-config-repository";
import { createReviewRecordRepository } from "./review-record-repository";
import { createMaterialRepository } from "./material-repository";
import { createSkillEntryRepository } from "./skill-entry-repository";
import { createConflictRecordRepository } from "./conflict-record-repository";

export { createNovelRepository } from "./novel-repository";
export { createVolumeRepository } from "./volume-repository";
export { createChapterRepository } from "./chapter-repository";
export { createSettingCardRepository } from "./setting-card-repository";
export { createCharacterRepository } from "./character-repository";
export { createModelConfigRepository } from "./model-config-repository";
export { createReviewRecordRepository } from "./review-record-repository";
export { createMaterialRepository } from "./material-repository";
export { createSkillEntryRepository } from "./skill-entry-repository";
export { createConflictRecordRepository } from "./conflict-record-repository";

/** 各实体仓储实例的组合导出 */
export const repositories = {
  novel: createNovelRepository(),
  volume: createVolumeRepository(),
  chapter: createChapterRepository(),
  settingCard: createSettingCardRepository(),
  character: createCharacterRepository(),
  modelConfig: createModelConfigRepository(),
  reviewRecord: createReviewRecordRepository(),
  material: createMaterialRepository(),
  skillEntry: createSkillEntryRepository(),
  conflictRecord: createConflictRecordRepository(),
};
