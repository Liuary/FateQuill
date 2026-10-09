# v0.4.0-stage-10 详细计划：角色 Agent 多声部对话

> 修订：v2（2026-10-10，依据 REV-v0.4.0-stage-10 的 5 条审查意见按 stage-07/08/09 v2 范式重写）。

## 归属版本
v0.4（多声部）

## 目标
把「一个 Agent 写全文」升级为「**旁白 Agent + 每角色独立 Agent**」的多声部协作：旁白/对话**分离创作**、**用户主导轮次编排**、**防串味上下文隔离**、**双路径合并落章**。

## 对应核心目的
- 目的 1：增强角色区分度与对白真实感。
- 目的 2：多声部天然抵抗「千人一腔」的 AI 味，服务去 AI 味目标。

## 前置依赖与遗留处置
- v0.1.0-stage-03（引擎）、v0.1.0-stage-05（生成闭环）——硬依赖；v0.5.0-stage-11 为**反向依赖**（见「与 stage-11 边界」）。
- **遗留处置（修订 REV-005④）**：
  - **stage-08 REV-009（次路径快照=会话内存级 → 持久化路线）**：本阶段合并次路径**沿用同一安全网范式**（会话内存快照），**衔接声明**——持久化路线仍随该 REV 跟踪，不在本阶段实现。
  - **stage-08 REV-010（abort 语义 / 主路径新章追加卷末）**：本阶段合并主路径同为「新建下一章」，**复用其语义**；若未闭合则由本阶段一并受益/登记（归属声明）。
  - **stage-09 REV-009（起卦→注入组合用例 + `SettingCardForm.kind` 枚举治理）**：并入本阶段**首个 op `(chore)`** 清理。
  - v0.2/v0.3 人工协验 **BLOCKED**：保持跟踪、不阻塞本阶段。
- **审查衔接（修订 REV-005⑥）**：**台词评审可选**接入 stage-06 评审管线；**合并后章节**走既有评审（四维）；「千人一腔」判据与 stage-06「真人感」、stage-07 判据**互认**（登记同一 rubric 引用）。

## 技术约束（本阶段适用，定稿）

### 多声部运行机制（定稿，修订 REV-001）
- **场景上下文构成**：设定卡（经 stage-05 装配）+ 前章末尾 / 当前章正文 + 用户**场景指令** + **公共对话历史**（结构化 `[{ speaker, content }]`）。
- **轮次编排（v0.4 定稿）**：**用户主导**——选中角色 → 生成该角色台词 → 追加到公共对话历史 → 可反复；**「导演式自动编排」留待拍板/后续**（符合「克制」哲学与 C-08）。
- **上下文白名单（显式化）**：每个角色 Agent 输入 = **本人 persona（完整）** + **公共场景** + **公共对话历史**；**不含他人 persona 全文**（可含他人**公开身份一行摘要**）。
  - 可共享：场景设定、已定稿对话（`{speaker, content}`）、旁白、他人公开身份摘要。
  - 私有（不共享）：他人 persona 细节、内心独白、秘密。
- **「串味」判据（可判定）**：单测构造「角色 A persona 含秘密 `X`」场景 → 断言**角色 B 的 prompt 不含 `X`**（装配层断言）；产出文本可选做关键词检查（如适用）。
- **「符合人设」判据**：persona 关键要素（身份/语气词）**在台词 prompt 中注入断言**（自动判据 = prompt 构造正确性）；**语义符合度**走 stage-06 评审人工协验。

### 角色数据模型与 persona 契约（定稿，修订 REV-002）
- **零迁移方案 A**：`character.profile` 为 **JSON**（定稿最小字段：`{ identity, personality, speechStyle, goal, extra, major? }`，值为自由文本；`major: boolean` 供「仅主要角色」过滤）。
- **persona 装配模板**：`buildCharacterAgentPrompt(profile, 公共上下文)`（persona **完整注入本人 Agent**）；**旁白 Agent** = 叙述者 persona + 同装配链，**仅 system 差异**。
- **与 stage-11 边界（显式化）**：stage-10 **交付「persona 装配输入契约」**（Agent 只依赖 `profile` 的约定字段）；stage-11 的设定分级**在该契约之上**做结构化供给，**不回改 stage-10**。
- **角色 CRUD UI 落点**：`src/features/characters/`（复用既有 `list/get/create/update/delete_character` 命令）。

