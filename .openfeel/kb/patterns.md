# 代码模式

> 记录项目约定、代码模式与最佳实践。`[+]` 启用 / `[-]` 禁用。

## [+] ESM 写法约定：禁止 `__dirname` (2026-10-08)

`package.json` 为 `"type": "module"`，`vite.config.ts` 等 ESM 环境**不得**使用 `__dirname`：

```ts
import { fileURLToPath, URL } from "node:url";
resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }
```

- 使用 `path.resolve(__dirname, "./src")` 会触发 `ReferenceError: __dirname is not defined`，导致 `pnpm build` 失败。
- 该坑曾在 op-002 与 op-003 的别名写法上出现矛盾（REV-010），统一为 Vite 官方 ESM 写法。

## [+] `@/*` 路径别名双端一致 (2026-10-08)

- `tsconfig.json`：`"paths": { "@/*": ["./src/*"] }`；`vite.config.ts`：`resolve.alias["@"]` 指向 `src`。两端必须一致。
- **TS 6 下不使用 `baseUrl`**：TS 6.0.3 设置 `baseUrl` 触发 TS5101 弃用报错，仅保留 `paths` 即可正常解析别名（现代 TS 写法）。
- 空目录以 `.gitkeep` 占位保证入 Git。

## [+] i18n 命名空间约定 (2026-10-08)

- **资源布局**：`src/locales/{zh-CN,en}/{namespace}.json`；初始命名空间 `common` / `editor` / `settings`。
- **初始化**：`src/app/i18n.ts`（app 装配层）；`defaultNS = common`；`fallbackLng = zh-CN`（英文缺失自动回退中文）；`supportedLngs = ["zh-CN", "en"]`。
- **持久化与同步**：localStorage key `fatequill.lang`；init 后**立即**同步 `document.documentElement.lang`（防首帧静态 lang 与实际语言不一致，REV-014③），切换语言时同步更新。
- **键命名**：camelCase，按语义分组（如 `common.actions.save`）。
- **新增文案**：须同时提供 zh-CN 与 en；**创作向内容不翻译**（C-11）。约定文档 `docs/i18n.md`。

## [+] 提交消息规范 `<type>(scope): <desc> (T#)` (2026-10-08)

- 每个 op 完成后**必须提交**，格式如 `feat(ui): add Tailwind v4 and shadcn/ui setup (T2)`，消息尾部标注任务编号。
- 目的：保证阶段**按 op 独立可回滚**（约束 C-09），且 op-009 推送时远程代码完整（否则 CI 上 test/build 必挂，REV-009）。
- 推送前校验：`git status --porcelain` 输出为空（全部变更已提交）方可 push。

## [+] 仓储接口 ↔ IPC 命令 1:1 对齐约定 (2026-10-09)

- 每个实体的仓储接口方法集与 Rust 命令**一一对应**（每实体 5 个）：`list → list_*`、`get → get_*`、`create → create_*`、`update → update_*`、`remove → delete_*`；**不得缺 `get`**（即使 UI 暂未用，也保持对称，避免命令与接口漂移）。
- 命令名一律 `snake_case`；前端 `invoke(cmd, { camelCase })` 由 Tauri 自动映射到 Rust `snake_case` 参数。
- 新增/变更命令时须**同步更新** `docs/ipc.md` 命令清单（含计数），避免「命令已注册但契约文档过时」（stage-02 REV-013 教训）。
- 接口层（`src/domain/repositories/`）仅依赖领域模型，实现层（`src/ipc/repositories/`）持有 `*Row`（snake_case）与 `toModel` 映射函数。

## [+] 两阶段 order_index 重排模式 (2026-10-09)

