# 目录结构约定（FateQuill / 命笔）

> 本文档为前端与后端的分层目录、路径别名、状态管理与 IPC 边界的**权威约定**。
> 归属阶段：v0.1.0-stage-01（T3）。后续阶段新增目录须在此登记。

## 1. 分层目录职责

| 目录                   | 职责                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| `src/app/`             | 应用入口与全局装配（`main.tsx`、`App.tsx`、i18n 初始化、Provider 等）         |
| `src/components/`      | 应用级组合组件（自建）                                                        |
| `src/components/ui/`   | shadcn/ui 源码组件（由 shadcn CLI 管理，落库为可编辑源码）                    |
| `src/ui/`              | 通用可复用 UI 层（布局、非 shadcn 组合组件）                                  |
| `src/features/`        | 面向用户的功能模块（按功能内聚）                                              |
| `src/features/editor/` | 编辑器与大纲树（Tiptap 基础编辑器；同域功能模块；i18n `editor` 命名空间启用） |
| `src/domain/`          | 纯 TS 领域模型与业务规则（无 UI、无网络）                                     |
| `src/orchestration/`   | Agent 编排引擎（可插拔）                                                      |
| `src/ipc/`             | 前端 IPC 封装（`invoke` 包装）                                                |
| `src/store/`           | 状态管理目录（Zustand 于 stage-04 接入）                                      |
| `src/lib/`             | 通用工具（如 `cn`）                                                           |
| `src/locales/`         | i18n 资源（zh-CN / en）                                                       |
| `src-tauri/`           | Rust 后端（网络 / 密钥 / SQLite 边界）                                        |

> 空目录以 `.gitkeep` 占位，保证纳入版本管理。

## 2. `ui` 层映射与通用层区分（plan v3 定稿）

plan v3 技术约束中的目录集为 `src/{app,components,features,domain,orchestration,ipc,store}`，其中：

- **plan v3 的 `ui` 层映射为 `src/components/`**；shadcn/ui 组件源码落于 **`src/components/ui/`**（满足阶段计划 T2 与 REV-007③）。
- 另设**通用可复用 UI 组合层 `src/ui/`**（布局、非 shadcn 组合组件，如 op-008 的语言切换器），以显式目录名区别于 plan v3 的 `ui` 层语义。

**理由**：shadcn CLI 默认约定组件落点为 `@/components/ui`（见 `components.json` 的 `aliases.ui`），保持与 CLI 一致可避免后续 `shadcn add` 路径漂移；同时以独立 `src/ui/` 承载自建的通用组合组件，避免与 shadcn 生成物混放。

## 3. 路径别名约定

- 别名：`@/*` → `src/*`。
- **双端同步**（缺一不可）：
  - `tsconfig.json`：`"paths": { "@/*": ["./src/*"] }`（相对 tsconfig 所在地解析）。
  - `vite.config.ts`：`resolve.alias["@"] = fileURLToPath(new URL("./src", import.meta.url))`。
- **禁止**使用 `path.resolve(__dirname, "./src")`：项目 `package.json` 为 `"type": "module"`，ESM 下 `__dirname` 未定义，会导致 `ReferenceError` 与 `pnpm build` 失败（统一采用 ESM 写法，REV-010）。

## 4. 状态管理（`src/store/`，Zustand）

- **`editorStore`（stage-04 T2 接入）**：仅持**元状态** `currentNovelId` / `currentChapterId` / `saveStatus`（`saved`/`saving`/`dirty`/`error`）/ `lastSavedAt`；**不持有 ProseMirror 文档正文**（单一事实源在 Tiptap 实例）。
- **stage-05** 新增 `generationStore`（订阅 `src/orchestration/stream` 的 `subscribeChunks` 输出，见 §9）。
- **一章一实例（C-01）**：切章时 `key={chapterId}` 重挂载 Tiptap 实例（销毁旧、重建新），同一时刻实例数恒为 1。

## 5. IPC 边界

- 所有**外部 HTTP**、**密钥**、**SQLite** 访问**仅经 Rust 侧**（`src-tauri/`）；前端**只经 `@/ipc`** 封装的 `invoke` 调用后端。
- **SQLite 访问**：经 `tauri-plugin-sql` v2（**仅 Rust 侧**）+ 自定义 `#[tauri::command]`；前端**不安装/不 import** `@tauri-apps/plugin-sql`（REV-009）；db 位置 `sqlite:fatequill.db`（Tauri AppData）。
- 前端不得直接发起外部网络请求；IPC 封装的命令通道约定见 `docs/ipc.md`（T5 落地）。

## 6. `repositories`（接口）↔ `ipc`（实现）对应关系

三段式落点，组件只依赖**接口**，不感知命令名：

| 层   | 路径                        | 职责                                                                                                     |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------------- |
| 接口 | `src/domain/repositories/*` | 纯 TS 仓储接口（仅依赖 `@/domain/models/*`，无实现细节、无 IPC 依赖）                                    |
| 实现 | `src/ipc/repositories/*`    | 实现上述接口，经 `@/ipc/client` 的 `invokeCommand` 调 Rust 命令，并做 snake_case 行 ↔ camelCase 模型映射 |
| 命令 | `src-tauri/src/commands.rs` | op-004 的 25 个 `#[tauri::command]`                                                                      |

