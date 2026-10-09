import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { buildCharacterAgentPrompt } from "@/orchestration/dialogue/persona";
import { normalizeProfile, toProfileRecord } from "@/orchestration/dialogue/profile";
import { useCharacters } from "./useCharacters";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const row = (over: Record<string, unknown> = {}) => ({
  id: 1,
  novel_id: 1,
  name: "林砚",
  profile: JSON.stringify({ identity: "侠客甲", speechStyle: "冷峻寡言" }),
  ...over,
});

const argsOf = (cmd: string) =>
  invokeMock.mock.calls.find((call) => call[0] === cmd)?.[1] as Record<string, unknown> | undefined;
const listCalls = () =>
  invokeMock.mock.calls.filter((call) => call[0] === "list_characters").length;

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_characters") return Promise.resolve([row()]);
    if (cmd === "create_character" || cmd === "update_character") return Promise.resolve(row());
    return Promise.resolve(undefined);
  });
});

describe("useCharacters（CRUD + profile 归一）", () => {
  it("加载列表并归一 profile（缺失字段 → 空串；major → false）", async () => {
    const { result } = renderHook(() => useCharacters(1));
    await waitFor(() => expect(result.current.characters).toHaveLength(1));

    const character = result.current.characters[0];
    expect(character.name).toBe("林砚");
    expect(character.profile.identity).toBe("侠客甲");
    expect(character.profile.speechStyle).toBe("冷峻寡言");
    expect(character.profile.goal).toBe(""); // 缺失 → 空串
    expect(character.profile.major).toBe(false); // 缺失 → false
  });

  it("create → create_character 调用（profile JSON 仅契约字段）+ 列表刷新", async () => {
    const { result } = renderHook(() => useCharacters(1));
    await waitFor(() => expect(result.current.characters).toHaveLength(1));
    const before = listCalls();

    await act(async () => {
      await result.current.create({
        name: "阿禾",
        profile: normalizeProfile({ identity: "船工" }),
      });
    });

    expect(invokeMock).toHaveBeenCalledWith("create_character", expect.anything());
    expect(argsOf("create_character")?.name).toBe("阿禾");
    expect(argsOf("create_character")?.novelId).toBe(1);
    const stored = JSON.parse(String(argsOf("create_character")?.profile)) as Record<
      string,
      unknown
    >;
    expect(Object.keys(stored).sort()).toEqual([
      "extra",
      "goal",
      "identity",
      "major",
      "personality",
      "speechStyle",
    ]);
    expect(stored.identity).toBe("船工");
    expect(stored.major).toBe(false);
    expect(listCalls()).toBeGreaterThan(before); // 刷新
  });

  it("update / remove 调用并刷新", async () => {
    const { result } = renderHook(() => useCharacters(1));
    await waitFor(() => expect(result.current.characters).toHaveLength(1));

    await act(async () => {
      await result.current.update(1, {
        name: "林砚改",
        profile: normalizeProfile({ identity: "守塔人" }),
      });
    });
    expect(invokeMock).toHaveBeenCalledWith("update_character", expect.anything());
    expect(argsOf("update_character")?.id).toBe(1);
    expect(String(argsOf("update_character")?.profile)).toContain("守塔人");

    await act(async () => {
      await result.current.remove(1);
    });
    expect(invokeMock).toHaveBeenCalledWith("delete_character", { id: 1 });
  });

  it("novelId 为 null → 空列表（ready），不调用 IPC", async () => {
    const { result } = renderHook(() => useCharacters(null));
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.characters).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("**契约一致性**：提交的 profile 经 buildCharacterAgentPrompt → system 含 identity/speechStyle", async () => {
    const { result } = renderHook(() => useCharacters(1));
    await waitFor(() => expect(result.current.characters).toHaveLength(1));

    // 表单提交结构（与 `CharacterForm` 一致）
    const input = {
      name: "林砚",
      profile: normalizeProfile({ identity: "侠客甲", speechStyle: "冷峻寡言", major: true }),
    };
    // ① Agent 引用：字段出现在 persona system
    const { system } = buildCharacterAgentPrompt({ profile: input.profile, publicContext: "" });
    expect(system).toContain("侠客甲");
    expect(system).toContain("冷峻寡言");
    // ② 落库记录：与 Agent 引用同源（同一次归一）
    const record = toProfileRecord(input.profile);
    expect(record.identity).toBe("侠客甲");
    expect(record.speechStyle).toBe("冷峻寡言");
    expect(record.major).toBe(true);
  });
});
