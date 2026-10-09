# v0.4.0-stage-10

## 目标

实现角色 Agent 多声部对话：**旁白 Agent + 每角色独立 Agent**，旁白/对话**分离创作**、**用户主导轮次编排**、**防串味上下文隔离**、**双路径合并落章**（复用 stage-08 安全网）。
（v2：依据 REV-v0.4.0-stage-10 按 v2 范式重写；见 `plan.md`。）

## 依赖

- v0.1.0-stage-03（引擎，硬，已归档）
- v0.1.0-stage-05（生成闭环，硬，已归档）
- v0.5.0-stage-11（**反向依赖**：stage-11 依赖本阶段的 persona 契约）

## 遗留处置

- stage-08 **REV-009**（快照持久化路线）→ 本阶段合并次路径**沿用同一安全网范式 + 衔接声明**。
  - **衔接声明（op-001 登记）**：次路径「替换当前章 / 合并落章」继续沿用 **会话内存快照**（`reviewStore.versions`）作为安全网；**持久化路线（迁移 v5 / 本地文件）仍随 REV-009 跟踪**，本阶段**不实现**。
- stage-08 **REV-010**（abort 语义 / 新章落卷末）→ 复用/归属声明。
  - **归属声明（op-001 登记）**：本阶段主路径同为「**新建下一章**」→ **复用其语义**（固定追加当前卷末）；「`abort` 分支 `error="aborted"` 未特判」仍归 **stage-10 后续 op 或人工协验批处理**。
- stage-09 **REV-009**（组合用例 + `kind` 治理）→ **首个 op `(chore)`** 清理。
  - **已清理（op-001）**：① 新增 `src/features/exploration/iching-injection.integration.test.ts`（起卦 → 开关 → 装配 → 运行组合链路；开启含卦象 / 关闭零副作用）；② `SETTING_CARD_KINDS` 受控枚举 + `SettingCardForm` 下拉化（历史自定义值**保留不丢**）。
- v0.2/v0.3 人工协验 **BLOCKED** → 保持跟踪（不阻塞；闭合后 M2 达成）。

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 遗留清理与结构/IPC 文档回写（stage-09 REV-009 + stage-08 衔接）(chore) | T7（并入首 op） | — |
| op-002 | 角色 Agent 生成器与 persona 契约 | T1 | op-001 |
| op-003 | 旁白/对话分离创作与 dialogueStore | T2 | op-002 |
| op-004 | 多声部合并与落章双路径 | T3 | op-003 |
| op-005 | 角色管理面板与 profile 字段约定 | T4 | op-002 |
| op-006 | 上下文隔离（防串味）装配 | T5 | op-002 |
| op-007 | 成本与并发控制 | T6 | op-002、op-003 |
| op-008 | 台词评审衔接与 manual 文档收尾 | T7（收尾） | op-003~op-007 |

> T1~T7 全覆盖：T7 拆为**首 op（遗留清理，op-001）** + **末 op（评审衔接与文档终稿，op-008）**（模块建立后方可写详文，遵守「未建立模块不提前占位」约定）。

### 定稿要点（摘要）
- **运行机制**：场景上下文 = 设定卡 + 前后文 + 用户场景指令 + **公共对话历史**；**用户主导轮次**；白名单=本人 persona（完整）+ 公共场景 + 对话历史，**不含他人 persona 全文**（仅公开身份一行摘要）；串味判据=装配层断言 prompt 不含他人私有。
- **角色数据**：`profile` JSON（零迁移）定稿 `{identity,personality,speechStyle,goal,extra,major?}`；persona 模板 `buildCharacterAgentPrompt`；**交付契约给 stage-11**（不回改）。
- **产物**：`dialogueStore` 会话内存条目 `{id,kind,speakerId?,speakerName?,content,orderIndex}`；格式 `<p class="dialogue|narration">`；合并**双路径**（新建下一章 / 替换当前章 + 确认 + 强制快照 + 单撤销）。
- **IPC/持久化**：**无 IPC 增量**（复用既有 character 命令）；对话条目会话内存 + 合并落库；**无迁移 v5**；`estimateCost` 复用 + `major` 过滤。
- **i18n** `characters`/`dialogue`。

### 待用户拍板（建议默认）
① 轮次编排=用户主导（建议）② 存储=方案 A（建议）③ 合并落点=双路径（建议）。

### 需 schemer 落实
op 拆分（首 op 含遗留清理，标 `(chore)`）；文档回写（`docs/structure.md`/`docs/ipc.md`/`manual/index.md`）；台词可选接入 stage-06 评审的接口对齐。

### schemer 落实结果
- **op 拆分**：8 个 op（见上表）；**首 op op-001 `(chore)`** 并入 T7 遗留清理（stage-09 REV-009：起卦→注入组合用例 + `SettingCardForm.kind` 枚举治理）+ stage-08 REV-009/010 衔接登记 + 结构/IPC/索引回写；**末 op op-008** 完成 `manual/features/{characters,dialogue}.md` 终稿与评审衔接。
- **遗留清理（REV-009）**：① 新增 `iching-injection.integration.test.ts`（组合链路，开启含卦象/关闭零副作用）；② `SETTING_CARD_KINDS` 值域收敛 + `SettingCardForm` 下拉化（旧值保留不丢）。
- **文档回写**：`docs/structure.md` §17、`docs/ipc.md`（无增量声明）、`manual/index.md`（characters/dialogue 登记）+ `manual/features/{characters,dialogue}.md`、`manual/orchestration/engine.md`（`dialogue/`）。
- **审查衔接**：`src/orchestration/dialogue/review-bridge.ts` 对齐 stage-06 `ReviewInput`（**不新增评估器**）；「千人一腔」与 humanity/真人感互认登记于 `docs/review-rubric.md`。
- **边界纪律**：零新增依赖、无迁移 v5、无 IPC 增量（复用 character 五命令 + chapter 命令）；op-001 的 `\|` 自检已排除（统一 `rg -n -e A -e B`）。
