# v0.1.0-stage-05 详细计划：单 Agent 章节生成 + 设定卡（v0.1 闭环）

> 修订：v2（2026-10-10，依据 REV-v0.1.0-stage-05 的 7 条审查意见修订；落实用户裁决「生成落地交互 = 模式 A 流式直插」，见 ADR-002）。

## 归属版本
v0.1（最小可用闭环）—— 本阶段是 v0.1 的**收口与验收终点**。

## 目标
打通「创作 → 生成 → 落地」闭环（模式 A）：单一 Agent 依据上下文与设定卡生成章节内容，**经 `EditorController` 流式直插编辑器**；生成面板仅承载状态；生成期间编辑器零 React 重渲染（C-03）。见大计划 §3.4 ADR-002。

## 对应核心目的
- 目的 1：让创作者能实际产出章节文本。
- 目的 2：为后续「真人感审查/去 AI 味规避」提供生成入口与对照样本。

## 前置依赖
- v0.1.0-stage-03（引擎，已归档）、v0.1.0-stage-04（编辑器，已归档）
- **stage-04 遗留处置（REV-007）**：
  - **REV-014（perf 人工协验）→ 并入本阶段收口任务 T6**：v0.1 收口时一并完成编辑器性能实测（真实 WebView P95 / 切 20 章实例数=1 / 堆增幅）并回填 `src/features/editor/perf/README.md` 实测表。
  - REV-013（op-006 验证口径过宽）、REV-015（build chunk 311KB 体积警告）→ 随**首个 op `(chore)`** 顺手处理（REV-015 若确认接受现状，则显式登记为「v0.1 接受，v0.2 评估」）。

## 技术约束（本阶段适用，定稿）

### 生成落地模式（定稿，修订 REV-001；ADR-002）
- **模式 A 流式直插**：`generationStore` 订阅 stage-03 `subscribeChunks` → 节流（复用 `throttleChunks` ≥50ms）→ stage-04 `EditorController.appendChunk(text)`。
- **生成面板职责限定**：仅承载**状态**（进度/停止/重试/错误），**不设内容预览面板**；正文事实源始终在 Tiptap 实例。
- 撤销/IME：由 stage-04 `EditorController`（`newGroupDelay=5000` 会话合并 + composition 排队）承担，本阶段不重复实现。

### `generationStore` 边界（定稿，修订 REV-002）
- 新建独立 Zustand store `src/store/generationStore.ts`，**元状态清单**：
  `status: 'idle'|'streaming'|'done'|'error'|'aborted'`、`chapterId: number|null`、`requestId: string|null`（供 `abort_stream`）、`progress: { chars: number }`、`error: IpcError|null`。
- **不持有正文内容**（与 `editorStore` 同一「单一事实源」原则）。
- **隔离机制**：与 `editorStore` 各自独立 `create()`；**不互相 `setState`**；跨域通信仅经 `EditorController` 命令面（插入）与自动保存域（`editorStore.saveStatus`）。

### 状态隔离与测量（定稿，修订 REV-002/006）
- **C-03 口径**：流式期间 **`editorStore` 除 `saveStatus/lastSavedAt`（自动保存域）外的字段不变，且编辑器组件 React 渲染计数 = 0**。
- **测量工具**：以 React `Profiler` `onRender` 包裹 `EditorContent` 子树，断言流式期间 render 计数 = 0（**jsdom 可测**：ProseMirror 直改 DOM、不经 React 受控更新）。
- **「无闪烁」代理指标（修订 REV-006①）**：节流批次合并生效（**`dispatch` 次数 ≤ chunk 数 / 2**）且**无整文档重设**（无 `setContent` 全量调用）（复用 stage-03 节流测试思路）。

### 上下文装配（定稿，修订 REV-004）
- **装配产物 = stage-03 `ChatOptions`**（model / messages / temperature）；**provider 差异由 stage-03 适配器吸收**，装配器不感知 provider 语义。
- **优先级与预算（默认值定稿，可配置）**：系统提示 ≤ **1000** 字 + 设定卡 ≤ **2000** 字 + 前章末尾 ≤ **2000** 字（v0.1 无摘要能力，取前章末尾 M 字）+ 用户指令（本章要求，优先保留）；**总预算 ≤ 8000 字**；超限按「**设定卡 → 前文**」顺序裁剪（系统提示与用户指令不裁）。
- **提示模板落点**：`src/orchestration/prompts/chapter-generation.ts`（导出 `buildChapterGenerationPrompt(...)` + **版本常量** `CHAPTER_GENERATION_PROMPT_VERSION`），为 stage-07 skill 库预留注入点。
- 裁剪单测：各源超限 / 合计超限的预期截断结果。

