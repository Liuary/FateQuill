import { invokeCommand } from "@/ipc/client";
import type { ModelConfig } from "@/domain/models/model-config";
import type { ModelConfigRepository } from "@/domain/repositories/model-config-repository";

interface ModelConfigRow {
  id: number;
  provider: string;
  label: string;
  base_url: string;
  model_name: string;
  temperature: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

const toModelConfig = (r: ModelConfigRow): ModelConfig => ({
  id: r.id,
  provider: r.provider,
  label: r.label,
  baseUrl: r.base_url,
  modelName: r.model_name,
  temperature: r.temperature,
  isDefault: r.is_default !== 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** 经 IPC 命令实现模型配置仓储（snake_case 行 ↔ camelCase 模型；is_default 0/1 ↔ boolean） */
export function createModelConfigRepository(): ModelConfigRepository {
  return {
    async list() {
      return (await invokeCommand<ModelConfigRow[]>("list_model_configs")).map(toModelConfig);
    },
    async get(id) {
      return toModelConfig(await invokeCommand<ModelConfigRow>("get_model_config", { id }));
    },
    async create(input) {
      return toModelConfig(
        await invokeCommand<ModelConfigRow>("create_model_config", {
          provider: input.provider,
          label: input.label,
          baseUrl: input.baseUrl,
          modelName: input.modelName,
          temperature: input.temperature,
          isDefault: input.isDefault,
        }),
      );
    },
    async update(id, input) {
      return toModelConfig(
        await invokeCommand<ModelConfigRow>("update_model_config", {
          id,
          provider: input.provider,
          label: input.label,
          baseUrl: input.baseUrl,
          modelName: input.modelName,
          temperature: input.temperature,
          isDefault: input.isDefault,
        }),
      );
    },
    async remove(id) {
      await invokeCommand<void>("delete_model_config", { id });
    },
  };
}
