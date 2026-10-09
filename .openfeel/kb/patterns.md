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

## [+] 温度 clamp + 并行乱序归位（索引槽位 + 取任务前查中止） (2026-10-10)

- **per-provider clamp**：`PROVIDER_TEMPERATURE_RANGE: Record<string,[number,number]>` + `clampTemperature(t, providerId) → { effective, clamped }`（`clamped = effective !== temperature`；未知 provider 回退 `[0,2]`）；越界分支保留并 UI 显式标注 `effectiveTemperature`/`clamped`（**不隐藏、不丢弃**——温度语义差异由用户裁决兜底）。温度集持久化 `loadTemperatures`/`saveTemperatures`（缺失/损坏/非有限数 → 默认集；存储不可用静默忽略）。
- **乱序归位**：并行任务**先按输入顺序预置结果槽位**（`results = branches.map(...)`），worker 以**索引**写回 `results[index]` → 输出顺序与完成顺序解耦（测试断言「完成顺序 b1,b2,b0 → 结果仍按输入 b0,b1,b2」）。
- **工作池**：`workerCount = min(concurrency, N)`（默认 3）；worker **取下一分支前**检查 `signal.aborted` → 排队分支不再启动（未启动保持 `pending`）；`runBranch` 内流循环亦检查 aborted。
- **通用**：并行聚合优先「**索引槽位归位**」而非依赖 `Promise.all` 的完成顺序；并发上限与中止信号须在**取任务之前**检查（否则排队项仍会启动）。

## [+] 走向卡存在性校验（过滤 LLM 幻觉引用） (2026-10-10)

- **场景**：走向卡 `settingCardIds` 由 LLM 产出，存在**幻觉引用风险**（引用不存在的设定卡 id）。
- **模式**：`converge` 以 `existingSettingCardIds: Set<number>`（该作品全部设定卡 id）为基准做**存在性校验**——`validRefs = referenced.filter(existing.has)`；无效 id 记入 `deviation.invalidSettingCardIds` 且**触发 `flagged`**；分支的 `card.settingCardIds` 替换为**过滤后**列表。覆盖率仅计**有效引用** ∩ 注入集；另记 `missingSettingCardIds`（存在于作品集但**未注入本次生成**，**仅记录不单独 flagged**）。
- **测试**：引用 `[1,99]`（99 不存在）→ 过滤 99 + `invalid=[99]` + `flagged`。
- **通用**：LLM 产出的**外键/id 引用**须以「**实际存在集合**」校验，幻觉 id 视作**偏离信号**（而非直接信任）；过滤 + 记录 + 降权三件套，不静默吞掉。

## [+] diff 精确集合差（跨分支差异标注，不做模糊对齐） (2026-10-10)

- **场景**：多温度分支对比视图需标注「各分支**独有**的关键转折」。
- **模式**：`diffBranches(branches)` 纯函数——先建 `Map<keyTurn, Set<branchId>>`（同分支内 `keyTurns` 以 `Set` **去重**，重复只计一次），再对每分支分类：`uniqueKeyTurns`（owners.size===1）/ `sharedKeyTurns`（size>1）。
- **精确集合差、不做模糊对齐**（与 stage-07「引文精确交集」同一哲学）；无 `card`（pending/error）分支视其 `keyTurns` 为空（返回空数组，**不抛错**）。
- **并排顺序**：`weight` 降序、并列（含未收敛无权重）→ **温度升序**（op-002 无权重场景即温度序）。
- **通用**：跨集合的「独有/共现」聚合用**精确集合差**；模糊对齐（大小写/空白归一）会引入无声偏差，除非有明确需求否则不引入。

## [+] manualChunks 分包（Vite 8 / rolldown，入口 −60%） (2026-10-10)

