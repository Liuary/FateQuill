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

## [+] Tiptap 撤销分组合并（`undoRedo.newGroupDelay`）(2026-10-10)

- **需求**：一次 `Ctrl+Z` 撤销整段 AI 生成（而非散成数百条历史）。
- **方案**：流式插入**保持默认入历史**，`StarterKit.configure({ undoRedo: { newGroupDelay: 5000 } })` 把 5s 时间窗内相邻事务**自动合并为单条历史**；用户手动编辑（超窗/光标移动）自然断组。
- **反例（不可行）**：`addToHistory:false` + 会话末 `delete+insert 同文本` 的 commit 事务对文档**净变化为零** → undo 不弹出生成文本；且会连带误删会话前内容与生成期间用户输入。
- 注：StarterKit 3.31.4 撤销扩展来自 `@tiptap/extensions` 的 `UndoRedo`，配置键为 `undoRedo`。

## [+] IME 排队监听 `editor.view.dom` 的 DOM composition 事件 (2026-10-10)

- Tiptap `editor.on` 事件总线**不含** composition 系列；IME 排队须 `editor.view.dom.addEventListener("compositionstart"/"compositionend")`。
- 组合期间 Chunk 入队，`compositionend` 后 flush；组件卸载/实例销毁时 `removeEventListener`（`dispose()`）。
- 测试用 `editor.view.dom.dispatchEvent(new CompositionEvent("compositionstart"/"compositionend"))` 模拟。

## [+] 自动保存串行链 `chainRef`（防慢写覆盖新写）(2026-10-10)

- 自动保存：**防抖 800ms** + **flush 三时机**（切章前 await / 窗口关闭前 / 失焦可选）+ 失败 **5s 线性退避**重试（上限 5）。
- **串行化**：所有保存串到同一条 promise 链尾（`chainRef`），执行时**重新取 `editor.getHTML()`**（最新优先） → 消除「慢写旧内容覆盖新写」（并发无互斥的静默丢失）。
- **清脏标时机**：须在 `await` **之前**清（保存期间的新编辑重新置脏 → 触发后续保存）；失败保留脏态。
