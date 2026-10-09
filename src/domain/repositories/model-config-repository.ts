import type { ModelConfig } from "@/domain/models/model-config";

/** 模型配置创建/更新入参 */
export interface ModelConfigCreateInput {
  provider: string;
  label: string;
  baseUrl: string;
  modelName: string;
  temperature: number;
  isDefault: boolean;
}
export type ModelConfigUpdateInput = ModelConfigCreateInput;

/** 模型配置仓储接口（纯 TS，仅依赖领域模型；Key 不经此接口） */
export interface ModelConfigRepository {
  list(): Promise<ModelConfig[]>;
  get(id: number): Promise<ModelConfig>;
  create(input: ModelConfigCreateInput): Promise<ModelConfig>;
  update(id: number, input: ModelConfigUpdateInput): Promise<ModelConfig>;
  remove(id: number): Promise<void>;
}