- **场景**：生产入口 chunk 因 Tiptap/ProseMirror 体积固有持续膨胀（v0.2 实测 ~850KB / gzip ~268KB），Vite 报「chunk > 500KB」警告（REV-015 承诺 v0.3 评估）。
- **模式**：`vite.config.ts` `build.rollupOptions.output.manualChunks: (id: string) => ...` 按模块 id 分组——`node_modules/@tiptap` | `node_modules/prosemirror` → `editor`；`src/orchestration` → `orchestration`；`src/features/research` → `research`；其余 `undefined`。
- **兼容性**：**Vite 8（rolldown）兼容 `build.rollupOptions.output.manualChunks`**（实测生效，产出 3 个独立 chunk）；strict TS 下回调参数须显式标注 `(id: string)`。
- **实测收益**：入口 **909.94 → 356.57 kB raw（−60.8%）**、gzip **285.97 → 111.45 kB（−61.0%）**，JS 总增量 ≈0（+0.02 kB），`>500 kB` 警告消除 → **判定采纳**（保留配置）。残余 `editor` chunk 466 kB 为后续可选优化（StarterKit → 精选扩展裁剪）。
- **报告落点**：`docs/build-size-report.md`（基线 / 分包后 / 收益判定 / BLOCKED 跟踪）。

## [+] 手写类型守卫做数据校验（无第三方校验库，零新增依赖） (2026-10-10)

- **场景**：64 卦静态数据需运行时校验（计数/唯一性/集合覆盖/映射自洽）。初版计划用 `zod`，审查（REV-006）判定其为**未声明的第三方依赖**（`package.json` 无、`src/` 源码零引用），违反「零新增依赖」惯例与 C-08。
- **裁决与模式（采纳方案①）**：改用**手写 TS 类型守卫 + 运行时断言**（`src/data/iching/validate.ts`）——`validateIChing(ex, tri): { ok, errors[] }` **逐条收集错误（不早退）**，规则：① 64 卦 ② 384 爻 ③ 名唯一 ④ 8×8 组合 ⑤ King Wen 1~64 连续 ⑥ binary↔卦名自洽（先校验 binary 为 6 位 0/1，再 `binaryToNames` 上/下卦核对）。
- **要点**：六条规则本就需自定义逻辑，schema 库开箱能力覆盖有限 → **手写收益不低于引入依赖**；报错粒度「**总数级 + 单条级双报错**」（如爻辞总数 ≠384 与某卦 `lines.length≠6` 分列）；类型 `LineState`（变爻契约）即便暂无数据也**保留为契约**并注释。
- **验证**：正向（六规则 + 乾/坤/既济抽样）+ **负向**（篡改 → `ok=false`）；`rg "zod" package.json src/data/iching` **零命中**（裁决落地断言）；实现注释与文档改「不引入任何第三方校验库」表述（保留裁决可读性、去掉库名字面量）。
- **通用**：为单一功能引入第三方依赖前先评估「手写收益 vs 依赖成本」；校验/断言类能力常可零依赖手写（见 C-08）。

## [+] 朱熹变爻纯函数 + 可注入随机源（种子复现） (2026-10-10)

- **场景**：起卦与解卦须与 UI/IO 解耦、可判定单测。
- **模式**：`src/orchestration/iching/` **纯函数**（无 IO）——`deriveHexagram(lines: LineState[]) → Casting`（本卦/之卦=变爻取反/变爻下标）；`zhuXiReading(changingLines, benGua, zhiGua) → ZhuXiReading`（朱熹七情形，`{ changingCount, source:"ben"|"zhi"|"both", lineIndices, primaryIndex? }`）；**`readingVerses(casting)`** 单一来源据 `reading` 取原文（卦辞/爻辞）数组，供引导卡与 UI 复用（避免多 op 重复实现）。
- **一致性守卫**：`zhuXiReading` 把传入的 `benGua`/`zhiGua` 用于**不变量校验**（变爻集合须等于两卦 `binary` 差异位，否则抛错）——既避免 `noUnusedParameters` 告警，又提供真实负向可测点。
- **起卦可注入性**：`castRandom(rng = Math.random)` 逐爻用三枚铜钱法（每枚 2/3 → 和 6/7/8/9 → 老阴(变)/少阳/少阴/老阳(变)）；`createSeededRng(seed)`（mulberry32）支持**种子复现**（如 `castRandom(() => 0)` → 六爻皆老阴 → 坤之乾，可判定）；`castManual(binary, changingLineIndices)` 手动指定。
- **测试**：`derive.test.ts` 覆盖朱熹 **0~6 全七情形**（含 3 爻变 `source="both"`、4 爻变 `primaryIndex`、5 爻变）+ 一致性守卫；`random.test.ts` 种子序列一致 + 手动指定正确 + UI 无「时间起卦」入口。
- **通用**：领域算法（解卦/推导）做**纯函数 + 可注入随机源**，把不确定性收敛到单一注入点，便于种子复现与全分支单测。