- **问题**：`UNIQUE(volume_id, order_index)` 约束下，逐条 `UPDATE order_index` 做换序/移动会**中途撞唯一约束**（新值恰被尚未移走的旧行占用）。
- **模式**：重排在事务内分两阶段——① 先把待重排行 `order_index` 统一置为**唯一负值**（如 `-1 - id`）暂避冲突；② 再按目标顺序落定 `0..n-1`。移动章到目标卷时先把该章置负值，再重排源卷与目标卷。
- `reorder_volumes` / `reorder_chapters` / `move_chapter` 均走此模式；删除（章/卷）后在同一事务内紧凑化同父级顺序，保持「连续唯一（从 0 起）」不变量。

## [+] word_count 近似值约定 (2026-10-09)

- **落点**：`word_count` 由 **Rust 侧写入时统一计算回填**（前端不做双份逻辑），按 `content_format` 分支：`html` → 去标签 + 常用实体解码；`tiptap-json` → 遍历 `text` 节点；`plaintext` → 直接计数。
- **单位**：**非空白字符数**（面向中文「字数」；DoD 的「3000 字」即 3000 个非空白字符）。
- **为近似值（显式声明局限）**：`html` 分支为简易状态机去标签 + 常用实体解码（`&nbsp;`→0 字），未处理属性值内 `>`、`<script>/<style>` 文本与未知实体。stage-04/05 **不得把 `word_count` 当精确指标消费**；需精确字数时引入 HTML 解析器，或以 `tiptap-json` 文本节点遍历为准。

## [+] EventSink trait：中继逻辑与传输解耦的可测试性模式 (2026-10-09)

- **做法**：Rust 中继核心 `relay<S: EventSink>(..., sink: S)` 仅依赖自定义 `trait EventSink { fn send(&self, event: StreamEvent) -> bool; }`；生产实现 = `impl EventSink for Channel<StreamEvent>`，测试实现 = 内存 `MemSink`（`Mutex<Vec<StreamEvent>>`）。
- **收益**：`cargo test` 无需 Tauri runtime 即可断言分块/终止/取消/超时/脱敏；`send` 返回 `bool` 让「通道已关闭」（`false`）短路中继循环，避免向已关闭通道继续推送。
- **推广**：把「外部副作用接口」抽象为可注入 trait/函数（TS 侧同理——适配器工厂接受可注入 `transport` 回放夹具），是跨语言通用的可测试性模式。

## [+] SSE 事件块切分：跨块 CR 状态机归一化 + 末块冲刷 (2026-10-09)

- **问题**：SSE 规范行结束符可为 `\n`/`\r\n`/`\r`；若仅按 `\n\n` 双字节窗口检测边界，对 `\r\n\r\n` 分隔的 provider 永远切不出块，数据滞留缓冲直到连接结束而**静默丢失**。
- **模式**：字节级 `carry_cr` 状态机——遇 `\r` 置位不发，下一字节到达时补 `\n`（`\r\n`/`\r` 统一归一为 `\n`），兼容 `\n\n`/`\r\n\r\n`/`\r\r`；连接结束（`Ok(None)`）时若 `carry_cr` 补 `\n`，且**冲刷无空行终止的末块**后再发 `Done`。
- **守护**：mock server 分别以 `\n\n` 与 `\r\n\r\n` 发送，断言分块不丢失；另测末块冲刷。

## [+] 适配器传输契约真实类型对齐（禁「双重 as」强转） (2026-10-09)

- **问题**：适配器用 `as unknown as StreamTransport` 掩盖签名差异，会使真实路径缺参数（如 `requestId`）直到 `invoke` 反序列化才失败；而回放测试因注入自定义 transport 而**全绿掩盖缺陷**。
- **模式**：让 `StreamTransport = (p: HttpStreamParams) => Promise<() => Promise<void>>` 与 `httpStream` **签名超集对齐**，默认 `const transport: StreamTransport = opts.transport ?? httpStream` 直接赋值，由 tsc 编译期保证契约；验证项 `rg "as unknown as" src/orchestration/providers` 无输出。
- **原则**：跨「真实实现 ↔ 测试替身」的接口优先用类型系统对齐而非断言强转；测试替身必须与真实实现共用同一接口类型。

