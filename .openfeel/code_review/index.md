# 代码审查索引（公共域）

> 存放各阶段审查关闭后的核心结论摘要。详细审查过程与逐提交点内容见私域 `.openfeel/users/{username}/code_review/REV-{stage}.md`。
> 状态统计：**pending 4 ｜ fixing 0 ｜ resolved 12 ｜ closed 96**（pending 4 = stage-04 REV-014 + stage-05 REV-009 人工协验 BLOCKED + stage-08 REV-009 快照会话内存级 / REV-010 abort 语义·新章落卷末）

## v0.3.0-stage-08（多温度并行推演引擎，v0.3 首阶段）

- **结论**：代码审查**通过**（2026-10-10 04:38），stage 已 test_passed → archiving。**0 Bug**。
- **心得总结**：[`v0.3.0-stage-08.md`](v0.3.0-stage-08.md)
- **审查对象**：
  1. 阶段计划 `plan.md` v1（03:33 → 复审 v2 03:44 通过）：REV-001~006 **closed**（6 条，含克制收敛 / 推演契约 / 持久化方案 A / 并行工程四大定稿）。
  2. 操作方案 `ops/op-001~006.md`（03:58 → 复审 04:12 通过）：REV-007（high, blocking，采纳数据安全网）**closed**；REV-008（low 杂项）**resolved**。
  3. 执行产出代码审查（04:38）：REV-007/008 **代码级闭环**；登记 REV-009（medium）/ REV-010（low）**pending**（非阻塞）。
- **closed 合计 7 条**（含 REV-007 high）；**resolved 1**（REV-008）；**pending 2**（REV-009/010 非阻塞登记）。
- **关键**：多温度并行推演（同模型多温度 + per-provider clamp + 乱序归位 + 会话内存分支）；**克制收敛两层**（生成期约束注入 system + 产出期覆盖检查降权标注，终选权归用户）；**采纳双路径安全网**（主：新建下一章草稿无损 / 次：替换加强制快照 + 单撤销，REV-007）；走向卡存在性校验（防幻觉引用）；manualChunks 分包（入口 −60.8% raw / −61.0% gzip，REV-015 兑现）；「功能无入口」防范复验。实测 `cargo test` **52/52**、Vitest **353/353**（77 文件）、lint 0 errors、build 无 `>500kB` 警告；DoD **10/10**、门禁 **6/6**。
- **遗留（非阻塞）**：REV-009（medium）次路径快照会话内存级；REV-010（low）abort 分支 `error="aborted"` / 主路径新章固定追加卷末；人工协验 3 项 **BLOCKED**（真实 Key 端到端 / 真机 WebView 推演 / v0.2 遗留 4 项）。建议随 stage-09 或人工协验批处理。

## v0.2.0-stage-07（去 AI 味研究子系统 v1，v0.2 收官）