## [+] store 单例状态共享（防多实例独立 `useState` 不同步） (2026-10-10)

- **教训来源**：BUG-001（medium）——开关 hook `useIChingEnabled()` 在开关 UI（`ExplorationPanel`）与消费侧（`useExploration`）**各调用一次**，实为**两份互不相通的 `useState`**；写 `localStorage` 后另一实例不重读 → **运行时切换开关不生效**（引导未注入），且反向（挂载时开、运行关）引导仍注入。
- **模式（采纳 store 单例）**：把跨组件共享的开关状态**提升到已有 store 单例**（`explorationStore.ichingEnabled` + `setIChingEnabled` 写 store + `localStorage`）；`useIChingEnabled` 改造为 **store 薄封装**（`useExplorationStore(selector)` 读 + 动作，**保留对外 API 不变、移除本地 `useState`**）；消费侧 `useExploration` 改 **store 选择器** → store 订阅天然驱动两处**同步重渲染**。
- **采纳理由**：`explorationStore` 已是该域会话单例（`casting` 等跨组件状态已在其中，REV-007 先例）；**比 Context/storage 事件更简单、可测、零新增依赖**。
- **验证**：运行时切换用例——挂载关闭 `guideCalls=[]` → 运行时 `click` 开启 → `["buildGuideCard","renderGuideText"]` + `localStorage="true"` → 运行时关闭 → 零调用 + `"false"`；hook 级「`setIChingEnabled(true)` 后 `ichingEnabled` 立即为 true（无需重挂载）」。
- **通用**：**跨组件共享的可变状态必须单一数据源**——勿让多个组件各持一份 `useState`（持久化/存储 ≠ 状态同步）；优先复用已有 store 单例。

## [+] 装配层可选注入参数（向后兼容，缺省零影响） (2026-10-10)

- **适用**：跨阶段为既有装配函数追加可选能力（stage-05 `skills?` → stage-08 → stage-09 `hexagramGuide?`），须**零回归**。
- **模式**：`buildExplorationOptions` 增**可选参数 `hexagramGuide?: { text: string }`**——开启且已起卦时把 `renderGuideText(buildGuideCard(casting))` 并入 **system 约束段**；**缺省/未传时输出与基线逐字段一致**（`toEqual` 断言）。
- **实现要点**：system 段用**数组拼装 + `filter(Boolean)`**（`[baseSystem, constraints, guide].filter(Boolean).join("\n\n")`）——空 guide **不产生空段残留**；**空白 guide 视为未传**（`trim()` 后判空）；只改 system 段，`intent`（user 段）与 `settingCardIds` 不变。
- **求值稳定性**：消费侧以 `useMemo([enabled, casting])` 计算 guide（关闭或未起卦 → `undefined`），避免每次渲染重算并保证关闭时**零调用**。
- **零副作用断言落点**：`buildExplorationOptions` 本身**不引用**卦象模块（文本由调用方渲染）——故「模块零调用」断言落于宿主组件（`vi.mock` 记录 `buildGuideCard`/`renderGuideText`）；装配层测试保留「缺省/空白 → 与基线逐字段一致」。
- **通用**：向后兼容的可选注入 = **可选参数缺省旁路 + 空值语义归一（空白=未传）+ 数组拼装无空段 + 消费侧 memo 稳定求值**；跨阶段扩展须回写 `manual/` 并做既有测试全量回归。