- **一一对齐**：5 个实体仓储接口各含 `list/get/create/update/delete` 五个方法，与 25 个命令一一对应（REV-010），`get` 不得缺省。
- **就近过滤**：`list_*` 命令无过滤参数，`listByNovel` / `listByVolume` 在实现层按父 id 客户端过滤。
- **无 `src/infra/`**：不设 infra 层（YAGNI）；实现层即 `src/ipc/repositories/`。

## 7. 顺序与字数约定

- **`order_index`**：同一父级内**唯一且连续**（从 0 起）。移动/删除后在**事务内**重排（`src-tauri/src/db/ordering.rs` 的 `reorder_volumes` / `reorder_chapters` / `move_chapter`）。对应命令 `reorder_volumes` / `reorder_chapters` / `move_chapter`。
- **`word_count`**：**Rust 侧写入时统一计算回填**（`src-tauri/src/db/word_count.rs`），按 `content_format` 分支：`html` 去标签取文本、`tiptap-json` 遍历文本节点、`plaintext` 直接计数。
  - **计数单位 = 非空白字符数**（面向中文「字数」）。
  - **为近似值（REV-011）**：`html` 分支为**简易去标签 + 常用实体解码**（`&amp;`/`&lt;`/`&gt;`/`&quot;`/`&#39;`/`&nbsp;`），**未处理**属性值内 `>`、`<script>/<style>` 文本与未知实体；需精确字数时后续引入 HTML 解析器，或以 `tiptap-json` 文本节点遍历为准。
- **基准**：`src-tauri/src/db/bench.rs`（`#[cfg(test)]`）基于 seed（50 章 × 3000 字）验证「单次查询 < 100ms」；仅覆盖单查询路径，写路径（seed INSERT）耗时由 `--nocapture` 观测，不作门禁（REV-012③）。

## 8. orchestration 引擎结构（stage-03）

`src/orchestration/` 为与 UI/IPC 解耦的**可插拔 AI 编排引擎**（纯 TS，**不触网**——网络在 Rust 侧，见 §5 / `docs/ipc.md`）。

| 子结构        | 职责                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `types.ts`    | 契约：`Chunk` / `ChatMessage` / `ChatOptions` / `ModelProvider` / `ModelRef` / `Agent` / `PipelineStep` / `Pipeline` |
| `registry.ts` | 泛型 `Registry<T>` 与 `createRegistries()`（providers / agents / pipelines）                                         |
| `providers/`  | 自研 SSE 协议适配器（≥2 个），实现 `ModelProvider.stream()`                                                          |
| `agents/`     | Agent 角色定义与注册                                                                                                 |
| `pipeline/`   | Pipeline 步骤与组合                                                                                                  |
| `stream/`     | 流式消费工具（T6）                                                                                                   |

- **不引入 `ai` 包**（ADR-001 / DoD 1）：`orchestration` 任何文件不得 `import "ai"`。
- **扩展点（REV-007②）**：新增 Provider 仅需「新建适配器文件 + 在 `providers/register.ts` 注册一行」，核心文件（`types.ts` / `registry.ts` / `stream/**` / `pipeline/**`）**`git diff` 为零**。
- **授权头不入前端**：`ChatOptions.headers` 仅承载非 Key 头（Content-Type/Accept 等）；授权头由 Rust 侧注入（op-003）。
- **Pipeline 启用时点（REV-014②）**：`Pipeline` / `PipelineStep` 为**契约先行**；v0.1 仅实现最小单步（op-006 的 `GenerationStep`），**多步组合管线于 stage-06/08 启用**（届时 `Pipeline.steps` 泛型上下文细化）。

## 9. 流式消费工具（stage-03 T6）与 stage-05 订阅声明

`src/orchestration/stream/` 为**纯 TS** 流式消费工具集（不触网；网络在 Rust 侧）：

| 文件             | 职责                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| `async-queue.ts` | 极简异步队列（`createAsyncQueue`；适配器与 T6 复用）                             |
| `throttle.ts`    | 节流合并（`throttleChunks`；窗口默认 **≥50ms**，C-02；可注入时钟以便确定性测试） |
| `subscribe.ts`   | 消费入口（`subscribeChunks`；对 `Chunk` 序列施加节流）                           |

- **契约**：`Chunk = { delta: string }`（op-002 定稿）；消费端**增量渲染**。
- **不建 store**：本阶段**不创建任何 store**；`src/store/` 维持空目录（Zustand 于 stage-04 接入）。
- **stage-05 订阅声明**：**stage-05 的 `generationStore`（`src/store/`）将订阅 `subscribeChunks` 的输出**，本工具为其**上游**；编辑器消费侧不直接驱动（C-03），由 `generationStore` 承接流式状态。

## 10. 编辑器存储格式

- **`content_format = 'html'`**：编辑器保存用 `editor.getHTML()` → `chapter.content`；加载用 `editor.commands.setContent(html)`。**零迁移**（复用 stage-02 schema）。
- `word_count` 走 §7 的 `html` 分支（Rust 侧计算）。
- 落点：`src/features/editor/`（`RichTextEditor` / `ChapterEditor` / `useChapter` / `editor-extensions`）；`editorStore` 见 §4。