## [+] AUTH_DENYLIST：授权头前端丢弃、Rust 侧密钥链注入 (2026-10-09)

- **约定**：前端传入 header 中的授权类头 `authorization`/`x-api-key`/`proxy-authorization`/`api-key`（大小写不敏感）**一律丢弃**；授权头由 Rust 从 keyring 取 Key 后 `compose_headers` **合并/覆盖**注入。
- **前置**：`url` 经 `ensure_https` 仅允许 `https://`（v0.1 为前缀校验，**不拦** `https://localhost`/内网段，已显式声明降级，留待后续收紧）。
- **守护**：单测断言前端授权头被丢弃、auth 注入正确 header、非 Key 头保留；配合 `err_event` 脱敏断言（错误 payload 不含 URL/headers/body/Key）。

## [+] Rust codes 模块与前端 IpcErrorCode 同 PR 同步 (2026-10-09)

- 错误码表以 Rust `src-tauri/src/error.rs` 的 `codes` 模块为**单一真源**；前端 `src/ipc/errors.ts` 的 `IpcErrorCode` 必须与之逐项对齐（含 `TIMEOUT`）。
- 约定：**新增/调整任一错误码须在同一 PR 内同步两端**（Rust `codes` + 前端 `IpcErrorCode` + `docs/ipc.md §8.2` 码表），防止码表漂移复发（REV-015）。
- 前端消费使用 `IpcErrorCode.Timeout` 等常量，**不得硬编码** `"TIMEOUT"` 字符串。

## [+] 切章守卫 `requestSelectChapter`：先 flush 后切 (2026-10-10)

- **唯一合法切章入口** = `WorkspaceLayout.requestSelectChapter(id)`：短路同章 → `await flushRef.current()`（保存**旧**章）**成功才** `setCurrentChapter(id)`；失败置 `saveStatus='error'` 并**阻断切章**（不丢数据）。
- `flushRef` 始终指向「当前渲染的 `ChapterEditor` 的 flush」，其闭包绑定当前 `chapterId`/editor，在 `setCurrentChapter` 之前调用即保存旧章。
- `OutlineTree` **不直连** store 切章，改用父层注入的 `onSelectChapter`；`renameChapter`/`removeChapter`/`removeVolume` 前亦先 flush（防陈旧覆盖、防丢）。
- 关窗 `onCloseRequested → globalFlush → destroy`；**未来键盘等一切切章入口**统一走 `onSelectChapter`。
- 通用原则：跨实例切换（销毁/重建）前必须**同步 flush 并 await**，成功才切换。

## [+] `flush → Promise<boolean>` + 章号守卫 (2026-10-10)

- `useAutoSave.flush()` 返回 `Promise<boolean>`：无脏→`true`、保存成功→`true`、失败→`false`（失败**仍置脏 + 5s 重试，不静默丢弃**）。
- `chapterIdRef` 章号守卫：防抖/重试回调执行前校验 `chapterIdRef.current === capturedChapterId`，不等则**跳过** → 杜绝旧实例闭包误写当前活动章（BUG-001 附带缺陷修复）。
- 消费侧（切章守卫）据返回值决定是否阻断切换。

## [+] Tiptap 撤销分组合并（`undoRedo.newGroupDelay`） (2026-10-10)

- **需求**：一次 `Ctrl+Z` 撤销整段 AI 生成（而非散成数百条历史）。
- **方案**：流式插入**保持默认入历史**，`StarterKit.configure({ undoRedo: { newGroupDelay: 5000 } })` 把 5s 时间窗内相邻事务**自动合并为单条历史**；用户手动编辑（超窗/光标移动）自然断组。
- **反例（不可行）**：`addToHistory:false` + 会话末 `delete+insert 同文本` 的 commit 事务对文档**净变化为零** → undo 不弹出生成文本；且会连带误删会话前内容与生成期间用户输入。
- 注：StarterKit 3.31.4 撤销扩展来自 `@tiptap/extensions` 的 `UndoRedo`，配置键为 `undoRedo`。