## [+] 防串味装配断言（秘密 X 不入他人 prompt，白名单穷举） (2026-10-10)

- **场景**：多声部对话须可判定地保证「角色 A 的私有设定（秘密/内心/目标）不泄漏进角色 B 的 prompt」。
- **模式（装配层断言，而非产出台词抽查）**：构造「角色 A `profile.personality` 含唯一秘密串 `X`」，断言 `buildCharacterAgentInput({ selfProfile: B, publicContext, others: [A] })` 的 **`system + user` 拼串不含 `X`**；同时断言 B 输入**含** A 的公开身份**一行摘要**（`identity`）、**不含** A 的 `personality`/`speechStyle` 私有细节。
- **白名单穷举**：随机注入多角色，断言**仅 self persona 全文**被包含（他人一律只透公开摘要）；`toCharacterOptions` 生产入口端到端覆盖（杜绝调用方绕过）。
- **独立探针复验（防自证）**：验收阶段以**唯一标记**（如 `ZXQ9137_SECRET_月蚀弑父`）走**真实生产路径**（`DialoguePanel` → provider 捕获实际 `options`）复核，**不复用实现方用例**。
- **口径边界（诚实声明）**：自动判据 = **prompt 构造正确性**（装配层）；**产出文本语义符合度**不在此断言，走 stage-06 评审人工协验。
- **通用**：对「隔离 / 防泄漏」类需求，把判据落在**装配层的可判定断言**（注入唯一标记 + 断言其不出现在非授权对象），而非对 LLM 产出做关键词抽查（产出可变、不可稳定判定）。

## [+] 合并落章双路径复用（安全网不重复踩坑） (2026-10-10)

- **背景**：多声部对话产物「合并落章」是**破坏性动作**（可能覆盖当前章正文 + stage-04 自动保存持久化）——直接复用 stage-08 采纳分支的**双路径安全网范式**（REV-007 教训），**不重复踩坑**。
- **主路径「新建下一章草稿」（推荐、无损）**：`chapter.create`（`orderIndex = 卷内 max+1`，追加卷末），**不改当前章 DB 行** → 自动保存不可能覆盖原正文；**不适用 `Ctrl+Z`**。
- **次路径「替换当前章」（危险）**：`EditorController.replaceContent`（**单条撤销**）；执行前**强制**入池快照（`reviewStore.addVersion({ label: "dialogue-merge-safety", content: 替换前正文 })`，**必做非可选**）+ `finally dispose()`。
- **确认门**：两路径均经**内联二次确认**（复用 `ConfirmInline`）；取消 → **零副作用**（无 create / 无 replace / 无入池）。
- **顺序断言**：次路径以 mock `replaceContent` + `vi.spyOn(reviewStore.addVersion)` **共用调用序数组**，断言 `["addVersion","replaceContent"]`（**先快照后替换**，顺序可判定）；主路径断言 `update_chapter` **零调用**（当前章 DB 行不被覆盖）。
- **不自动清空**：合并后会话条目**保留**（可回看 / 再次合并到别处），用户手动清空——**数据安全优先**。
- **通用**：破坏性动作 = **确认门 + 无损替代路径 + 强制回滚点**（同 `kb/troubleshooting.md`「采纳误触致数据丢失」）；跨阶段**复用已验证的安全网范式**而非另起炉灶。

## [+] 会话内存 store 范式：独立 create + orderIndex 恒连续 + 单例共享 (2026-10-10)

