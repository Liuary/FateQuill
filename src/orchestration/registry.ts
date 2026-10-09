import type { Agent, ModelProvider, Pipeline } from "./types";

/** 泛型注册表：register 拒绝重复 id，replace 允许覆盖，resolve 未注册即抛错 */
export class Registry<T extends { id: string }> {
  private readonly items = new Map<string, T>();

  register(item: T): void {
    if (this.items.has(item.id)) throw new Error(`duplicate id: ${item.id}`);
    this.items.set(item.id, item);
  }

  replace(item: T): void {
    this.items.set(item.id, item);
  }

  resolve(id: string): T {
    const v = this.items.get(id);
    if (!v) throw new Error(`not registered: ${id}`);
    return v;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  list(): T[] {
    return [...this.items.values()];
  }

  remove(id: string): boolean {
    return this.items.delete(id);
  }
}

export type ProviderRegistry = Registry<ModelProvider>;
export type AgentRegistry = Registry<Agent>;
export type PipelineRegistry = Registry<Pipeline>;

export interface OrchestrationRegistries {
  providers: ProviderRegistry;
  agents: AgentRegistry;
  pipelines: PipelineRegistry;
}

export function createRegistries(): OrchestrationRegistries {
  return { providers: new Registry(), agents: new Registry(), pipelines: new Registry() };
}