## [+] IME 排队监听 `editor.view.dom` 的 DOM composition 事件 (2026-10-10)

- Tiptap `editor.on` 事件总线**不含** composition 系列；IME 排队须 `editor.view.dom.addEventListener("compositionstart"/"compositionend")`。
- 组合期间 Chunk 入队，`compositionend` 后 flush；组件卸载/实例销毁时 `removeEventListener`（`dispose()`）。
- 测试用 `editor.view.dom.dispatchEvent(new CompositionEvent("compositionstart"/"compositionend"))` 模拟。

## [+] 自动保存串行链 `chainRef`（防慢写覆盖新写） (2026-10-10)

- 自动保存：**防抖 800ms** + **flush 三时机**（切章前 await / 窗口关闭前 / 失焦可选）+ 失败 **5s 线性退避**重试（上限 5）。
- **串行化**：所有保存串到同一条 promise 链尾（`chainRef`），执行时**重新取 `editor.getHTML()`**（最新优先） → 消除「慢写旧内容覆盖新写」（并发无互斥的静默丢失）。
- **清脏标时机**：须在 `await` **之前**清（保存期间的新编辑重新置脏 → 触发后续保存）；失败保留脏态。

## [+] rg 验证口径须区分「逻辑」与「数据夹具」 (2026-10-10)

- **教训来源**：REV-013——stage-04 op-006 的验证标准 `rg -n -e "word_count" -e "wordCount" src/features/editor`（期望无输出）会命中**测试夹具的合法实体字段** `Chapter.wordCount`，全目录匹配产生**假阴性**（"按字面判定即失败"）。
- **约定**：验证前端「某字段**不被计算/引用**」时，把 rg 目标**限定到具体逻辑文件**（如 `src/features/editor/useAutoSave.ts`），**不要**全目录匹配——实体模型 / DTO / 测试夹具会含合法同名字段。
- **通用**：`rg` 断言须明确「匹配的是**行为**还是**数据形状**」；数据夹具字段与目标逻辑无关时应在验证口径中显式豁免并登记。

## [+] 上下文装配预算与裁剪序 (2026-10-10)

- **装配产物 = `ChatOptions`（`model`/`messages`/`temperature`）**，**provider 无关**（provider 差异由 stage-03 适配器吸收，装配器不感知 provider 语义）。
- **预算（默认值，可配置；单位 = 字符数 `String.length`，对应「字/非空白字符近似」）**：系统提示 ≤ **1000** + 设定卡 ≤ **2000** + 前章末尾 ≤ **2000** + 用户指令（本章要求，**优先保留**）；**总预算 ≤ 8000**。
- **裁剪序**：超限按「**设定卡 → 前文**」顺序裁剪（可分别清空）；**系统提示与用户指令不裁**。
- **前情策略（v0.1 无摘要能力）**：取**前章（`order_index` 紧邻上一章）末尾 M 字**；因 `chapter.content` 以 HTML 存储，**先 `stripHtml` 去标签再按纯文本口径截取**（避免截断标签）。
- **落点**：模板 `src/orchestration/prompts/chapter-generation.ts`（纯 TS，可单测）；数据装配 `src/features/generation/build-chapter-options.ts`（仓储 → `ChapterPromptInput` → `ChatOptions`）。裁剪单测覆盖各源超限与合计超限。

## [+] 提示模板版本化 (2026-10-10)

- **落点**：`src/orchestration/prompts/chapter-generation.ts`，导出模板函数 `buildChapterPrompt(...)` + **版本常量 `CHAPTER_GENERATION_PROMPT_VERSION`**（v0.1 为 `"1.0.0"`）+ 默认系统提示常量 `DEFAULT_CHAPTER_AGENT_SYSTEM_PROMPT` + 预算常量 `PROMPT_BUDGET`。
- **目的**：为 stage-07 skill 库预留**注入锚点**；**不得**在装配器内硬编码 skill 逻辑。模板函数为纯 TS、可单测。
- **约定**：模板/预算/默认提示的调整须同步递增版本常量（变更可追溯）；`src/orchestration/prompts/index.ts` 统一导出。