- **范式（跨阶段复用）**：会话级产物（stage-08 分支 `explorationStore`、stage-10 对话条目 `dialogueStore`）以**独立 `create()` 的 Zustand store** 承载，**内存不落库**（关闭即弃；「合并后的正文才是资产」）；与 `editorStore`/`generationStore` **并列、不互相 `setState`**。
- **orderIndex 恒连续**：条目排序以显式 `orderIndex` 为序（非数组下标 / 生成时间）；`addEntry`（末尾 +1）/ `insertAt`（clamp `[0,n]`，其后重排）/ `removeEntry` / `moveEntry`（相邻交换，越界**原样返回**）后，`entries.map(e => e.orderIndex)` **恒为 `0..n-1`**（**不变量入测试**）。
- **单例共享**：`dialogueStore` 经 `src/store/index.ts` 导出**单例**，跨组件读写**同源**（避免多份独立 `useState` 不同步，见 `kb/troubleshooting.md`「多实例独立 useState」）。
- **会话内存边界断言**：store 文件仅 `create()`、**无持久化**（`rg -e "create" -e "persist"` 核验）；`clear()` 清条目保持空。
- **通用**：会话级中间产物用「**独立 create + 内存 + 显式序标不变量 + 单例共享**」四件套；与既有 store 严格隔离，仅经受控命令面（如 `EditorController`）跨域通信。

## [+] 单源装配（删除本地最小实现，改调共享函数 + 生产调用非零断言） (2026-10-10)

- **教训来源**：BUG-001——`useDialogue` 内为过渡保留了**同名最小 `buildPublicContext`**（op-003 占位），而完整的 `context.buildPublicContext`（op-006）**生产零调用**，二者**重名**，致场景上下文仅落地 1/4（详见 `kb/troubleshooting.md`）。
- **模式**：**删除**宿主内本地最小实现，**改调共享模块函数**（`import { buildPublicContext } from "@/orchestration/dialogue/context"`）→ **单一来源**；`rg "const buildPublicContext" src/features/dialogue` **零命中**（消除重名）。
- **验证双断言**：① **生产调用非零**——`vi.mock(path, importOriginal)` **spy 包装真实实现**，断言调用次数 ≥1（既不破坏输出断言，又能证明生产可达）；② **输出正确**——断言实际送入 provider 的 `options.messages` 含预期各块（四块场景上下文）。
- **反向用例**：空输入 → 对应块**不出现**（零副作用），避免「有调用但输出错误」假绿。
- **通用**：**同义函数只应有一份**——过渡期占位必须在接线时**替换（非并存）**；凡「契约先行、接线后补」的交付，收口须以「**单源 rg 零命中 + 生产调用非零 spy**」双断言核验，否则测试全绿亦掩盖缺陷。

## [+] evidence 原文回查（防 LLM 抽取幻觉：规范化空白子串断言） (2026-10-10)

- **教训来源**：stage-08 走向卡「存在性校验」范式（过滤 LLM 幻觉引用）——stage-11 归档抽取器（LLM 从章节正文抽设定）复用同一范式。
- **模式**：抽取输出 `{ name, kind, suggestedTier, content, evidence }`，其中 **`evidence` 为原文逐字片段**；`verifyEvidence(candidate, chapterText)`：**规范化空白后**断言 `evidence` 为 `chapterText` 的**子串**——不满足者**直接剔除**（硬闸，防幻觉）。
- **文本同源**：`toPlainText(html)`（去标签 + 折叠空白）**同时**用于构造 prompt 与回查，保证两侧文本一致。
- **口径细节**：跨行/多空格差异仍通过；**无空白处插入空白不视为匹配**（子串语义严格）。
- **分层容错**：**顶层非法**（JSON 语法/非对象/`settings` 非数组）→ 抛错（收为 `ok:false`，交 UI 提示）；**单条非法**（缺 `name`/`evidence`）→ **静默丢弃**（不影响其余）。
- **通用**：凡 LLM 产出「引用既有内容」的字段，一律要求**原文逐字片段 + 回查子串断言**，不匹配即剔除；回查文本与 prompt 文本**必须同源**。

## [+] 注入白名单 fail-closed（未标注默认注入，未知值排除） (2026-10-10)

