# 代码审查索引（公共域）

> 存放各阶段审查关闭后的核心结论摘要。详细审查过程与逐提交点内容见私域 `.openfeel/users/{username}/code_review/REV-{stage}.md`。
> 状态统计：**pending 3 ｜ fixing 0 ｜ resolved 0 ｜ closed 59**

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
- **pending 3 条（非阻塞）**：
  - REV-013（low）op-006 验证口径 `rg word_count|wordCount` 过宽且偏差未登记
  - REV-014（low）perf 人工协验（真实 WebView P95/堆增幅）待回填
  - REV-015（low）build chunk 体积警告（Tiptap/ProseMirror 311KB）

## 其他阶段

> 随各阶段归档增量登记。