## [+] 生成状态机收敛（停止/失败 → idle） (2026-10-10)

- **不变量**：退出 `start` 时 `abortRef.current === null` 且 `generationStore.status !== 'streaming'`、`requestId === null`。
- **收敛路径**：循环内每步检查 `abort.signal.aborted → break`；循环退出后 `controller.flushPending()`（应用队列残留 = 草稿保留），`aborted ? reset() : finish()`；`catch` 中 `flushPending()` + `fail(parseIpcError(e))`；`finally` 中 `controller.dispose()` + `abortRef.current = null`（无悬挂 abort）。
- **状态语义**：`status` 收敛态统一 `idle`（`error` 用于展示，不残留 `streaming`/`requestId`）；「半态」定义 = 残留 `streaming` 状态 / 悬挂 abort 句柄 / 非空 `requestId`，**复位断言入测试**（停止、失败、半态三种用例）。
- **草稿保留**：停止/失败时已插入内容不丢（用户可 `Ctrl+Z` 或手动删除）；UI 经 i18n `stoppedHint` 明示「生成已停止，可 Ctrl+Z 撤销」。

## [+] Profiler C-03 断言写法（流式期间编辑器零重渲染） (2026-10-10)

- **目标**：断言生成/流式直插期间**编辑器组件 React 渲染计数增量 = 0**（C-03）；jsdom 可测——ProseMirror/Tiptap 直改 DOM，不经 React 受控更新。
- **写法**：以 React `Profiler` 的 `onRender` 包裹 `EditorContent` 子树（测试经 `vi.mock("@tiptap/react")` 把真实 `EditorContent` 包进 `<Profiler>`，**仅测试接缝、不改源码**）；记录「点击开始生成 → 生成完成」区间的 render 增量并断言 **= 0**。
- **非空洞性守卫（关键）**：断言前先 `expect(rendersBefore).toBeGreaterThan(0)`（确认 Profiler 已生效、含挂载渲染被捕获）——否则「0 增量」可能是插桩未生效的假绿。可用独立探针（临时用例：触发父组件重渲染 → 计数递增）验证插桩能捕获真实重渲染。
- **配套**：`editorStore` 快照（除 `saveStatus/lastSavedAt` 自动保存域外）不变；代理指标 `dispatch` 次数 ≤ chunk 数 / 2 且无 `setContent` 全量重设。

## [+] 评审 JSON 容错降级（extractJson + DEGRADED_SCORE） (2026-10-10)

- **两段式解析**：`json.ts` 的 `extractJson(raw)` 先去 JSON 代码围栏（fenced code block）/ 取首 `{` 至末 `}`；`parseEvaluationJson(raw)` 再归一化——`score` 夹取 0–100、`reasons` 归一为 `string[]`、score 非有限数字 / 结构非法则**抛错**（交上层降级）。
- **降级不抛穿**：`evaluator.ts` 的 `evaluateWithFallback(ev, input, { retries })` 有限重试，仍失败返回 `degradedResult(reason)` = `{ score: DEGRADED_SCORE(=60), reasons: ["判定失败：…"] }`，**绝不向上抛穿流水线**（评审失败不应中断生成/重写闭环）。
- **测试**：夹具回放（`tests/fixtures/review/` 合法 / 围栏 / 非法）；`evaluator.test.ts` 断言抛错评估器 → 默认分 + 「判定失败」reason，成功路径原样返回。

## [+] rubric 双载体版本一致性（代码源 ↔ 人读文档） (2026-10-10)