- **模式**：分级/枚举过滤采用**三重边界语义**（`isInjectableTier`）：① 白名单内（`main`/`short`）→ true；② **未标注**（`null`/空串，历史数据）→ true（沿用既有默认，避免静默丢设定）；③ **`dark`/`temp` 或未知值 → false（fail-closed）**。
- **理由**：安全敏感过滤（暗线保密）须**默认排除未知**——新枚举值出现时宁可少注入（安全）不可误注入（泄密）；而「历史未标注」是**已知安全默认**（迁移 DEFAULT `short`），故放行。
- **接线形态**：装载侧可选参数 `injectSettings?: boolean`（默认 `true`）贯穿三处装载，**契约签名仅可选扩展**（向后兼容，调用方不改）；「关」= 完全不注入。
- **可判定**：白名单单测（四类判定 + 边界 + 历史未标注 + 混合过滤含**不变量断言「结果无 dark」**）+ 三装载点各「含 main/short、不含 dark/temp」+「关 → 与无卡基线逐字段一致」。
- **通用**：枚举过滤的边界语义要**显式三态**（白名单 / 已知安全默认 / fail-closed），并写入单测；勿用二元「在集合内」掩盖「未知值」分支。

## [+] 迁移加列 + CHECK 四级枚举（幂等断言三件套） (2026-10-10)

- **模式**：迁移 v5 `ALTER TABLE setting_card ADD COLUMN tier TEXT NOT NULL DEFAULT 'short' CHECK (tier IN ('main','dark','short','temp'))`——**SQLite 允许 `ADD COLUMN` 携带列级 `CHECK`**（禁的是 PRIMARY KEY/UNIQUE 与无默认的 NOT NULL）；实测通过，无需退化应用层校验（应用层 `validate_tier` 仍保留为纵深防御）。
- **纵深防御**：DB `CHECK` 兜底 + 应用层校验（RB，非法报 `VALIDATION`：`create`/`update`(显式传参)/`list` 过滤值三处）；过滤**参数化**（`WHERE tier=?`，无字符串拼接）。
- **幂等断言三件套**：表数 **9→10**（`migration_creates_schema` 补 `conflict_record` + `rows.len()==10`）、`_sqlx_migrations` **4→5**、**新增列存在**（`migration_adds_setting_card_tier_column`：`PRAGMA table_info(setting_card)` 含 `tier`）。**升级迁移后须同步更新既有断言**，否则旧期望误报。
- **通用**：加列迁移的验收 = 「**新表/列存在 + 迁移计数递增 + 二次 run no-op**」；`CHECK` 优先落 DB（枚举兜底），应用层校验做纵深。

## [+] 误报率样本集（标注真值 + 锚点断言 + 召回，防「零报出伪通过」） (2026-10-10)

- **背景**：L1/L2 一致性校验的 DoD 是「误报率 ≤ X%」——须**可复现、可判定**，避免主观口径。
- **样本集（入库）**：自建 **≥3 章含预埋冲突**样本 `experiments/samples/conflict-01..03.txt` + `ground-truth.json`（人工标注真值：应检出冲突对）；**故意保留一致对照卡**（如潮汐律同值）以暴露误报路径。
- **锚点断言**：`misreport.test.ts` 以锚点固化实测值（**报出 3 / 误报 0 / 漏报 0**）+ **证据完整性**断言（卡 `content` 均为章节原文逐字片段）+ **召回**断言（预埋冲突全检出）——防「零报出伪通过」。
- **阈值**：`MISREPORT_THRESHOLD = 0.2`（**占位待拍板**，单一来源 `report.ts`）。
- **数据状态纪律**：`report.md` 区分**已执行（L1 自动口径=实测）**与**待回填（L2 语义/人工标注核验=BLOCKED）**；**阈值未拍板前不得填任何人工/LLM 分数**（避免占位/编造）。
- **通用**：NLP/统计类验收须「**标注真值集 + 锚点实测值 + 召回断言 + 刻意反例**」；数据状态字段严格区分自动与人工口径，未执行不填分。

## [+] 决策规则纯函数 + 依赖注入端口（编排层不 import `@/ipc`） (2026-10-10)