### 产物形态与合并算法（定稿，修订 REV-003）
- **条目结构**：`{ id, kind: "dialogue"|"narration", speakerId?, speakerName?, content, orderIndex }`（**会话内存** store `dialogueStore`，同 stage-08 `explorationStore` 范式）。
- **顺序来源**：条目 `orderIndex`（UI 可上移/下移/插入）；「顺序正确」= **按条目序拼接的单测断言**。
- **格式规范（单一规范，样式由 CSS 承担）**：
  - 对话：`<p class="dialogue"><strong>{speakerName}</strong>：{content}</p>`
  - 旁白：`<p class="narration">…</p>`
- **合并落点（复用 stage-08 双路径，避免重复踩坑）**：
  - **主路径「新建下一章草稿」**（`chapter.create`，**不改当前章**，不适用 `Ctrl+Z`）；
  - **次路径「替换当前章」**（`EditorController.replaceContent`，**确认 + 强制入池快照** + **单撤销**，`Ctrl+Z` 归此）。

### IPC / 持久化 / 成本（定稿，修订 REV-004）
- **IPC 影响**：character 命令**现状已具备** `list_characters / get_character / create_character / update_character / delete_character`（`docs/ipc.md` 已登记）——**无 IPC 增量**；在 `docs/ipc.md` 声明「复用既有命令」。
- **对话条目 = 会话内存 + 合并落库（方案 A）**：多声部对话历史**不落库**，**合并后的正文才是资产**。
- **迁移 v5 = 不新增**（`profile` JSON 方案）。
- **成本机制**：复用 stage-08 `estimateCost` 范式（**分支数 = 本场景参与角色数 × 输出上限**），**启动前显示**；「仅主要角色」= `profile.major` 标记过滤。

### 结构与可判定（定稿，修订 REV-005）
- **C-07**：任务表含「交付物路径 + 可判定验证标准」两列。
- **C-11（i18n）**：启用 **`characters`**（角色面板）与 **`dialogue`**（多声部编排）命名空间（zh-CN/en）。
- **文档回写**：`docs/structure.md`（`src/features/characters/`、`src/features/dialogue/`、`src/orchestration/dialogue/`、`src/store/dialogueStore.ts` 落点）、`docs/ipc.md`（声明无增量）、`manual/index.md`（归档阶段登记 characters/dialogue 模块）。

## 任务表

| # | 任务 | 交付物（路径锚点） | 验收标准（可判定） | 依赖 |
|---|------|--------------------|---------------------|------|
| T1 | 角色 Agent 生成器与 persona 契约 | `src/orchestration/dialogue/`（`buildCharacterAgentPrompt` + 角色/旁白 Agent 注册） | persona 关键要素**注入断言**；角色台词 prompt 构造正确；生成器可注册/替换 | stage-03 |
| T2 | 旁白 / 对话分离创作 | `dialogueStore`（会话内存条目）+ 分离生成面板（`src/features/dialogue/`） | 旁白与对话**可分别生成、分别编辑**；条目增删改可判定 | stage-05 |
| T3 | 多声部合并与落章（双路径） | 合并器 + 格式规范 + 双路径落点 | **按 `orderIndex` 拼接正确**（单测）；格式统一（`<p class="dialogue|narration">`）；主/次路径断言（主：新章生成/当前章不变；次：确认+快照+单次 `Ctrl+Z`） | T2, stage-04 |
| T4 | 角色管理面板 | `src/features/characters/`（复用 character 命令）+ `profile` 最小字段约定 | 角色 CRUD 可用且持久化；`profile` 字段被对应 Agent 引用（断言） | stage-02 |
| T5 | 上下文隔离（防串味） | 上下文白名单装配（`src/orchestration/dialogue/`） | 构造「角色 A 秘密 X」→ **角色 B prompt 不含 X**（装配断言）；角色输入仅含公共场景 + 对话历史 | T1 |
| T6 | 成本与并发控制 | `estimateCost` 复用 + 并发上限 + 「仅主要角色」过滤 | 成本预估**启动前显示**（口径注明）；并发超限排队；`major` 过滤生效（断言） | T1 |
| T7 | 遗留登记与文档回写（并入首个 op，标 `(chore)`） | 登记 + 文档补丁 | stage-08 REV-009 衔接 / REV-010 归属声明；**stage-09 REV-009** 清理；`docs/structure.md`/`docs/ipc.md` 更新 | — |