- **结论**：代码审查**通过**（2026-10-10 03:12 → 修复复审 03:22/03:38），stage 已 test_passed → archiving。**修复闭环**：REV-018（high）/REV-019（medium）经 op-008 修复；BUG-001（medium，素材库缺读取侧 UI）经 op-009 修复后测试官独立复验通过并关闭（修复 commit `9ad8693`）。
- **心得总结**：[`v0.2.0-stage-07.md`](v0.2.0-stage-07.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（02:00 → 复审 v2 02:04 通过）：REV-001~007 **closed**（7 条，含迁移 v4 / 采样语义 / 交叉合并 / skill 注入四大定稿）。
  2. 操作方案 `ops/op-001~007.md`（02:15 → 复审 02:52 通过）：REV-008（blocking，perf 执行主体）**resolved**；REV-009~016 **resolved**（方案层闭环，含 REV-011 三通道 sourceType high）。
  3. 执行产出代码审查（03:12）：REV-017 **closed**（文字级残留）；REV-018（high）/REV-019（medium）/REV-020（low）经 op-008 fix **resolved**。
- **closed 合计 9 条**（计划 7 + REV-009 + REV-017）；**resolved 11 条**（方案/代码级修复闭环）。
- **关键**：去 AI 味数据流闭环（采样→交叉→标注→素材库→skill 库→回注生成）；迁移 v4 双资产（`material` / `skill_entry`，7→9 表幂等）；**引文精确交集合并**（verbatim 为键 + 命中分级）；三通道 sourceType 透传；skill 注入（`ChapterPromptInput.skills?` 预算桶 ≤500，向后兼容）；删除引用防护；**UI 接线验证**（防「功能内置无入口」）。实测 `cargo test` **52/52**、Vitest **295/295**（64 文件）、lint 0 errors、build 通过（chunk 警告已知项）；DoD **10/10 通过**（第 2 条经 BUG-001 修复转正）。
- **BUG-001（medium, closed）**：素材库缺读取侧 UI（浏览/检索/导出/删除），`export.ts` 三函数与 `material.remove` 生产零调用，DoD 第 2 条「可检索、可导出」界面不可达 → 新增 `MaterialLibrary` + `useMaterialLibrary`（复用既有纯函数/仓储，**不改 Rust/迁移/IPC**）；修复 commit `9ad8693`。
- **遗留（非阻塞）**：人工协验 4 项 **BLOCKED**（真实 Key 端到端 / 真机 WebView / **T6 实验回填** / REV-009·014 perf）；stage-06 遗留 REV-008~011 已随 op-001 闭合。

## v0.2.0-stage-06（审查流水线：剧情/世界观/合规/真人感）

- **结论**：代码审查**通过**（2026-10-10 01:30），stage 已 test_passed → archiving。**修复闭环**：1 个 low Bug（review BUG-001，评审输入未沿用预算裁剪）经修复后测试官独立复验通过并关闭（修复 commit `1bbd3e8`）。
- **心得总结**：[`v0.2.0-stage-06.md`](v0.2.0-stage-06.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（01:10 → 复审 v2 01:13 通过）：REV-001~007 **closed**（7 条）。
  2. 操作方案 `ops/op-001~007.md`（00:35 方案审查通过）：REV-008~009 **pending**（非阻塞）。
  3. 执行产出代码审查（01:30）：REV-010~011 **pending**（非阻塞）。
- **closed 合计 7 条**：计划 7。
- **关键**：四维评审（剧情/世界观/真人感 = LLM-as-judge **非流式收口** + 合规 = **规则引擎**无 Token）；rubric 双载体版本化；加权总分 `weightedTotal` 归一择优；**会话级版本池**；重写回路（上限 2 / 反馈注入 / 合规排除 `triggerDims` / 入池不自动替换）；采纳经 `EditorController.replaceContent`（单条撤销）；迁移 v3 `review_record` + IPC 2 命令（共 40 注册）。实测 `cargo test` **45/45**、Vitest **221/221**（52 文件）、lint 0 errors、build 通过（chunk 警告已知项）；DoD 10 条 **9 完整满足 + 第 10 条人工协验 BLOCKED**。
- **BUG-001（low, closed）**：评审输入未沿用预算裁剪，长章正文全量送入四维评审与重写 prompt → 新增 `budget.ts`（`REVIEW_CONTENT_BUDGET` 单一来源复用 stage-05 装配预算=8000 + `trimReviewContent`），接入 `llm-judge.ts`/`rewrite.ts`；修复 commit `1bbd3e8`。
- **遗留 4 条（非阻塞，建议随 stage-07 首要 op 清理）**：
  - REV-008（medium）op-006 采纳临时 `EditorController` 未 dispose（composition 监听器累积）→ **已代码修复**（`try/finally dispose`），REV 待收口
  - REV-009（low）杂项：重写判定基准歧义 / op-002 表格式 / chunk 评估未兑现 / 冒烟未覆盖审查流程（与 REV-011 重复）
  - REV-010（low）判定基准澄清（op-005 修正记录）未同步 plan v2 约定节
  - REV-011（low）杂项：chunk 评估未兑现 / 冒烟检查单扩展
- **stage-05 遗留 REV-009**：人工协验（perf + 冒烟）并入本阶段 T7，**BLOCKED**（需真实 WebView / 真实 API Key）；4 项人工协验未执行（如实标注未伪造）。

## v0.1.0-stage-01（工程脚手架与工程化基础设施）

- **结论**：审查**通过**（2026-10-08 23:53），stage 已 test_passed → done。
- **心得总结**：[`v0.1.0-stage-01.md`](v0.1.0-stage-01.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（22:31 → 复审 v2 通过）：REV-001~008 **closed**（8 条）。
  2. 操作方案 `ops/op-001~009.md`（22:57 → 复审 23:03 通过）：REV-009~014 **closed**（6 条）。
  3. 执行产出代码审查（23:53）：REV-015 复核 **closed**；REV-016~019 登记为 pending（**已于 stage-02 op-001 全部 closed**，见 stage-02）。
- **closed 合计 19 条**：计划 8 + 方案 6 + 同步项 1 + 遗留清理 4（REV-016~019）。
- **关键偏差定稿（plan v3）**：React 19 / Node 24 双锚定 / `ui` 层 → `src/components/` / Tailwind v4（CSS-first）。

## v0.1.0-stage-02（核心领域模型与本地存储）

- **结论**：代码审查**通过**（2026-10-09 00:55），stage 已 test_passed。
- **心得总结**：[`v0.1.0-stage-02.md`](v0.1.0-stage-02.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（23:59 → 复审 v2 通过）：REV-001~008 **closed**（8 条）。
  2. 操作方案 `ops/op-001~007.md`（00:22 → 复审 00:27 通过）：REV-009~012 **closed**（4 条）。
  3. 执行产出代码审查（00:55）：REV-013~014 **pending**（全部非阻塞）。
- **closed 合计 12 条**：计划 8 + 方案 4。
- **遗留 2 条（已由 stage-03 op-001 清理 closed）**：
  - REV-013（low）`docs/ipc.md` §8.1 命令清单 25 → 28 + ordering 命令
  - REV-014（low）`error.rs` 的 `MIGRATION_FAILED` 常量 `dead_code` 告警
- **另外**：stage-01 遗留 REV-016~019 已在本阶段 op-001（T7 chore）全部清理 closed。

## v0.1.0-stage-03（AI 编排引擎骨架与模型配置）

- **结论**：代码审查**通过**（2026-10-09 22:55），stage 已 test_passed → archiving。
- **心得总结**：[`v0.1.0-stage-03.md`](v0.1.0-stage-03.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（01:01 → 复审 v2 22:09 通过，落实 ADR-001 架构裁决选项 A）：REV-001~008 **closed**（8 条）。
  2. 操作方案 `ops/op-001~007.md`（22:22 → 复审 22:30 通过）：REV-009~014 **closed**（6 条）。
  3. 执行产出代码审查（22:55）：REV-015~016 **pending**（全部非阻塞，建议随 stage-04 清理）。
- **closed 合计 14 条**：计划 8 + 方案 6。
- **关键**：ADR-001 落地（v0.1 无 AI SDK、Rust 侧 provider 无关 SSE 中继 + TS 适配器、Key 零下发）；59 文件 / +3217 −61；DoD 10/10、门禁 6/6。
- **pending 2 条（已由 stage-04 op-001 清理 closed）**：
  - REV-015（low）前端 `IpcErrorCode` 缺 `TIMEOUT`（两端码表漂移）→ 补 `IpcErrorCode.Timeout`
  - REV-016（low）`docs/ipc.md` §8.1 标题措辞易误读全仓总数 → 改「数据访问命令清单（36 个）」并注明 §6 流式命令

## v0.1.0-stage-04（编辑器基础：Tiptap 章节文档 + 大纲树）

- **结论**：代码审查**通过**（2026-10-10 00:15），stage 已 test_passed → archiving。**修复闭环**：BUG-001（high）经 op-010 修复后测试官独立复验通过并关闭。
- **心得总结**：[`v0.1.0-stage-04.md`](v0.1.0-stage-04.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（23:05 → 复审 v2 23:12 通过）：REV-001~008 **closed**（8 条）。
  2. 操作方案 `ops/op-001~009.md`（23:20 → 复审 v2 23:35 通过）：REV-009~012 **closed**（4 条）。
  3. 执行产出代码审查（23:55）：REV-013~015 **pending**（全部非阻塞，建议随 stage-05 清理）。
  4. BUG-001 修复 `ops/op-010.md`（修复方案 + 修复代码审查 00:15 通过，无新增 REV）。
- **closed 合计 12 条**：计划 8 + 方案 4。
- **关键**：编辑器域 `src/features/editor/` + `src/store/editorStore.ts`；一章一实例（C-01）、`content_format='html'` 零迁移、T8 增量插入接口（撤销 newGroupDelay 合并 + IME DOM 监听）、自动保存（防抖 800ms + flush 三时机 + `chainRef` 串行链）、应用外壳/选书；Vitest 29 文件 110/110、cargo 41/41；DoD 9/11（2 项真实 WebView 性能人工协验）。
- **BUG-001（high, closed）**：切章未 flush 致防抖窗口内前一章编辑永久丢失 → `requestSelectChapter` 守卫（先 await flush 后切）+ 章号守卫 + 集成用例；修复 commit `6d7d180`。
- **遗留 3 条（stage-05 处置，非阻塞）**：
  - REV-013（low）op-006 验证口径 `rg word_count|wordCount` 过宽且偏差未登记 → **已由 stage-05 op-001 清理 closed**
  - REV-014（low）perf 人工协验（真实 WebView P95/堆增幅）待回填 → **并入 stage-05 收口，现由 stage-05 REV-009 承载（pending）**
  - REV-015（low）build chunk 体积警告（Tiptap/ProseMirror 311KB）→ **已由 stage-05 op-001 清理 closed**

## v0.1.0-stage-05（单 Agent 章节生成 + 设定卡，v0.1 闭环终点）

- **结论**：代码审查**通过**（2026-10-10 00:40），stage 已 test_passed → archiving。**修复闭环**：2 个 low Bug（generation BUG-001、build BUG-001）经修复后测试官独立复验通过并关闭（修复 commit `e3a9e5a`）。
- **心得总结**：[`v0.1.0-stage-05.md`](v0.1.0-stage-05.md)
- **审查对象**：
  1. 阶段计划 `plan.md`（v2，含 REV-001~007 修订，落实 ADR-002 模式 A）：REV-001~007 **closed**（7 条）。
  2. 操作方案 `ops/op-001~006.md`（op-003 合并 T2+T3）：REV-008 **closed**（1 条）。
  3. 执行产出代码审查（00:40）：REV-009 **pending**（low，人工协验待办，非阻塞）。
- **closed 合计 8 条**：计划 7 + 方案 1。
- **关键**：**模式 A 流式直插**（ADR-002：`subscribeChunks` → 节流 → `EditorController.appendChunk`）；生成面板仅状态（无预览）；`generationStore` 五元状态不持正文、双 store 独立；C-03 Profiler 断言（jsdom，render=0）；上下文装配预算与裁剪序 + 模板版本化；第三栏「生成/设定卡」tab + Key 引导；停止/失败收敛 `idle` + 草稿保留 + 一次 `Ctrl+Z` 撤销整段。实测：`cargo test` **42/42**、Vitest **35 文件 133/133**、无 ai 包、零新增依赖。DoD 11 条：**9 条自动化满足**，2 项（REV-014 perf 实测、冒烟「实际/结果」列）为人工协验待办。
- **REV-009（low, pending）**：人工协验待办——perf 实测（REV-014）与真机冒烟「实际/结果」列未填写；M1 收口前须闭合（feel-tester 或用户执行）。**非阻塞**。
- **合并裁决**：op-003 合并 T2（入口/面板/store）+ T3（流式直插接线）——C-03/Profiler 验收依赖真实插入路径，拆分会产生不可编译中间态（审查官裁决**可接受**，提交双标 T2,T3）。

## 其他阶段

> 随各阶段归档增量登记。