- **场景**：全自动编排（`autopilot/chain.ts`）需串起推演/生成/审查/重写/归档，且**可 mock 单测**又**真机可跑**——分层约束要求编排层**不 import `@/ipc` / store**。
- **模式**：**决策规则抽为纯函数**（`decide.ts`：`pickBranch`/`shouldRewrite`/`markDegraded`/`shouldAutoConfirmArchive`/`isPassed`，全部无 IO、无 provider、可单测边界）；**外部副作用收敛为注入端口**（`AutopilotDeps`：`streamFor`/`evaluators`/`archiveFn`/`persistence`/`detectConflicts`/`conflictSink`）——真机在 `useAutopilot.ts` 装配（provider / stage-06 注册表 / stage-11 归档 + 冲突端口 / 迁移 v6 持久化），**mock/离线缺省不注入**（纯内存链路）。
- **复用而非重写**：链内**显式引用**既有契约（`buildChapterPrompt` / `runExploration` / `evaluateWithFallback` + `rewriteChapter` + `weightedTotal` / `runExtraction`），以 `rg` 断言「命中既有契约」作可验证性；`reviewFn?` 保留为**测试注入「假审查」**的覆盖点。
- **缺省零副作用**：未注入的可选端口（如 `detectConflicts`/`conflictSink`/`persistence`）→ **不检测、不落库、纯内存**——既有 mock 单测**零改动**通过。
- **通用**：编排层 = 「**纯函数决策 + 注入端口副作用**」；**依赖注入端口**使同一链路在 mock（快、可判定）与真机（装配具体实现）两条路径复用，且不破坏分层（不越界 import IPC/store）。

## [+] 断点 upsert（`UNIQUE(run_id,order_index)` + `ON CONFLICT DO UPDATE` 防重） (2026-10-10)

- **场景**：无人值守全自动的**断点落库**须幂等——中断/续跑会**重复写同一章**（run 起点、每章起点/终点），若仅 INSERT 会撞唯一约束或产生重复行。
- **模式**：`autopilot_chapter` 以 **`UNIQUE(run_id, order_index)`** 约束 + Rust 侧 `save_chapter` 用 **`ON CONFLICT(run_id, order_index) DO UPDATE`** 做 **upsert**（按 run + 章序定位），保证「同章多次写 → 单行收敛」；`save_run` 同法（`id` 缺省 → INSERT，否则 UPDATE）。
- **配套**：状态/章状态以 `VALID_*` 常量 + DB `CHECK` **双保险**（非法 → `VALIDATION`）；`autopilot_run` 删 → `autopilot_chapter` 级联删。
- **验证**：Rust 单测覆盖 save/get/list/**upsert 幂等**（重复写同 `(run_id, order_index)` → 行数不变、字段更新）。
- **通用**：**可续跑**的进度/断点表 = **「业务唯一键 `UNIQUE` + `ON CONFLICT DO UPDATE` upsert」**；写路径按「唯一键定位」而非「每次新增行」，避免续跑产生重复进度。

## [+] i18n 键完整性测试（`en ⊇ zh-CN` + 双层豁免 + 卫生断言 + CI 防回归） (2026-10-10)

- **场景**：英文版收口（界面基本信息）不能靠人工逐页核对——需**可判定、防回归**的自动化。
- **模式**（`src/locales/i18n-completeness.test.ts`）：遍历命名空间，递归取**扁平键路径集合**，断言**每命名空间 `enKeys ⊇ zhKeys`**（缺失即 fail + 列出缺失路径）+ **命名空间集合一一对应**。
- **双层豁免**（`i18n-exemptions.ts`，**键路径全限 `命名空间.键`**）：① `EXEMPT_KEY_PATHS`（允许 `en` 缺的键 + 理由；**UI 标签不得豁免**）；② `VALUE_EXEMPTIONS`（**键仍必须存在**，仅登记「内容类白文不译」范围）——**值豁免不得当后门**（专项断言：命中值豁免的键**仍须存在于 `en`**）。
- **卫生断言**：豁免条目须在 `zh-CN` **真实存在**（防陈旧豁免）+ `reason` 非空 + 总数 **≤ 3**（超须评审）。
- **加载方式坑**：语言 JSON 用 **Vite `import.meta.glob("./*/*.json", { query:"?raw", import:"default", eager:true })`** 而非 `node:fs`——`tsc` 在 `src/**` 下对 `node:fs`/`process` 报 **TS2591**（无 node 全局类型），`pnpm build`（`tsc && vite build`）会因此失败；glob 方案**零新增依赖、零 tsconfig 变更**，`tsc` 与 vitest 均通过。
- **负向自检**：以**构造样本**断言机制（缺键检出 / 完整样本空 / 显式豁免后空），**不污染真实语言文件**；CI 的 `pnpm test` 已覆盖 → 无需新 job。
- **通用**：多语言「键完整性」用**集合超集断言**（`en ⊇ zh-CN`）+ **受限豁免机制**（显式、有理由、有卫生上限）+ **构造样本负向自检**；`src/**` 下读文件优先 Vite glob（避 `node:fs` 的 TS2591）。

