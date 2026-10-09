# 模块手册：推演（features/exploration）

## 职责

FateQuill 的**多温度并行推演域**：同一模型 × 一组温度（默认 `{0.3, 0.7, 1.1}`）**并行**推演多种可能走向，
产出结构化**走向卡**；支持**分支对比（差异标注）**、**克制收敛（偏离标注 + 降权）**、
**双路径采纳（新建下一章 / 替换当前章，含防丢失安全网）**与**失败处理（部分结果 + 单独重试 + abort 全停）**。
建立于 **v0.3.0-stage-08**。

分层：契约与算法在 `src/orchestration/exploration/`（provider 无关）；会话态在 `src/store/explorationStore.ts`；UI 在 `src/features/exploration/`；**无新增 IPC**（复用 `http_stream`，非流式收口）。

## 目录结构 / 关键文件

```
src/orchestration/exploration/   # 契约与算法（provider 无关）
├── types.ts                     # TurnCard / BranchStatus / BranchDeviation / ExplorationBranch
├── temperature.ts               # DEFAULT_TEMPERATURES / PROVIDER_TEMPERATURE_RANGE / clampTemperature / load-save
├── parse.ts                     # TURN_CARD_SYSTEM_PROMPT / parseTurnCard（JSON 容错）
├── runner.ts                    # runExploration（并行 + 并发上限 + 乱序归位 + 单分支容错）
├── diff.ts                      # diffBranches（keyTurns 精确集合差）
├── converge.ts                  # converge（覆盖率 + 存在性校验 → 标注 + 降权，不删不改）
├── cost.ts                      # estimateCost（分支数 ×（输出上限 + 输入估算））
└── index.ts

src/store/explorationStore.ts    # 会话内存：intent / temperatures / branches / running / selected / collapsed
src/features/exploration/        # 推演 UI
├── ExplorationPanel.tsx         # 意向 + 温度 + 并发 + 成本 + 运行/停止 + 分支对比区
├── TemperatureConfig.tsx        # 温度集增删/调值（localStorage 持久化）
├── useExploration.ts            # 编排：装配 → runExploration（并发）→ converge → store；retryBranch / abort / cost
├── build-exploration-options.ts # 复用 stage-05 装配：约束进 system、intent 进 user；返回注入设定卡 id 集
├── BranchCompare.tsx            # 并排（weight 降序 / 温度并列）+ 差异图例
├── BranchCard.tsx               # 走向卡 + 差异标注 + 偏离标注 + 采纳/替换/丢弃/重试 + 二次确认
├── ConfirmInline.tsx            # 内联二次确认（避免 window.confirm）
├── render-turn-card.ts          # 走向卡 → HTML 草稿
└── useAdoptBranch.ts            # 双路径采纳（主：新建下一章；次：替换 + 强制入池快照）+ 丢弃
```

## 核心 API / 约定

- **温度集与 clamp**：默认 `{0.3, 0.7, 1.1}`；per-provider 区间（`openai-compatible [0,2]` / `anthropic [0,1]` / 未知 `[0,2]`）；越界分支以 `effectiveTemperature` + `clamped` **显式标注**；持久化 `localStorage['fatequill.exploration.temperatures']`。首版**同模型多温度**。
- **编排**：`runExploration` **并行**、`concurrency` 默认 3（超限排队）、**结果按输入顺序归位**（乱序完成不影响）、单分支失败置 `error` 不抛穿；`abort` **全停**（在跑分支经 signal 退出、排队分支不再启动）。
- **输入**：复用 stage-05 `buildChapterPrompt`（预算/裁剪）；**设定约束并入 system 段**（生成期收敛第一层），**走向意向为 user 段**。
- **产出**：走向卡 `{ summary, keyTurns, settingCardIds }`（非流式收口 + JSON 容错）。
- **收敛（产出期第二层）**：覆盖率 = 有效引用 ∩ 注入集 / 注入集；**存在性校验**过滤**幻觉引用**（记入 `invalidSettingCardIds`）；`flagged = 低覆盖 ∨ 有无效引用 ∨ 低贴合度`；**仅降权 + 标注**（`weight` / `deviation`），**不过滤不删**；终选权归用户。
- **采纳（REV-007 安全网）**：**主路径「新建下一章草稿」**（`chapter.create`，**不改当前章** → 无 DB 丢失）；**次路径「替换当前章」**（`EditorController.replaceContent` 单条撤销）**替换前强制入池快照（必做）**；两路径均经**内联二次确认**；丢弃 = 会话分支移除（无残留）。
- **成本**：`estimateCost = 分支数 ×（输出上限 2048 + 输入估算 1024）`（输入侧 N 倍，每分支重复发送），**启动前显示**并注明口径。
- **卦象引导可选注入（stage-09 T5，跨阶段扩展）**：`buildExplorationOptions` 增 **`hexagramGuide?: { text: string }`**——开启易经且已起卦时，把 `renderGuideText(buildGuideCard(casting))` 并入 **system 约束段**；**缺省/未传 → 输出与基线逐字段一致（无空段残留），且 `buildGuideCard`/`renderGuideText` 零调用**（关闭零副作用）。卦象引导**不进入 `converge` 的设定卡覆盖判据**（设定卡约束最高优先；`settingCardIds` 不变）。开关 `useIChingEnabled`（`localStorage['fatequill.iching.enabled']`，**缺省关闭**，不做强制前置）。

## 关联文档

- 编排引擎：`.openfeel/manual/orchestration/engine.md`；生成装配：`.openfeel/manual/features/generation.md`。
- 安全网（版本池）：`.openfeel/manual/features/review.md`；编辑器命令面：`.openfeel/manual/features/editor.md`。
- 落点/命令面：`docs/structure.md` §15、`docs/ipc.md`（推演复用 `http_stream`，**无新命令**）。
- 构建体积：`docs/build-size-report.md`。