## 阶段验收标准（DoD，即 M4）
- [ ] **每角色独立 Agent** 可创建并生成差异化台词（persona 注入断言）（REV-001/002）。
- [ ] **旁白/对话分离**创作与编辑，**合并按 `orderIndex` 顺序正确**、格式统一（REV-003）。
- [ ] **合并双路径**：主路径新章无损 / 次路径确认 + 强制快照 + 单次 `Ctrl+Z`（REV-003）。
- [ ] **上下文隔离可验证**：角色 B prompt 不含角色 A 私有秘密（装配断言）（REV-001）。
- [ ] **轮次编排 = 用户主导**（选中角色生成、追加历史、可反复）；导演式留待拍板（REV-001）。
- [ ] 角色设定**持久化**并驱动其 Agent；`profile` 最小字段约定落地（REV-002）。
- [ ] **零迁移**、**无 IPC 增量**（复用既有 character 命令）；对话条目会话内存、合并落库（REV-004）。
- [ ] 成本预估（参与角色数 × 输出上限）**启动前显示**；并发可控；`major` 过滤（REV-004）。
- [ ] i18n `characters`/`dialogue` 命名空间启用（REV-005）。
- [ ] 与 stage-11 边界：**交付 persona 装配输入契约**（stage-11 在其上结构化，不回改本阶段）（REV-002）。
- [ ] 遗留登记（stage-08 REV-009/010 衔接、stage-09 REV-009 清理）完成（REV-005）。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「多声部运行机制」场景上下文/轮次编排/白名单/串味判据 + T1/T2/T5；DoD 1/4/5 |
| REV-002 | high | ✅ | 技术约束「角色数据与 persona 契约」profile JSON/边界/persona 模板/落点 + T4；DoD 6/10 |
| REV-003 | medium | ✅ | 技术约束「产物形态与合并算法」条目结构/顺序/格式/双路径 + T3；DoD 2/3 |
| REV-004 | medium | ✅ | 技术约束「IPC/持久化/成本」命令现状/会话内存+合并落库/无迁移/estimateCost + T6；DoD 7/8 |
| REV-005 | low | ✅ | 任务表两列 + i18n/文档回写 + 遗留处置节 + 审查衔接 + 待拍板/需 schemer；DoD 9/11 |

## 风险与备注
- **千人一腔**：多声部为**结构性缓解**，非根治；判据与 stage-06「真人感」/stage-07 互认，语义符合度依赖人工协验。
- **成本放大**：M 角色 × K 轮次 = 多次 LLM 调用；`estimateCost` 启动前显示 + 并发上限 + `major` 过滤缓解。
- **防串味依赖装配层正确性**：自动判据为「prompt 不含他人私有」，**不保证产出语义**（语义走评审协验）。
- **合并双路径**：直接复用 stage-08 REV-007 范式（主路径无损优先、次路径双确认 + 强制快照），**不重复踩坑**。
- **persona 字段为约定非强约束**：`profile` 自由文本，缺失字段时装配降级（不阻断）。
- **stage-11 边界**：本阶段只提供契约，不得内联设定分级逻辑（避免返工）。

## 待用户拍板（建议默认值）
1. **轮次编排模式**：建议默认**用户主导**（导演式自动编排留待后续）。
2. **对话条目存储方案**：建议 **方案 A**（会话内存 + 合并落库），不新增迁移 v5。
3. **合并落点**：建议**双路径**（主「新建下一章草稿」/ 次「替换当前章 + 确认 + 强制快照 + 单撤销」），复用 stage-08 先例。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T7（遗留清理）**（标 `(chore)`）。
2. 文档回写：`docs/structure.md`（characters/dialogue/orchestration/store 落点）、`docs/ipc.md`（声明复用既有 character 命令、无增量）、`manual/index.md`（归档阶段登记 characters/dialogue 模块）。
3. 审查衔接落地：台词可选接入 stage-06 评审管线的接口对齐（留 schemer 细化）。