## [+] 发布版本三同步（脚本化 `package.json`/`tauri.conf.json`/`Cargo.toml` + 校验脚本） (2026-10-10)

- **场景**：Tauri 桌面应用的版本号散落**三处**（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`），手改易漂移。
- **模式**：`scripts/sync-version.mjs`（**纯 Node 零依赖**，导出 `readVersions`/`writeVersions`）+ `scripts/check-version.mjs`（**校验脚本**：三处不一致 → 退出码 1）——`package.json` 增 `version:sync` / `version:check`；发布前 `node scripts/sync-version.mjs 0.6.0` 三处同步 + `version:check` 断言。
- **测试落点坑**：`vitest.config.ts` 的 `include` **仅覆盖 `src/**`**，`scripts/*.test.mjs` **不会被收集** → 版本校验改用**独立校验脚本**（非 vitest 用例）。
- **通用**：多处重复的发布元数据（版本号）用**同步脚本 + 校验脚本**双件套（写 + 断言），并纳入 CI `verify` job；校验脚本须独立于测试运行器（避免 `include` 范围外漏跑）。

## [+] 依赖许可工具化（`license-checker` + `cargo license` + MIT 兼容白名单 + 例外登记） (2026-10-10)

- **场景**：开源发布需核查依赖**许可兼容 MIT**——人工逐个核对 npm/crate 树不现实也无存证。
- **模式**：`scripts/gen-licenses.mjs`（`license-checker`（npm，**仅 production 依赖** = 随包分发者，`excludePrivatePackages` 排除项目自身）+ `cargo license`（Rust；**未安装 → 跳过并显式标注 + 回填指引**））→ 生成 `docs/dependency-licenses.md`（清单 + **MIT 兼容判定** + **例外逐一登记理由**）。
- **白名单 + SPDX**：MIT 兼容白名单（`MIT`/`ISC`/`Apache-2.0`/`BSD-*`/`0BSD`/`Unlicense`/`CC0-1.0`/`Zlib` 等）+ **SPDX `OR` 表达式支持**（`Apache-2.0 OR MIT` → 兼容 ✅）；已知例外表（MPL-2.0/LGPL-3.0/GPL-3.0/**OFL-1.1**/UNKNOWN/UNLICENSED）**逐条登记理由**。
- **依赖纪律**：工具化所需 `license-checker` 为**唯一新增依赖**——放 **`devDependencies`（显式声明，不入 runtime bundle）**，并登记其传递依赖；`src/**` 无 import（`rg license-checker src/` 零命中）。
- **生成物卫生**：`.prettierignore` 增 `docs/dependency-licenses.md`（**生成物不参与 `format:check`**，避免「生成 → 检查失败」循环）；**生成可复现性**已核验（重跑后 `git status` 无差异）。
- **通用**：合规/元数据类清单优先**工具生成 + 白名单判定 + 例外显式登记**；生成物排除格式化检查；工具自身依赖置于 dev 并显式声明。
