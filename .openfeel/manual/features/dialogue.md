# 模块手册：多声部对话（features/dialogue）

## 职责

FateQuill 的**多声部对话域**（**可选**能力）：以角色档案（`profile`）为 persona，**旁白 / 角色台词分离生成**，
轮次**用户主导**（选中角色 → 生成 → 追加会话条目 → 可反复），产出可**合并落章**的对话草稿。
核心工程约束：**防串味（上下文隔离白名单）**、**双路径落章（含防丢失安全网）**、**成本预估与并发上限**、
**可选接入 stage-06 评审**。建立于 **v0.4.0-stage-10**。

分层：契约 / 装配 / 编排在 `src/orchestration/dialogue/`（provider 无关，复用 `http_stream` **非流式收口**）；
会话态在 `src/store/dialogueStore.ts`；UI 在 `src/features/dialogue/`；**无新增 IPC、无迁移**。

## 目录结构 / 关键文件

```
src/orchestration/dialogue/      # 契约与编排（provider 无关）
├── types.ts                     # DialogueEntry / DialogueProfile / DialogueAgentInput / BatchLineResult
├── profile.ts                   # PROFILE_TEXT_KEYS / normalizeProfile / toProfileRecord（与 characters 单一来源）
├── persona.ts                   # buildCharacterAgentPrompt / buildNarratorAgentPrompt（角色/旁白 persona 段）
├── agents.ts                    # 角色 / 旁白 Agent 注册（对话专用 Agent 定义）
├── context.ts                   # 白名单装配（buildPublicContext / 他人仅公开身份摘要）——防串味
├── assemble.ts                  # assembleDialogueHtml（条目 → 章节 HTML；orderIndex 保序）
├── generate.ts                  # generateLine（单条）/ toCharacterOptions / toNarratorOptions / generateBatch
├── cost.ts                      # estimateDialogueCost / selectParticipants（majorOnly 过滤）
├── concurrency.ts               # DEFAULT_DIALOGUE_CONCURRENCY=3 / runWithConcurrency（工作池）
├── review-bridge.ts             # assembleDialogueText / toDialogueReviewInput（**可选**对齐 stage-06）
└── index.ts

src/store/dialogueStore.ts       # 会话内存：entries / running + add/insert/update/remove/move/clear
src/features/dialogue/           # UI
├── DialoguePanel.tsx            # 面板：选角 → 生成 → 历史 → 合并 → （可选）评审
├── NarrationComposer.tsx        # 旁白生成入口
├── CharacterLineComposer.tsx    # 角色选择 + 台词生成入口
├── DialogueEntryList.tsx        # 会话条目视图（对话/旁白）
├── useDialogue.ts               # 编排：generateNarration / generateCharacterLine / generateBatchLines（并发）/ stop
├── useSceneContext.ts           # 场景上下文装载（设定卡 + 前章末尾 + 场景指令），供装配四块（BUG-001 修复）
├── useDialogueCost.ts           # 启动前成本预估（参与角色数 × 输出上限）
└── useMergeDialogue.ts          # 双路径落章：主「新建下一章」/ 次「替换当前章」（强制快照）
```

## 核心 API / 约定

- **条目模型（`dialogueStore`，会话内存）**：`{ kind: "narration" | "dialogue", speakerId?, speakerName?, content, orderIndex }`；
  `orderIndex` **恒连续**（增删移动后重排），`assembleDialogueHtml` / `assembleDialogueText` 按 `orderIndex` 升序输出。
- **防串味（T5，白名单装配）**：`buildCharacterAgentInput` 仅注入 —— **本人 persona 全文** + **公共上下文** +
  **他人公开身份摘要**；`context.ts` 提供 `buildPublicContext()`；**A 的私密档案永不进入 B 的 prompt**（5 组断言覆盖）。
- **生成（非流式收口）**：`generateLine` 单条；`generateBatch` 经 **`runWithConcurrency`**（默认并发 3，超限排队，
  **结果按输入序归位**，单项失败不抛穿，失败项 `ok=false`）——每项**仅经白名单装配**（与单条路径一致）。
- **成本与并发（T6）**：`estimateDialogueCost(participantCount)` = 参与角色数 ×（输出上限 `2048` + 输入估算 `1024`）
  （复用 stage-08 `estimateCost`，note 口径明示），**启动前显示**；`selectParticipants(characters, { majorOnly })`
  按 `profile.major` 过滤；并发上限 UI 可调（默认 3）。
- **双路径落章（T3）**：**主路径「新建下一章草稿」**（`chapter.create`，**不改当前章**）；
  **次路径「替换当前章」**（`replaceContent` 单条撤销）**替换前强制入池快照**（version label `dialogue-merge-safety`）；
  两路径均经**内联二次确认**。
- **评审衔接（T7，可选）**：`review-bridge.ts` —— `assembleDialogueText(entries)`（去 HTML 标签、`说话人：内容`）与
  `toDialogueReviewInput({ entries, dimension, model, context })`（**对齐 stage-06 `ReviewInput`**，维度复用
  `REVIEW_DIMENSIONS`）；面板「评审台词（可选）」经 **stage-06 既有管线**（`evaluateWithFallback` + 内置评估器）评审，
  **不新增评估器、不改 stage-06 契约**；「千人一腔」与 `humanity`「真人感」**互认**（见 `docs/review-rubric.md` §4.1）。
- **IPC**：**零增量**——复用 `http_stream`（非流式收口）+ `chapter` 命令；对话条目**会话内存、不落库**。

## 关联文档

- 编排引擎：`.openfeel/manual/orchestration/engine.md`（`dialogue/` 子结构）；角色档案：`.openfeel/manual/features/characters.md`。
- 评审 rubric：`docs/review-rubric.md` §4.1（千人一腔互认）；命令面：`docs/ipc.md`（**无增量**）。
- 落点：`docs/structure.md` §17；构建体积：`docs/build-size-report.md` §七。
