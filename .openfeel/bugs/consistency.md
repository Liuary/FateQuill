# Bug 追踪：consistency（设定分级与一致性）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/consistency/`。

## closed

### BUG-001：归档面板 `ArchivePanel` 未接入任何 UI + 设定卡表单无 `tier`——「手动归档本章 + 四级分级入库」应用内完全不可达（high）
- **阶段**：v0.5.0-stage-11（收口 / BUG-001）｜**关联**：plan/DoD 第 1 条「新设定可手动归档并分入四级」、T2「手动归档本章」；与 stage-07 REV-018 / stage-07 BUG-001 / stage-09 BUG-001 / stage-10 BUG-001 **同类根因（「生产不可达 / 功能无入口」跨阶段第 4 次复发）**
- **现象**：`src/features/consistency/ArchivePanel.tsx`（含「归档本章」按钮、候选待确认列表、分级下拉、确认入库）**已实现且有单测**（`useArchiveChapter.test.ts`），但**未被任何组件挂载**——`src/features/editor/WorkspaceLayout.tsx` 的 `consistency` tab 分支**仅渲染** `<ConsistencyPanel />`（`rg "ArchivePanel" src` 仅命中自身 + 单测）；`SettingCardForm.tsx` 表单仅含 `title`/`content`/`kind`，**无 `tier` 字段**。→ `runExtraction`/`archiveStore`/`save_extracted_settings`/分级下拉等 **T2 交付物生产零调用**，「手动归档并分入四级」（DoD 1）与「候选不入库直达 → 用户确认」（DoD 3 用户流程）在真实应用中**无法执行**。
- **根因**：**「契约先行、UI 后接」的交付在跨 op 交接处静默断裂**——`op-005` 修正记录 #11 曾声明「`ArchivePanel` 的 tab 接入随本 op 一并可用」，**实际未落地**（声明与实现不符）；既有测试只覆盖 `useArchiveChapter`（hook）与 `ArchivePanel` 逻辑，**未覆盖「面板被生产挂载」** → `pnpm test` 112 文件 / 579 用例全绿仍漏报。
- **影响**：DoD 1 **核心不满足**；DoD 3 实现（结构/回查/去重/待确认队列）经单测成立但用户可达流程受阻。**不受影响（实测确认）**：迁移 v5 幂等、`tier` 与 `kind` 正交、`evidence` 回查剔除、名称去重、L1 规则 / L2 建议标注、误报率样本集、冲突四动作与 `conflict_record` 落库跨会话可查、三处装载点暗线硬隔离、IPC 计数 51/53、i18n、遗留登记。
- **修复**（commit `5e1f2a6`）：① **生产挂载**——`WorkspaceLayout` 的 `consistency` 分支改为 `<div data-testid="consistency-tab">` **双区**：`<ArchivePanel novelId chapterId />`（归档区在上）+ `<ConsistencyPanel novelId />`（冲突区在下）；② **表单分级**——`SettingCardForm` 新增 `<select data-testid="setting-card-tier">`（`SETTING_CARD_TIERS` 四级，缺省 `DEFAULT_SETTING_CARD_TIER`=`short`，编辑以 `initial.tier` 为初值），`SettingCardInput` 增必填 `tier` 并贯通 `create`/`update`，列表项展示 `kind · tier · content`；③ i18n `settingCards.json`（zh/en）补 `tier` + `tiers.{main,dark,short,temp}`。**零新增依赖 / 无迁移 / 无新命令**（复用既有组件与 IPC）。
- **验收**：openfeel-reviewer 修复复审 + openfeel-feel-tester **独立回归复验（不轻信声明）**——**独立探针**（`__stage11_regress_probe.test.tsx`，用后删除、`git status` 无残留）走**真实 `WorkspaceLayout` 生产渲染树**：切「一致性」tab → `archive-panel` + `consistency-panel` + `archive-button` **同时挂载**；点「归档本章」→ 真实 `runExtraction` → 候选渲染且**未落库直达**；点「确认入库」→ `save_extracted_settings` 被调用且 `items` 的 `tier` = `["main","dark"]`；「设定卡」tab 选 `dark` → `create_setting_card` 参数 `tier="dark"`。门禁 `pnpm test` **587 passed / 114 files**、`cargo test` **59 passed**、lint 0 error、build 退出码 0、`git diff` 对 `package.json`/`pnpm-lock.yaml` 全空。状态 **closed**（2026-10-10 06:36）。DoD 1 恢复满足，**stage-11 最终验收通过**。
- **经验**：**「测试全绿」不等于「用户可达」**——凡「契约先行、UI 后接」的交付，收口须逐条核验生产可达性（生产调用非零 + 挂载断言 + 状态单源 + 占位替换 + 表单贯通）；沉淀为**跨阶段收口检查清单**（详见 `kb/troubleshooting.md`「生产不可达跨阶段复发」、`kb/patterns.md`「单源装配」）。

## open / fixing / resolved

- （无）
