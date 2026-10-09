# v0.1.0-stage-04 详细计划：编辑器基础（Tiptap 章节文档 + 大纲树）

> 修订：v2（2026-10-09，依据 REV-v0.1.0-stage-04 的 8 条审查意见修订，详度对齐 stage-02/03）。

## 归属版本
v0.1（最小可用闭环）

## 目标
交付高性能的章节编辑器与卷章大纲树，落实「按章节分文档」与「长文不卡顿」的硬性要求；并为 stage-05 预留「AI 增量插入」编辑器侧接口。

## 对应核心目的
- 目的 1：创作者的主创作界面。
- 目的 2：为人味修改提供顺手的编辑体验（后续标注/对比的基础）。

## 前置依赖
- v0.1.0-stage-01、v0.1.0-stage-02（硬依赖，已归档）
- v0.1.0-stage-03（**软依赖**，已归档）：T8 的插入接口与 T6 复用 `subscribeChunks` / `throttleChunks`
- stage-03 遗留 **REV-015/016** 并入本阶段首个 op 附带清理（见 T9）

## 技术约束（本阶段适用，定稿）

### 存储格式（定稿，修订 REV-001）
- **v0.1 沿用 `content_format = 'html'`**：编辑内容以 Tiptap **`editor.getHTML()`** 持久化到 `chapter.content`，加载用 `editor.commands.setContent(html)` **原生往返**。
- **零迁移**：不新增 `0003` 迁移；stage-02 的 `content_format DEFAULT 'html'` 与 `word_count` 的 `html` 分支（去标签 + 实体解码）**直接复用**，stage-02 数据零返工。
- `tiptap-json` **留待确有需要时**（协作/细粒度 diff）按 stage-02 预留路径**按行迁移**；v0.1 不引入（YAGNI）。

### 依赖版本表（定稿，修订 REV-005；精确版本已于 2026-10-09 经 `npm view` 预检）
| 包 | 精确版本 | 用途 / 兼容说明 |
|----|----------|-----------------|
| `@tiptap/react` | 3.31.4 | React 绑定；peer 支持 `react ^19`（已确认） |
| `@tiptap/core` | 3.31.4 | 核心 |
| `@tiptap/pm` | 3.31.4 | ProseMirror 依赖 |
| `@tiptap/starter-kit` | 3.31.4 | 基础扩展包（段落/标题/粗体/斜体/删除线/下划线/链接/列表/引用/代码/代码块/分割线/历史 History 等，含 `@tiptap/extensions`） |
| `@tiptap/markdown` | 3.31.4 | 官方 Markdown 扩展（Tiptap 3；无需社区 `tiptap-markdown`） |
| `zustand` | 5.0.15 | 状态管理；peer 支持 `react >=18`（已确认） |
| `@dnd-kit/core` | 6.3.1 | 拖拽排序基础 |
| `@dnd-kit/sortable` | 10.0.0 | 列表排序 |
| `@dnd-kit/utilities` | 3.2.2 | dnd-kit 工具 |

- 约定：新增依赖一律**精确版本**（无 `^`/`~`）；schemer 在方案阶段 `pnpm view` 复核并把解析结果写入 `README` / `kb/setup.md` 版本表；lockfile 锁定。

### 编辑器架构
- **一章一文档实例**（C-01）：切换章节时**销毁 / 重建** Tiptap 实例，禁止累加。
- 所见即所得 + Markdown 输入/序列化（`@tiptap/markdown`）。
- 长文性能：单章 5000 字输入延迟 **P95 < 16ms**；切章无明显卡顿。

### `editorStore` 职责边界（定稿，修订 REV-007②）
- **单一事实源原则**：**ProseMirror 文档内容的唯一事实源在 Tiptap 实例**；`editorStore` **不持有文档全量**（避免双源同步 bug）。
- `editorStore`（Zustand，**首个接入 store**）仅持**元状态**：`currentNovelId` / `currentChapterId` / `saveStatus('saved'|'saving'|'dirty'|'error')` / `lastSavedAt`。
- `generationStore` 归属 **stage-05**；与 `editorStore` 严格分离（C-03 铺路）。

### 外部增量插入接口（定稿，修订 REV-002）
- 编辑器组件对外暴露**最小命令面** `EditorController`：
  - `appendChunk(text: string): void` —— 增量追加到文档末尾（节流批次应用）；
  - `flushPending(): void` —— 立即应用队列中待插入内容。
- **消费方**：stage-05 `generationStore` 订阅 stage-03 `subscribeChunks` → 取 `Chunk.delta` → 调 `appendChunk`；**stage-05 不直接操作编辑器内部**（避免越界，C-09）。
- **撤销栈策略**：一次「生成会话」的插入**合并为单条历史记录**（会话起止标记）；用户 `Ctrl+Z` 一次撤销整段生成，避免散成数百条历史。接口签名预留 `options`（`{ addToHistory?: boolean; follow?: boolean }`）。
- **IME 排队策略**：若处于 `composition` 进行中，Chunk 先入队列，`compositionend` 后再 flush（接口签名预留，stage-05 细化时机）。
- **光标/滚动**：插入默认不强制滚动（`follow` 可配置）。