### 生成入口与设定卡面板（定稿，修订 REV-005）
- **生成入口**：工作区**第三栏复合面板**（生成 / 设定卡 **tab**），布局 `grid-cols-[280px_1fr_minmax(0,320fr)]`（stage-04 `WorkspaceLayout` 已预留第三栏）。
- **组件落点**：生成面板 `src/features/generation/`；设定卡面板 `src/features/setting-cards/`；`generationStore` 于 `src/store/`（写入 `docs/structure.md`）。
- **Key 缺失引导**：生成前若无 `model_config` 或 keyring 无 Key → 生成按钮禁用 + **引导至 Settings**（i18n 双语提示）。

### 停止 / 失败处置与「半态」（定稿，修订 REV-006②③）
- 用户「停止」或流式错误时：**已插入内容保留**（草稿语义，用户可 `Ctrl+Z` 或手动删除）；`generationStore` 状态复位为 `idle`；错误经 `IpcError` 结构提示。
- **「半态」定义**：`generationStore` 残留 `streaming` 状态 / 悬挂 `abort` 句柄。**状态机复位断言**入测试（停止/失败后 `status=idle` 且无活跃 requestId）。

### 其他
- **新增依赖：无**（复用 stage-03/04 既有依赖，精确版本见各阶段版本表）。
- 单 Agent、单模型（v0.1 默认；多模型并行留待 v0.2/v0.3）。
- i18n：启用 **`generation`** 命名空间（生成面板/引导文案双语，C-11）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 生成请求装配（上下文 + 提示模板） | 上下文构建器（输出 `ChatOptions`）+ `src/orchestration/prompts/chapter-generation.ts`（模板函数 + 版本常量） | 输入作品/章/设定 → `ChatOptions`；优先级/预算按定稿；超限裁剪顺序正确（单测覆盖各源/合计超限）；输出 provider 无关 | stage-03,04 |
| T2 | 生成入口 + 生成面板（状态控制）+ `generationStore` | 第三栏生成面板（进度/停止/重试/错误）；`generationStore`（元状态，含 `requestId`） | 生成期间 **`editorStore` 除 `saveStatus/lastSavedAt` 外不变**；**Profiler render 计数=0**；停止可中断；**无 `model_config`/Key → 按钮禁用并引导 Settings（i18n）** | T1 |
| T3 | 流式直插接线（模式 A） | `useChunkInjection` 接线：`subscribeChunks` → `throttleChunks` → `EditorController.appendChunk` | 假流增量**直插文末**；`dispatch` 次数 ≤ chunk/2；无 `setContent` 全量重设（代理指标） | T2, stage-04 |
| T4 | 停止 / 失败处置与状态机 | 状态复位 + 部分内容保留策略 + 错误提示 | 停止/错误后 `generationStore.status=idle` 且无悬挂 requestId；已插入内容保留（草稿）；一次 `Ctrl+Z` 撤销整段生成 | T3 |
| T5 | 设定卡 CRUD 与面板 | 设定卡列表/编辑器 UI（第三栏 tab）+ 持久化 | 增删改查可用且重启保留；可被生成上下文（T1）引用 | stage-02 |
| T6 | **v0.1 收口验收（分层 E2E + perf 回填）** | ① Rust 集成测试（插入后 update→重新 get 往返）；② Vitest mock 全链路（建书→建卷章→生成 mock 流→直插→存设定卡）；③ 真机冒烟**检查单**（步骤/预期/实际/结果）；④ perf/README 实测回填（REV-014） | 三层各自通过；冒烟检查单「关窗重开 → 内容/设定卡仍在」；perf 实测表回填完成 | T1~T5 |
| T7 | stage-04 遗留清理（REV-013/015，并入首个 op，标 `(chore)`） | 补丁 + 登记 | REV-013：op-006 验证口径收窄并登记偏差；REV-015：chunk 体积警告显式登记「v0.1 接受 / v0.2 评估」 | stage-04 |

