import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import i18n from "@/app/i18n";
import { useResearchStore } from "@/store/researchStore";
import { AnnotationPanel } from "./AnnotationPanel";
import { useAnnotation } from "./useAnnotation";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const row = {
  id: 1,
  source_type: "multi_model_cross",
  source_model: "A",
  excerpt: "她不禁皱眉",
  position_json: "{}",
  reason: "r",
  label: "cliche",
  chapter_id: null,
  status: "confirmed",
  created_at: "c",
};

/** 取 `save_material` 的调用参数 */
const savedArgs = () =>
  invokeMock.mock.calls.find((call) => call[0] === "save_material")?.[1] as Record<string, unknown>;

beforeEach(async () => {
  await i18n.changeLanguage("zh-CN");
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(row);
  useResearchStore.setState({ selectedConfigIds: [], candidates: [], pendingResults: [] });
});

describe("AnnotationPanel（标注工作台）", () => {
  it("① 交叉待确认项 → source_type=multi_model_cross，status=confirmed", async () => {
    useResearchStore.setState({
      pendingResults: [
        {
          excerpt: "她不禁皱眉",
          models: ["A", "B"],
          reason: "套话",
          confidence: "high",
          sourceType: "multi_model_cross",
        },
      ],
    });
    render(<AnnotationPanel />);

    fireEvent.click(
      within(screen.getByTestId("pending-result")).getByRole("button", { name: "标注" }),
    );
    await waitFor(() => expect(screen.getByLabelText("引文")).toHaveValue("她不禁皱眉"));

    fireEvent.change(screen.getByLabelText("理由"), { target: { value: "开头套路" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_material", expect.anything()),
    );
    expect(savedArgs().sourceType).toBe("multi_model_cross"); // 通道透传（REV-011）
    expect(savedArgs().status).toBe("confirmed");
    expect(savedArgs().label).toBe("cliche");
    expect(savedArgs().excerpt).toBe("她不禁皱眉");
  });

  it("② 采样候选标注 → source_type=multi_model_creation", async () => {
    useResearchStore.setState({
      candidates: [
        {
          id: "mc-1",
          sourceType: "multi_model_creation",
          sourceModel: "modelA",
          content: "她不禁皱了皱眉。",
          createdAt: 1,
        },
      ],
    });
    render(<AnnotationPanel />);

    fireEvent.click(
      within(screen.getByTestId("annotation-candidate")).getByRole("button", { name: "标注" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_material", expect.anything()),
    );
    expect(savedArgs().sourceType).toBe("multi_model_creation");
    expect(savedArgs().status).toBe("confirmed");
  });

  it("③ 从零手选片段 → source_type=user_manual，且多命中提示渲染", async () => {
    render(<AnnotationPanel />);
    fireEvent.click(screen.getByRole("button", { name: "从零手选片段" }));

    fireEvent.change(screen.getByLabelText("引文"), { target: { value: "甲" } });
    fireEvent.change(screen.getByLabelText("定位正文"), { target: { value: "甲甲" } });
    expect(screen.getByText(/多命中/)).toBeInTheDocument(); // ambiguous 提示

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("save_material", expect.anything()),
    );
    expect(savedArgs().sourceType).toBe("user_manual");
  });

  it("标签为受控枚举：下拉仅含四个受控项", async () => {
    render(<AnnotationPanel />);
    fireEvent.click(screen.getByRole("button", { name: "从零手选片段" }));

    const options = within(screen.getByLabelText("标签")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "套话",
      "排比",
      "空洞形容",
      "翻译腔",
    ]);
  });

  it("非法标签拒绝：不写库且置 error", async () => {
    const { result } = renderHook(() => useAnnotation());
    await act(async () => {
      await result.current.save(
        { excerpt: "x", sourceType: "user_manual", sourceModel: "" },
        { reason: "r", tag: "bogus", note: "" },
      );
    });
    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.error).toBe("invalid-tag");
  });
});
