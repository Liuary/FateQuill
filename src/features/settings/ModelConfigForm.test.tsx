import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import i18n from "@/app/i18n";
import type { ModelConfig } from "@/domain/models/model-config";
import { ModelConfigForm } from "./ModelConfigForm";

const { keyringSetMock } = vi.hoisted(() => ({ keyringSetMock: vi.fn() }));
vi.mock("@/ipc/keyring", () => ({ keyringSet: keyringSetMock }));

const initialConfig = (over: Partial<ModelConfig> = {}): ModelConfig => ({
  id: 1,
  provider: "deepseek",
  label: "default",
  baseUrl: "https://api.deepseek.com/v1",
  modelName: "deepseek-chat",
  temperature: 0.7,
  isDefault: true,
  createdAt: "c",
  updatedAt: "u",
  ...over,
});

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  keyringSetMock.mockReset();
  keyringSetMock.mockResolvedValue(undefined);
});

describe("ModelConfigForm（provider 预设与自定义入口；stage-03 op-008）", () => {
  it("预设下拉含国内主流厂商 + 自定义（不再硬编码两项）", () => {
    render(<ModelConfigForm onSubmit={vi.fn()} />);
    const select = screen.getByTestId("model-provider-select") as HTMLSelectElement;
    const values = [...select.options].map((option) => option.value);

    expect(values).toEqual(
      expect.arrayContaining([
        "openai",
        "anthropic",
        "deepseek",
        "zhipu",
        "qwen",
        "moonshot",
        "siliconflow",
        "minimax",
        "custom",
      ]),
    );
    expect(values.length).toBeGreaterThanOrEqual(9);
  });

  it("选 **DeepSeek** 预设 → 自动填充 `baseUrl` 与 `modelName`（字段保持可编辑）", () => {
    render(<ModelConfigForm onSubmit={vi.fn()} />);

    fireEvent.change(screen.getByTestId("model-provider-select"), {
      target: { value: "deepseek" },
    });

    const baseUrl = screen.getByTestId("model-base-url") as HTMLInputElement;
    const modelName = screen.getByTestId("model-name") as HTMLInputElement;
    expect(baseUrl.value).toBe("https://api.deepseek.com/v1");
    expect(modelName.value).toBe("deepseek-chat");

    // 仍可编辑（用户可覆盖）
    fireEvent.change(modelName, { target: { value: "deepseek-reasoner" } });
    expect(modelName.value).toBe("deepseek-reasoner");
  });

  it("选 **自定义** → provider id 文本输入可用；提交以该 id 为 `provider`", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ModelConfigForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("model-provider-select"), {
      target: { value: "custom" },
    });
    const providerId = screen.getByTestId("model-provider-id") as HTMLInputElement;
    expect(providerId.value).toBe("");

    fireEvent.change(providerId, { target: { value: "my-gateway" } });
    fireEvent.change(screen.getByTestId("model-base-url"), {
      target: { value: "https://gw.example.com/v1" },
    });
    fireEvent.change(screen.getByTestId("model-name"), { target: { value: "my-model" } });
    fireEvent.click(screen.getByTestId("model-save"));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        provider: "my-gateway",
        label: "default",
        baseUrl: "https://gw.example.com/v1",
        modelName: "my-model",
        temperature: 0.7,
        isDefault: false,
      }),
    );
  });

  it("自定义未填 provider id → 不提交（保存按钮禁用，避免空 provider 落库）", () => {
    const onSubmit = vi.fn();
    render(<ModelConfigForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("model-provider-select"), {
      target: { value: "custom" },
    });
    expect((screen.getByTestId("model-save") as HTMLButtonElement).disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("编辑既有 **deepseek** 配置 → 回显选中该预设（含 baseUrl / modelName）", () => {
    render(<ModelConfigForm initial={initialConfig()} onSubmit={vi.fn()} />);

    expect((screen.getByTestId("model-provider-select") as HTMLSelectElement).value).toBe(
      "deepseek",
    );
    expect((screen.getByTestId("model-base-url") as HTMLInputElement).value).toBe(
      "https://api.deepseek.com/v1",
    );
    expect((screen.getByTestId("model-name") as HTMLInputElement).value).toBe("deepseek-chat");
    // 既有配置非自定义 → 无 provider id 输入
    expect(screen.queryByTestId("model-provider-id")).toBeNull();
  });

  it("编辑既有**未登记 provider**（如自建网关）→ 视为自定义并回填 provider id", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ModelConfigForm
        initial={initialConfig({ provider: "my-gateway", baseUrl: "https://gw.example.com/v1" })}
        onSubmit={onSubmit}
      />,
    );

    expect((screen.getByTestId("model-provider-select") as HTMLSelectElement).value).toBe("custom");
    const providerId = screen.getByTestId("model-provider-id") as HTMLInputElement;
    expect(providerId.value).toBe("my-gateway"); // 回填

    // 直接保存：provider 保持为原 id（契约不变）
    fireEvent.click(screen.getByTestId("model-save"));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "my-gateway", baseUrl: "https://gw.example.com/v1" }),
      ),
    );
  });

  it("填 API Key → `keyringSet(provider, label, key)`（契约不变）", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ModelConfigForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("model-provider-select"), { target: { value: "zhipu" } });
    expect((screen.getByTestId("model-base-url") as HTMLInputElement).value).toBe(
      "https://open.bigmodel.cn/api/paas/v4",
    );
    fireEvent.change(screen.getByLabelText("API Key"), { target: { value: "sk-test" } });
    fireEvent.click(screen.getByTestId("model-save"));

    await waitFor(() => expect(keyringSetMock).toHaveBeenCalledWith("zhipu", "default", "sk-test"));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ provider: "zhipu" }));
  });
});