## 阶段验收标准（DoD，即 M1）
- [ ] **M1（模式 A）**：新建作品 → 建卷/章 → 编辑正文 → AI 生成一章并**流式直插** → 保存设定卡 → 重启后数据完好。
- [ ] **C-03**：生成期间编辑器 React 渲染计数 = 0（React Profiler 断言，jsdom 可测）；`editorStore` 除 `saveStatus/lastSavedAt` 外快照不变。
- [ ] **C-02**：`dispatch` 次数 ≤ chunk/2 且无 `setContent` 全量重设（代理指标）。
- [ ] 上下文装配输出 `ChatOptions` 且 provider 无关；裁剪按「设定卡→前文」顺序（单测）。
- [ ] 生成面板仅状态控制（无预览面板）；停止可中断、可重试。
- [ ] 停止/失败后状态机复位（`status=idle`、无悬挂 requestId）、已插入内容保留（草稿）、一次 `Ctrl+Z` 撤销整段。
- [ ] 设定卡可持久化并被生成引用；面板落点 `src/features/setting-cards/`。
- [ ] 生成入口在第三栏；无 `model_config`/Key 时引导 Settings（i18n 双语）。
- [ ] 三层验收通过：Rust 往返 + Vitest mock 全链路 + 真机冒烟检查单（含「关窗重开不丢」）。
- [ ] **REV-014 perf 回填**：真实 WebView P95 / 切 20 章实例数=1 / 堆增幅 < 20%，录入 `perf/README.md`。
- [ ] stage-04 遗留 REV-013/015 已处理/登记。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「生成落地模式」+ T2/T3 接线 + 目标引用 ADR-002 + 大计划 §3.4 / decisions.md ADR-002；M1 措辞统一 |
| REV-002 | medium | ✅ | 「generationStore 边界」元状态清单 + 隔离机制 +「状态隔离与测量」（Profiler、快照口径） |
| REV-003 | medium | ✅ | T6 分层验收（Rust 往返 / Vitest 全链路 / 真机冒烟检查单）；不建 tauri-driver（v0.2+ 评估） |
| REV-004 | medium | ✅ | 「上下文装配」优先级/预算数值 + 模板落点/版本化 + `ChatOptions` 对齐 + 裁剪单测 |
| REV-005 | low | ✅ | 「生成入口与设定卡面板」第三栏落点 + Key 缺失引导（T2） |
| REV-006 | low | ✅ | 「无闪烁」代理指标 + 停止/失败处置 + 「半态」定义（T4） |
| REV-007 | low | ✅ | 前置依赖声明 REV-014 并入 T6、REV-013/015 并入 T7 + M1 引用 ADR-002 |

## 风险与备注
- **模式 A 依赖 stage-04 契约**：`EditorController.appendChunk/flushPending` 与 `useChunkInjection` 已在 stage-04 定稿；本阶段只接线，不改编辑器内部（C-09）。
- **上下文预算影响生成质量**：默认数值可调；提示模板**版本化**，为 stage-07 skill 注入预留（不得在装配器内硬编码 skill 逻辑）。
- **停止语义**：已插入内容保留为草稿，需在 UI 明示「生成已停止，可 Ctrl+Z 撤销」避免用户困惑。
- **C-03 测量环境**：render 计数用 jsdom（Profiler）可测；P95 延迟须真实 WebView（jsdom 无布局，见 stage-04 方法学）。
- **v0.1 收口**：本阶段完成后应有一次**可用性复盘**（roadmap 备注），据此微调 v0.2 范围。

## 待用户拍板
无（生成落地模式 A 已由用户拍板；其余为技术性定稿，符合既有约定）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T7（REV-013/015）清理**（标 `(chore)`）。
2. 文档同步：`docs/structure.md`（生成/设定卡面板落点、`generationStore` 边界、第三栏布局）、`docs/ipc.md`（生成相关命令，如有）、`manual/index.md`（登记 `features/generation` 等新模块，归档阶段）。