### 自动保存（定稿，修订 REV-003）
- **防抖时长定稿：800ms**。
- **flush 时机清单**：① **切章前同步 flush**（`await` 保存完成后再销毁实例）；② 窗口关闭（Tauri close-requested / `beforeunload`）前 flush；③ 可选：编辑器失焦 flush。
- **失败策略**：保存失败（如 `DB_LOCKED`/`INTERNAL`）→ `editorStore.saveStatus='dirty'` + UI「未保存」指示；**定时重试（5s）** 直至成功（带退避/上限），**不得静默丢弃**。
- **可判定验收**：① 单测「编辑 → 不等待防抖直接切章 → 切回后内容完整」（证明 flush 生效）；② 单测「mock IPC 失败 → 脏标记置位 → 重试成功后清除」。
- `word_count` 不由前端计算：保存时由 **Rust 侧**统一回填（stage-02 纪律）。

### 性能方法学（定稿，修订 REV-004）
- **指标**：**按键事件 → Tiptap `dispatchTransaction` → 编辑器 DOM 更新完成**的耗时；在 `editor.on('transaction')` 前后 `performance.now()` 埋点（或以 `requestAnimationFrame` 对齐帧 budget），统计 **P95**。
- **载荷**：前端 seed 生成 **5000 字 HTML 文档**（复用 stage-02 seed 思路的前端版）。
- **运行环境**：**真实 WebView**（Tauri 窗口内埋点输出 / Playwright 驱动），**jsdom 无布局不可用于此项**；基准脚本**入库可重复**。
- **内存指标**：**连续切换 20 章（含 5000 字章）后，Tiptap/Editor 实例计数恒为 1**；堆内存增幅 **< 20%**（`performance.memory` 或 DevTools heap 断言）。
- **IME 口径**：中文 IME `composition` 期间的延迟**单独统计或排除**（composition 事件链路不同），基准报告注明。

### 其他
- Markdown 语法清单（修订 REV-007①，往返测试 ≥8 项）：**标题 h1–h3、粗体、斜体、删除线、无序列表、有序列表、引用、行内代码、代码块、分割线、链接**。
- 拖拽库（修订 REV-007③）：**`@dnd-kit/core` + `@dnd-kit/sortable`**（原生 HTML5 DnD 体验差，不采用）。
- 组件落点（修订 REV-006）：**`src/features/editor/`**（编辑器与大纲树同域）；写入 `docs/structure.md`。
- i18n：启用 **`editor`** 命名空间（新增 UI 文案双语，C-11）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 集成 Tiptap 基础编辑器 | 编辑区组件 + StarterKit + 版本表；扩展清单：段落/标题/粗体/斜体/删除线/下划线/链接/列表/引用/代码/代码块/分割线/History（撤销栈）+ `@tiptap/markdown` | 可输入并渲染富文本；`editor.getHTML()` 可序列化；扩展清单逐项可用；React 19 下 `pnpm build` 通过 | stage-01 |
| T2 | 章节文档模型与切换（`content_format='html'`） | 一章一实例的加载/卸载逻辑（`setContent(html)` / `getHTML()`） | 切换章节内容正确、**无串档**；连续切换后 **实例数=1**；HTML 往返无损（测试） | T1, stage-02 |
| T3 | Markdown 支持 | `@tiptap/markdown` 输入规则 / 导入导出 | **≥8 项**语法往返用例全通过（枚举见约束） | T1 |
| T4 | 卷 → 章 大纲树（+ dnd-kit 排序） | 左侧树组件 + 增删改 / 拖拽排序（`src/features/editor/`） | 结构操作同步持久化、顺序正确；拖拽排序落库后再加载顺序一致 | stage-02 |
| T5 | 自动保存与状态提示（flush/重试/脏标记） | 防抖保存（800ms）+ flush 时机实现 + 失败重试 + 状态指示 | 单测「编辑→立即切章→切回内容完整」；单测「mock IPC 失败→`dirty`→重试成功清除」；退出前 flush 生效 | T2 |
| T6 | 长文性能验证与 `editorStore` | `editorStore`（单一事实源约束）+ 性能基准脚本（入库） | 5000 字输入延迟 **P95 < 16ms**（真实 WebView，脚本可重复）；切 20 章后实例数=1、堆增幅 < 20% | T2 |
| T7 | 应用外壳与选书上下文 | 两栏布局（左树右编辑器，栅格预留第三栏）+ Novel 选择/默认书（`list_novels`，单书取首个或新建） | 打开应用可加载默认书并渲染大纲树 + 编辑器；空态提供「新建作品」入口 | T4 |
| T8 | **AI 增量插入接口**（独立交付物） | `EditorController.appendChunk(text)` / `flushPending()` + 撤销栈/IME 策略 + `options` 签名 | 注入假增量流可**增量追加到文末**；节流合并生效（复用 stage-03 `subscribeChunks`/`throttleChunks`）；`Ctrl+Z` 一次撤销整段生成（会话合并）；composition 期间入队、结束后 flush | T2, stage-03 |
| T9 | stage-03 遗留清理（REV-015/016，并入首个 op，标 `(chore)`） | 补丁 | REV-015：前端 `IpcErrorCode` 补 `Timeout = "TIMEOUT"`；REV-016：`docs/ipc.md` §8.1 标题改「数据访问命令清单（36 个）」 | stage-03 |

