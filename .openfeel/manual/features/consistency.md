# 模块手册：设定分级与一致性（features/consistency）

## 职责

FateQuill 的**设定分级归档与一致性引擎**域：把设定卡按**四级 `tier`**（与 `kind` 正交）归档，自章节正文
**抽取**新设定（**`evidence` 原文回查**防幻觉）→ 入**会话内存待确认队列**→ 用户确认后**事务批落库**；
并对设定库做**一致性校验**（**L1 规则**离线零幻觉 + **L2 语义**建议非结论）→ **冲突记录落库** → 面板**四动作处置**；
生成侧按**分级注入**（白名单 `{main, short}`，**恒排除 `dark`**——暗线泄露 = 剧透事故，**硬隔离**）。建立于 **v0.5.0-stage-11**。

分层：契约 / 抽取 / 规则 / 语义判定 / 报告 / 注入白名单在 `src/orchestration/consistency/`（provider 无关；**仅 L2 经 provider**）；
会话态在 `src/store/archiveStore.ts`（待确认队列）与 `src/store/consistencyStore.ts`（跨面板定位请求）；
UI 在 `src/features/consistency/`；持久化经 **迁移 v5**（`setting_card.tier` + `conflict_record`）与 **6 条 IPC 命令**。

## 目录结构 / 核心文件

```
src/orchestration/consistency/   # 契约与算法（provider 无关；L2 经 provider，非流式收口）
├── types.ts                     # ExtractedSetting / ExtractionCandidate / ExtractionResult
│                                # ConflictSeverity / ConflictType / L1Attribute / ConflictReport / JudgeVerdict
├── extract.ts                   # EXTRACTION_SYSTEM_PROMPT / buildExtractOptions / parseExtraction / verifyEvidence / toPlainText
├── dedupe.ts                    # dedupeByName（**名称精确匹配**；别名/语义相似 v0.5 显式不做）
├── run.ts                       # runExtraction（非流式收口 → 解析 → **回查剔除** → 去重；失败不抛穿）
├── rules.ts                     # L1：extractAssertions / runL1Rules / L1_SEVERITY（**纯函数、零幻觉**）
├── judge.ts                     # L2：JUDGE_SYSTEM_PROMPT / buildJudgeOptions / parseJudge / runL2（**advisory: true**）
├── report.ts                    # MISREPORT_THRESHOLD / severityOf / dedupeReports / toConflictReport
└── inject.ts                    # INJECTABLE_TIERS / isInjectableTier / selectInjectableCards（**恒排 dark**）

src/store/archiveStore.ts        # 待确认队列（会话内存）：candidates / set / update / remove / clear
src/store/consistencyStore.ts    # 跨面板定位请求：focus / requestFocus / clearFocus（冲突「编辑设定卡」用）
src/features/consistency/
├── ConsistencyPanel.tsx         # 冲突面板：列表（含空态）+「检测冲突」+「语义复核」（L2，需模型）
├── ConflictCard.tsx             # 单条冲突 + 四处置（改分级 / 编辑设定卡 / 标记误报 / 忽略）
├── useConflicts.ts              # 列表加载 + detectL1（离线）+ reviewL2（模型）+ persistNew（`(aId,bId,type)` 去重落库）
├── useResolveConflict.ts        # 四动作编排 + locateEvidence（**verbatim 定位**，缺失回退卡首）
├── ArchivePanel.tsx             # 「归档本章」+ 候选列表（分级下拉 / 移除 / 确认入库）
├── useArchiveChapter.ts         # 加载章节 → runExtraction → 待确认队列；confirmAndSave → saveExtracted
└── experiments/                 # 误报率样本集（conflict-01..03 + ground-truth.json）+ misreport.test.ts + report.md

src/domain/models/conflict-record.ts            # ConflictRecord / ConflictDispositionAction / ConflictRecordStatus
src/domain/repositories/conflict-record-repository.ts
src/ipc/repositories/conflict-record-repository.ts   # 5 命令映射（snake_case ↔ camelCase）
```

## 核心 API / 约定

- **抽取（`runExtraction`）**：非流式收口 → `parseExtraction`（JSON 容错，复用 `review/json` 的 `extractJson`；**单条非法丢弃**、**顶层非法抛错**）
  → `verifyEvidence`（**规范化空白后子串断言**，不匹配者**剔除**）→ `dedupeByName`（名称精确匹配 → `duplicate`）。
  返回 **`{ ok, candidates, error? }`**：异常 → `ok:false`（失败不抛穿）；**零命中为合法空态**。