- **双载体**：代码源 `src/orchestration/review/rubric.ts`（`REVIEW_RUBRIC_VERSION` + `RUBRICS` 四维子维度 + `buildReviewSystemPrompt` 把**精简 rubric 内联进评审 prompt**）↔ 人读权威 `docs/review-rubric.md`（**同名版本号** + 分档描述）。
- **约定**：两者须同步演进；验证用 `rg -n REVIEW_RUBRIC_VERSION` **双命中且一致**。合规词表同法版本化（`COMPLIANCE_RULES_VERSION`）并显式声明「内置词表覆盖范围有限」。
- 同源启示：凡「机器消费副本 + 人读权威文档」并存（如 rubric、模板、码表），以**版本常量**做同步锚点并纳入 `rg` 断言，防载体漂移。

## [+] 合规排除重写（triggerDims 三处隔离） (2026-10-10)

- **背景**：合规（规则引擎）存在误判风险，自动重写会放大误判 → 合规低分**只提示人工裁决**。
- **机制**：`failedDims`（单维 score < passThreshold）→ `triggerDims = failedDims \ {compliance}`；`triggerDims` 为空则不触发自动重写、置 `needsHuman`。
- **三处隔离**（防漏改）：① `loop.ts` 判定排除 `compliance`；② `rewrite.ts` 反馈注入仅用 `triggerDims`；③ `ReviewPanel` 合规低分仅显示 `complianceManual` 提示、不提供自动重写。测试以 spy 断言 `rewriteChapter` 零调用。

## [+] 评审预算裁剪（单一来源复用生成预算） (2026-10-10)

- **落点** `src/orchestration/review/budget.ts`：`REVIEW_CONTENT_BUDGET = PROMPT_BUDGET.total`（**单一来源复用** stage-05 装配预算，=8000 字符）、`REVIEW_TRIM_MARKER`、`trimReviewContent(content, budget?)`（≤预算原样；超限保留开头至预算 + 裁剪标记）。
- **接入两处**：`evaluators/llm-judge.ts`（评审 user message 正文）与 `rewrite.ts`（`buildRewriteMessages` 待改正文）——避免长章正文全量进入每维评审（每章 4 次评审 + 最多 2 次重写）造成 Token 线性放大。
- **验证**：临时探针以 5×预算超长正文调用，断言送入 LLM 的文本含标记且 `length ≤ 预算 + 标记长`、`< 原文长`（探针用后清理）。

## [+] 引文精确交集合并（verbatim 为键 + 命中分级） (2026-10-10)

- **场景**：多模型交叉判断「AI 味」共识——各模型独立摘取「AI 味片段 + 理由」，如何聚合为同一条标注。
- **模式（v0.2 简化）**：`mergeByExcerpt(results: ModelExcerpts[]): CrossJudgeResult[]` —— 以模型返回的**原文引文（verbatim excerpt）为键**求**精确交集**（`Map<excerpt, {models:Set, reasons:Set}>`）；命中模型数 **≥2 → 高置信 `high`**、**=1 → 待确认 `pending`**；多模型对同一引文的不同 `reason` 以「；」连接去重。**不做模糊对齐**（大小写/空白不归一，v0.2 显式接受召回损失）。
- **为何以引文为键**：LLM 返回的 **offset 不可靠（幻觉风险）**；引文原文虽需前端二次定位（文本搜索），但稳且可 verbatim 检索（见 `locate.ts`）。
- **配套约定**：输出结构 `{excerpt, positionHint, models, reason, confidence, sourceType:"multi_model_cross"}`；**结果入待确认队列（会话内存）不入库直达**——用户确认后才经标注入库（避免模型误判污染素材库）。
- **通用**：跨模型共识聚合优先用**可稳定比对的键**（原文片段）而非**易漂移的坐标**（offset/行号）。

## [+] 三通道 sourceType 透传（枚举单一来源 + 按来源写入） (2026-10-10)

