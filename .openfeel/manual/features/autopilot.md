# 模块手册：全自动创作（features/autopilot）

## 职责

FateQuill 的**无人值守全自动创作**域（**可续跑**）：给定**大纲（每行一章）**后，按**每环节决策规则表**串起
「**推演多温度择优 → 生成 → 审查 → 重写（≤ N）→ 过阈 / 降级收录 → 自动归档**」，全程**零人工交互**；
**熔断三层**（预算 / 连续失败 / 总章数）任一触发**即停并出报告**；**迁移 v6** 断点落库 → **中断后续跑**（已完成章不重跑）；
遇一致性冲突默认「**暂停 + 通知**」，用户显式授权后可「**自动 `ignored` 继续**」（两条路径**均落 `conflict_record` 留痕**）。建立于 **v0.6.0-stage-12**。

分层：决策 / 熔断 / 冲突策略为**纯函数**、链路编排在 `src/orchestration/autopilot/`（**依赖全注入**：`streamFor` / `evaluators` / `archiveFn` / `persistence` / `detectConflicts` / `conflictSink`）；
进度态在 `src/store/autopilotStore.ts`（**单源**）；UI 在 `src/features/autopilot/`（第三栏 `autopilot` tab）；断点持久化经**迁移 v6** + **5 条 IPC 命令**。

## 目录结构 / 关键文件

```
src/orchestration/autopilot/   # 契约 + 纯函数 + 编排（不 import @/ipc / store）
├── types.ts                   # AutopilotConfig / AutopilotChapterInput / ChapterOutcome / RunOutcome
│                              # AutopilotDeps（注入端口）/ AutopilotPersistence / AutopilotConflictSink / SettledChapter
├── decide.ts                  # 决策规则表：pickBranch / shouldRewrite / markDegraded / shouldAutoConfirmArchive / isPassed
├── breaker.ts                 # 熔断三层：checkBreakers（预算 / 连续失败 K / 章数）+ estimateTokens
├── conflict-policy.ts         # 冲突策略：decideConflictPolicy（pause / ignore-continue）+ conflictKey
├── chain.ts                   # runChapter（推演择优 → 生成 → 审查 → 重写 → 判定 → 归档）
│                              # runAutopilot（逐章串行 + 熔断 + 冲突策略 + 断点落库 + **续跑**）
└── index.ts

src/store/autopilotStore.ts    # 进度态（单源）：status / currentIndex / chapters / report / autoIgnoreConflicts + 动作
src/features/autopilot/
├── AutopilotPanel.tsx         # 大纲 + 配置（章数 / 重写轮数 / 阈值 / 归档自动确认 / **冲突策略授权**）+ 启动/停止
│                              # + 进度与报告 + **暂停通知区**（`autopilot-paused`）+「继续上次」（`autopilot-resume`）
├── parse-outline.ts           # 大纲解析（每行一章；`标题：指令`）
├── useAutopilot.ts            # **真机依赖装配**（provider / stage-06 注册表 / 分级注入上下文 / stage-11 归档 + 冲突端口 + 迁移 v6 持久化）
└── useAutopilotRun.ts         # 编排 runAutopilot → store；**resume(runId)**（载入断点 → 跳过已完成章）

src-tauri/migrations/0006_autopilot.sql   # autopilot_run + autopilot_chapter（UNIQUE(run_id,order_index)）+ 索引
src-tauri/src/db/autopilot.rs             # save_run/get_run/list_runs + save_chapter(upsert)/list_chapters
```

## 核心 API / 约定

- **`runAutopilot({ outline, config, deps, onProgress?, signal?, runId?, completed?, spentTokens? })`** → `RunOutcome`：
  逐章串行、**零人工交互**（不 await 任何用户输入）；单章异常 → **降级收录 + 原因，不阻塞续跑**；
  `RunOutcome = { chapters, passed, degraded, aborted, conflicts, trippedBy?, trippedDetail? }`。
- **决策规则表（纯函数）**：`pickBranch`（**审查加权总分最高**；同分取先出现；全未评分 → `null` 回退无推演生成）、
  `shouldRewrite(score, threshold, round, max)`、`markDegraded(reason)`、`shouldAutoConfirmArchive(config)`、`isPassed`。
- **熔断三层**：`checkBreakers({ spentTokens, consecutiveFailures, producedChapters }, config)` → 顺序 **预算 → 连续失败（K 默认 3）→ 章数**；
  触发即停，原因入 `RunOutcome.trippedBy`（`budget` / `consecutive-failure` / `max-chapters` / **`conflict`**）。
- **冲突策略**：`decideConflictPolicy({ conflict, pauseOnConflict })`——**默认** `pause`（`status:"open"` 留痕 + 暂停 + 通知）；
  **显式授权**（`pauseOnConflict:false`）→ `ignore-continue`（`status:"ignored"` + `action:"ignore"` 留痕 + 继续）；
  两路径均经端口落库（真机 = `save_conflict_record` / `resolve_conflict_record`）；同一冲突 `(aId,bId,type)` **去重**。
- **断点与续跑**：run 起点 `running` → 每章起点 `running` / 终点 `done|degraded`（含 `score` / `degradedReason` / `attempt` = 重写轮数）
  → 终态 `completed` / **`paused`（熔断，可续跑）** / `aborted`；`config_json` 落 `{ config, outline }` 供 `resume(runId)` 恢复；
  **已完成章（`done`/`degraded`）不重跑**（seed 报告 + 跳过）。
- **复用既有契约（不重写）**：`buildChapterPrompt`（stage-05 装配）、`runExploration`（stage-08 多温度）、
  `evaluateWithFallback` + `rewriteChapter` + `weightedTotal`（stage-06 审查与重写）、`runExtraction` + 分级注入 + `conflict_record`（stage-11）。
- **IPC**：**新增 5 命令**（`save/get/list_autopilot_run` + `save/list_autopilot_chapter`）+ **迁移 v6**（op-004 落地，计数 51→56 / 53→58）。
- **开关单源**：进度与授权开关均在 `autopilotStore`（`status` / `currentIndex` / `chapters` / `report` / `autoIgnoreConflicts`），**无本地运行态 `useState`**。
- **边界**：本域**不含**章节落库与正文写入（产出为章正文文本 + 断点记录）；`autopilot_chapter.chapter_id` 当前恒 `null`（留后续接线）。

## 关联文档

- 编排引擎：`.openfeel/manual/orchestration/engine.md`（`autopilot/` 子结构）；命令面：`docs/ipc.md` §8.1（autopilot 5 命令）。
- 复用契约：`.openfeel/manual/features/{exploration,review,generation,consistency}.md`。
- 落点：`docs/structure.md` §20、§21（开关矩阵）；总清算：`.openfeel/plan/v0/stage-12/clearance.md`。