- **归档落库**：候选**不入库直达**；确认后经 `save_extracted_settings`（`{ novelId, items:[{title,content,kind,tier?}] }`，**事务内批创建**，任一非法 → **全回滚**）。
- **L1（`runL1Rules`，纯函数）**：实体闭集 = **卡标题**且须**同句出现**；保守正则抽取「生死 / 时间线 / 数值」断言（**仅阿拉伯数字**，中文数字不解析），**同实体同属性值明确不同**才报；
  `evidence` 为卡文本**逐字句子**（**零幻觉**）；不确定 / 一致 → **不报**（宁缺毋滥）。严重度：生死 `high` / 时间线 `medium` / 数值 `low`。
- **L2（`runL2`，经 provider）**：输出 `{ verdict, reason, evidence? }`，**恒带 `advisory: true`（建议非结论）** + `constraintIds`；
  JSON 非法 / 收口异常 → **降级 `uncertain`**（不误报、不抛穿）。`toConflictReport` **仅**把 `contradiction` 转 `type:"semantic"` 报告并与 L1 合并去重。
- **冲突落库与处置**：`conflict_record`（迁移 v5）；`resolve_conflict_record { id, action }`，`action ∈ change_tier | edit | false_positive | ignore`
  （前两者 → `resolved`，后两者 → `ignored`；均写 `action` 与 `resolved_at` **留痕**）。
  `edit` = **跳转设定卡面板 + `evidence` verbatim 定位**（`「…」` 引文优先，缺失 → **回退卡首**）。
- **分级注入（`selectInjectableCards`）**：白名单 **`{main, short}`**；**`dark`（暗线）恒排除**（硬隔离、开关不可绕过）、`temp` 亦不注入；
  **未标注**（历史数据）→ 按默认 `short` 注入；**未知值 → fail-closed 排除**。三处装载点：`buildExplorationOptions` /
  `buildChapterGenerationOptions` / `useSceneContext`（均支持可选 `injectSettings`，默认 `true`；关 = **完全不注入**）。
- **误报率**：`MISREPORT_THRESHOLD = 0.2`（**占位，待用户拍板**）；样本集 `experiments/samples/{conflict-01..03.txt,ground-truth.json}` 由 `misreport.test.ts` 断言（**L1 自动口径**）。
- **IPC**：**6 条新增**（`save_extracted_settings` + `save/list/get/resolve/delete_conflict_record`）；`setting_card` 五命令**签名扩展、命令数不变**（见 `docs/ipc.md` §8.1/§8.4）。
- **i18n**：新增 `consistency` 命名空间（归档区 + 冲突区）。

## 迁移影响（REV-008①，可感知行为变更）

- **v0.5 起设定卡按 `tier` 注入**：`main` / `short` 进入**正文生成 / 多温度推演 / 多声部对话** prompt；
  **`dark`（暗线）与 `temp` 从上述 prompt 中移出**（暗线泄露 = 剧透事故，**硬隔离、无开关可绕过**）。
- **存量卡**因迁移 v5 默认 `tier='short'` **仍照常注入**；但用户标为 `dark` 的暗线卡**不再进入 prompt**（安全上正确，属可感知变更）。
- 同一句见 `docs/structure.md` §18；迁移 v5 = `setting_card.tier`（`CHECK` 四级，`DEFAULT 'short'`）+ `conflict_record` 表（**不含**版本池快照持久化——stage-08 REV-009 **独立跟踪**）。

## 关联文档

- 编排引擎：`.openfeel/manual/orchestration/engine.md`（`consistency/` 子结构）；领域存储：`.openfeel/manual/core/domain-storage.md`（迁移 v5）。
- 评审边界：`docs/review-rubric.md` §4.2（**设定 vs 设定** vs **正文 vs 设定**，同一 rubric 引用）；命令面：`docs/ipc.md`（§8.1 命令明细 / §8.4 计数口径）。
- 角色 persona 契约（stage-10）：`.openfeel/manual/features/dialogue.md`（`buildCharacterAgentPrompt` 的公共上下文来源含本域分级过滤结果）。
- 落点：`docs/structure.md` §18；体积：`docs/build-size-report.md` §八；数据状态：`src/features/consistency/experiments/report.md`。