## 阶段验收标准（DoD）
- [ ] 单章 5000 字输入延迟 **P95 < 16ms**（真实 WebView + 入库基准脚本，口径见方法学）（C-01/REV-004）。
- [ ] 切换章节旧实例被销毁，无串档；连续切 20 章后**实例数=1、堆增幅 < 20%**（REV-004）。
- [ ] **`content_format='html'` 贯穿 T1/T2/T5**：`getHTML()`/`setContent` 往返无损，stage-02 数据零迁移、word_count 复用（REV-001）。
- [ ] 卷/章 增删改与拖拽排序持久化正确（REV-007③）。
- [ ] 自动保存可靠：**切章/退出前 flush 无丢失**；失败置脏 + 重试成功；防抖 800ms（REV-003）。
- [ ] Markdown **≥8 项**语法往返测试通过（REV-007①）。
- [ ] `editorStore` 不持文档全量（单一事实源），仅元状态（REV-007②）。
- [ ] **T8 增量插入接口**可验收：假流增量追加、节流合并、撤销合并、IME 排队（REV-002）。
- [ ] 组件落点 `src/features/editor/`，i18n `editor` 命名空间启用（REV-006）。
- [ ] 新增依赖均为**精确版本**且写入版本表（REV-005）。
- [ ] stage-03 遗留 REV-015/016 已清理（REV-008）。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | medium | ✅ | 技术约束「存储格式」定稿 `content_format='html'`；T1/T2/T5 与 DoD 第 3 条 |
| REV-002 | high | ✅ | 技术约束「外部增量插入接口」+ **T8 独立交付物** + DoD 第 8 条 |
| REV-003 | medium | ✅ | 技术约束「自动保存」flush 清单/失败重试/800ms；T5 可判定验收 |
| REV-004 | medium | ✅ | 技术约束「性能方法学」指标/工具/载荷/内存/IME；T6 + DoD 1/2 |
| REV-005 | medium | ✅ | 技术约束「依赖版本表」（精确版本 + React 19 peer 已确认）；T1 |
| REV-006 | low | ✅ | T7 应用外壳与选书 + 组件落点 `src/features/editor/`；DoD 第 9 条 |
| REV-007 | low | ✅ | Markdown 语法枚举（T3）；`editorStore` 边界（约束/DoD 第 7）；拖拽库 dnd-kit |
| REV-008 | low | ✅ | 前置依赖 + T9（REV-015/016） |

## 风险与备注
- **切章 × 防抖（数据丢失高发坑）**：必须保证「切章前同步 flush」；销毁实例前 `await` 保存完成。这是本阶段最高风险点。
- **性能基准环境**：jsdom 不可用于延迟测量；须真实 WebView，脚本与埋点入库以保证可回归。
- **Markdown 往返**：Tiptap Markdown 扩展对部分语法的规范化可能改变等价表示，往返测试断言「语义等价」而非「字符串全等」。
- **HTML 存储的 XSS 面**：`getHTML()` 输出渲染于自身 WebView；不得引入外部未净化 HTML 的 `setContent`（v0.1 内容来源为本地/生成文本）。
- **`word_count` 精度**：沿用 stage-02 定义（非空白字符数，html 分支近似）；编辑器保存不自行计算，避免双份逻辑。
- **dnd-kit 与 Tiptap**：拖拽发生在树组件而非编辑器内，二者互不干扰；注意拖拽结束后 flush 顺序。

## 待用户拍板
无（`content_format='html'`、Tiptap 3.x、dnd-kit 均为技术性定稿，符合既有约定）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序：**首 op 并入 T9（REV-015/016）清理**（标 `(chore)`）。
2. 依赖版本精确化：`pnpm view` 复核后写入 `README` / `kb/setup.md` 版本表并 `pnpm install` 锁定。
3. 文档同步：`docs/structure.md`（`src/features/editor/` 落点、`editorStore` 边界、`content_format='html'`）、`docs/ipc.md` §8.1、`manual/index.md`（新增 features 模块登记，归档阶段）。
