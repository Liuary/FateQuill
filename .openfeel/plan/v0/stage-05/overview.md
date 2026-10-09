# v0.1.0-stage-05

## 目标

实现单 Agent 章节生成与设定卡，跑通 v0.1 最小可用闭环（**模式 A 流式直插**，ADR-002）：建作品 → 建卷章 → 编辑 → AI 生成并**流式直插编辑器** → 保存设定卡 → 重启不丢。生成面板仅承载状态，不设预览。
（v2：依据 REV-v0.1.0-stage-05 修订；见 `plan.md` 与 `.openfeel/dev/decisions.md` ADR-002。）

## 依赖

- v0.1.0-stage-03（引擎，已归档）
- v0.1.0-stage-04（编辑器，已归档）
- 附带清理：stage-04 遗留 REV-013/015（并入首个 op）；**REV-014（perf 协验）并入本阶段收口 T6**

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 清理 stage-04 遗留 REV-013/015（chore） | T7 | — |
| op-002 | 生成请求装配：上下文预算与提示模板 | T1 | op-001 |
| op-003 | 生成入口、生成面板与 generationStore + 流式直插接线 | T2、T3 | op-002 |
| op-004 | 停止/失败处置与生成状态机 | T4 | op-003 |
| op-005 | 设定卡 CRUD 与面板 | T5 | op-002 |
| op-006 | v0.1 收口验收：分层 E2E + perf 回填 | T6 | op-004、op-005 |

> 说明：**op-003 合并 T2（入口/面板/store）与 T3（流式直插接线）**——T2 的 C-03/Profiler 验收依赖真实插入路径，二者强耦合，拆分会产生不可编译的中间态。T2/T3 交付物分别落在 op-003 的对应步骤。

### 定稿要点（摘要）
- **落地模式 A**：`generationStore` 订阅 `subscribeChunks` → 节流 → `EditorController.appendChunk`；生成面板仅状态（进度/停止/重试/错误）。
- **`generationStore` 边界**：元状态（`status`/`chapterId`/`requestId`/`progress`/`error`），**不持正文**；与 `editorStore` 独立 `create()`。
- **C-03 测量**：React `Profiler` 断言流式期间 render 计数=0；`editorStore` 除 `saveStatus/lastSavedAt` 外快照不变。
- **代理指标**：`dispatch` 次数 ≤ chunk/2 且无 `setContent` 全量重设。
- **上下文装配**：输出 `ChatOptions`（provider 无关）；预算 系统≤1k + 设定卡≤2k + 前章末尾≤2k + 用户指令；总≤8k；裁剪序 设定卡→前文；模板落点 `src/orchestration/prompts/chapter-generation.ts`（版本化）。
- **面板落点**：第三栏复合 tab（生成 `src/features/generation/` + 设定卡 `src/features/setting-cards/`）；无 Key 引导 Settings。
- **收口 T6**：分层验收（Rust 往返 / Vitest mock 全链路 / 真机冒烟检查单）+ REV-014 perf 回填。

### schemer 落实结果
- op 拆分：6 个 op（首 op 并入 REV-013/015 清理，标 `(chore)`；op-003 合并 T2+T3），见上表。
- **遗留处置**：REV-013（口径收窄 + 偏差登记）→ op-001；REV-015（chunk 体积显式登记「v0.1 接受 / v0.2 评估」）→ op-001；**REV-014（perf 实测回填）→ op-006（T6 收口）**。
- **依赖**：零新增依赖（复用 stage-03/04 既有依赖）。
- 文档同步落点：`docs/structure.md`（op-003 生成面板/generationStore/第三栏；op-005 设定卡面板）、`docs/ipc.md`（op-003 生成复用现有命令说明）、`manual/index.md` + `manual/features/{generation,setting-cards}.md`（op-006）。