- **背景**：素材有**三条采集通道** `multi_model_creation`（多模型采样）/ `multi_model_cross`（交叉判断）/ `user_manual`（用户手选），须在素材上可区分（检索/导出/统计）。
- **单一来源**：`MaterialSourceType` 定义在 `src/domain/models/material.ts`（**domain 层**，供 `src/orchestration/research/` 引用）——避免双处定义漂移；`MaterialCandidate`/`CrossJudgeResult` 各自**自带 `sourceType`**（候选=creation、交叉项=cross），供下游透传。
- **透传规则**：`useAnnotation.save` 的 `sourceType` **取自被标注项自带通道**（交叉待确认项 → `multi_model_cross`、采样候选 → `multi_model_creation`）；**仅「从零手选片段」**才用 `user_manual`。**禁止写死**某通道（写死会使检索过滤/导出统计/DoD「三通道」验收全部失真——REV-011 high）。
- **守护**：测试以三通道用例断言 `save_material` 收到的 `source_type` 分别正确（`ResearchWorkbench.test.tsx`/`AnnotationPanel.test.tsx`）。

## [+] skill 注入预算桶（system 拼接 + ≤500 字 + 向后兼容） (2026-10-10)

- **落点**：`src/orchestration/prompts/chapter-generation.ts` —— `ChapterPromptInput.skills?: PromptSkill[]`（`PromptSkill { title, rule }`），`buildChapterPrompt` 将 skill 规则渲染为「规避要点：\n- 标题：规则」拼入 **system 段**。
- **预算桶**：`PROMPT_BUDGET.skills = 500`（字符，计入 `total`）——**跨阶段扩展**（stage-07 T6 扩展 stage-05 装配器）；超总预算时裁剪序追加第 ③ 步「仍超再削 skill 段（可清空，**最后削**）」。
- **向后兼容（硬约束）**：`skills` 缺省/空时**系统提示、预算、裁剪顺序与旧实现完全一致**——stage-05 既有 `chapter-generation.test.ts` **必须回归通过**；加载 skill 失败**静默降级为不注入**（`catch(() => [])`，保证生成链路可用）。
- **两层验证**：单元 = 「注入后 `messages` 含 skill 文本」（可判定单测）；效果 = 注入前后四维评审对比（T6 度量）。
- **注入口径**：注入 = **全部** `skill_entry`（表**无 status 维度**；入库 skill 均源自 confirmed 素材归纳）。

## [+] UI 接线验证：生产调用非零 rg 断言（防「功能内置无入口」） (2026-10-10)

- **教训来源**：REV-018（交叉判断 `extractFlavorExcerpts`/`mergeByExcerpt` 生产零调用，`multi_model_cross` 通道不可达）+ BUG-001（`export.ts` 三函数与 `material.remove` 生产零调用，素材库「可检索/可导出」UI 不可达）——**纯函数 + IPC 命令 + 契约测试全绿，但功能在 UI 层不可达**。
- **模式**：对「已交付但可能缺 UI 入口」的能力，验证标准**必须**含**生产调用非零**的 `rg` 断言——
  ```powershell
  rg -n -e "materialsToJson" -e "materialsToCsv" -e "downloadExport" src --glob "!*.test.*"
  rg -n "material.remove" src --glob "!*.test.*"
  ```
  预期命中**生产组件**（如 `MaterialLibrary.tsx` / `useMaterialLibrary.ts`），而非仅定义文件或测试。同理验证编排 hook 生产接线（`rg "runCrossJudge" ResearchWorkbench.tsx`）。
- **关键认知**：**测试通过 ≠ 功能可用**——单测覆盖纯函数/契约时，若生产无调用方，缺陷会被全绿测试掩盖。凡「契约先行、UI 后接」的交付，收口须做**端到端可达性**核验（rg 生产调用 + 真实链路测试）。
- **推广**：`--glob "!*.test.*"` 排除测试夹具，避免「仅测试引用」被误判为已接线（呼应「rg 验证口径区分逻辑/数据夹具」）。
