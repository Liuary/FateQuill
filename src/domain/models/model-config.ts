/** 模型配置（不含 API Key；Key 仅存于 OS 密钥链） */
export interface ModelConfig {
  id: number;
  provider: string;
  label: string;
  baseUrl: string;
  modelName: string;
  temperature: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
