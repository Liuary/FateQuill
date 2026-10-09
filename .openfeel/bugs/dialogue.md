# Bug 追踪：dialogue（角色多声部对话）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/dialogue/`。

## closed

### BUG-001：多声部生产装配未含「设定卡 + 前章末尾/当前章正文 + 用户场景指令」——场景上下文仅落地「公共对话历史」1/4（medium）
- **阶段**：v0.4.0-stage-10（收口 / BUG-001）｜**关联**：plan 技术约束「场景上下文构成（4 部分）」、DoD 第 4/5 条、与 stage-07 REV-018 / BUG-001 同类根因
- **现象**：`src/features/dialogue/useDialogue.ts` 本地 `buildPublicContext`（op-003 **最小接线**占位）仅拼接触口条目为文本，**不读设定卡 / 章节正文 / 场景指令**；`src/orchestration/dialogue/context.ts` 的完整 `buildPublicContext({ settingCards, previousChapterTail, sceneInstruction, history })`（四块）**生产零调用**（`rg` 仅命中 `context.test.ts` 与 `index.ts` re-export）；`DialoguePanel` 无场景指令输入控件、不加载设定卡/章节。→ 多声部台词生成时不知世界观设定、不掌握前文/当前章、无法接受用户场景指令。
- **根因**：**「生产端最小占位未替换为完整实现」**——op-003 备注「publicContext 装配见 op-006，本 op 先以最小接线」的约定**未在 op-006 兑现**（op-006 仅补「他人公开身份摘要」的 `others` 接线）；且本地最小实现与目标共享函数 `buildPublicContext` **同名重名**（隐性遮蔽），既有测试仅覆盖 `context.ts` 单元函数、未覆盖 `useDialogue` 生产装配路径 → 全绿掩盖。与 stage-07「功能无入口」（纯函数生产零调用）**属同类缺陷模式**。
- **影响**：场景上下文生产仅 1/4；DoD 未单列该条但作为 plan 定稿技术约束，首轮偏离已由本 Bug 修复补齐。**不受影响**：防串味白名单（`buildCharacterAgentInput` 生产已接线且经独立探针验证）、旁白/对话分离、`orderIndex` 连续、双路径落章、成本/并发、i18n、零迁移/无 IPC 增量。
- **修复**（commit `311dd63`）：① **单源**——删除 `useDialogue` 内本地最小 `buildPublicContext`，改调 `@/orchestration/dialogue/context` 完整实现（`rg "const buildPublicContext" src/features/dialogue` **零命中**）；② 新增 `src/features/dialogue/scene-context.ts` 的 `useSceneContext`——装载**设定卡**（`list_setting_cards`）+ **前章末尾**（`get_chapter` + `list_chapters` 同卷 `orderIndex` 排序 → `stripHtml` 去标签 → 取末尾限长 `PREVIOUS_TAIL_LIMIT = PROMPT_BUDGET.prevTail` 2000 字符）；③ 面板新增「场景指令」输入（`data-testid="scene-instruction"`）+ i18n 双语；④ `useDialogue({ config, scene })` 装配**四块**（设定卡 / 前文 / 场景指令 / 已定稿对话），旁白/单角色/批量三路径**共用**同一装配。**零新增依赖 / 无迁移 / 无 IPC 增量**（复用既有命令）。
- **验收**：openfeel-reviewer 修复复审 + openfeel-feel-tester **独立回归复验（不轻信声明）**——**独立探针**（`tester-regress-probe.test.tsx`，用后删除）走**真实 `DialoguePanel` 生产路径**（mock 仓储 + provider 捕获实际 `options`）：填入场景指令后，实际 `options` 含 **【设定】/【前文】/【场景指令】**，再生成角色台词含 **【已定稿对话】**，且 `messages[0]` 仍为本人 persona（白名单未破坏）——**四块全部进入实际送模型上下文**；`rg "const buildPublicContext" src/features/dialogue` **零命中**（单源）；门禁 `pnpm test` **99 files/503 passed**、`cargo test` **52 passed**、lint 0 error、build OK、`git diff` 对 `src-tauri` 全空。状态 **closed**（2026-10-10 06:58）。
- **经验**：**跨 op 交接的「占位 → 完整」约定必须用断言强制兑现**——收口须含「**生产调用非零**（spy 真实实现）+ **输出正确** + **空输入零副作用**」三断言与「单源 rg 零命中」；同名函数并存 = 隐性遮蔽（详见 `kb/patterns.md`「单源装配」、`kb/troubleshooting.md`「生产端最小占位未替换为完整实现」）。

## open / fixing / resolved

- （无）
