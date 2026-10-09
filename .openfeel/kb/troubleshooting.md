# 排查经验

> 记录常见问题、调试流程与已知坑位。`[+]` 启用 / `[-]` 禁用。

## [+] pnpm 安装坑：npm 11 allow-scripts 拦截原生二进制安装 (2026-10-08)

- **现象/根因**：使用 npm 安装 pnpm 时，npm 11 的脚本安全策略（allow-scripts）拦截 pnpm 原生二进制安装，导致 pnpm 不可用。
- **处理**：改用 **pnpm 官方独立安装器**（standalone installer）解决；本仓另有 corepack 路径——`packageManager` 已固定 `pnpm@12.10.1`，可用 `corepack enable` + `corepack pnpm`。
- **提示**：若 `pnpm -v` 不在 PATH，全程以 `corepack pnpm` 代替；若 `cargo` 不在 PATH，执行 `$env:PATH += ";$env:USERPROFILE\.cargo\bin"`。

## [+] Tailwind v4 CSS-first 与 shadcn preset 体系 (2026-10-08)

- **Tailwind v4 = CSS-first**：无 `tailwind.config.js`；入口 `src/index.css` 用 `@import "tailwindcss";`，shadcn 主题为 CSS 变量 + `@theme inline`。
- **shadcn CLI preset 交互**：新版 shadcn（实测 v4.21.4）`init` 为 preset 交互式；`-b radix` 语义随版本可能变更（历史为 `--base-color`）。执行前先 `pnpm dlx shadcn@latest init --help` 校验 `-b` 语义；非交互初始化用 `--template vite --preset nova --no-monorepo --yes`。
- **preset 副作用**：preset 会引入额外运行时依赖（radix-ui / `@fontsource-variable/geist` 等）与 `pnpm-workspace.yaml`，`components.json` style 变为 `radix-nova`（非默认 `new-york`）。
- **本地 `cn` 回正**：新版 shadcn 组件可能从 `cn` 包导入；本仓按约定改为本地 `src/lib/utils.ts`（clsx + tailwind-merge），组件从 `@/lib/utils` 导入。
- **依赖卫生**：shadcn CLI 属**生成工具**，增补组件统一走 `pnpm dlx shadcn@latest add ...`，**不要**声明为应用 runtime 依赖（否则生产安装拉入无用 CLI 依赖树，REV-016）。
- > **更新于 2026-10-09**：该 `shadcn` 包**并非纯 CLI**——它同时提供**构建期 CSS**（`src/index.css` 的 `@import "shadcn/tailwind.css"`）。直接移除会致 `pnpm build` EXIT 1，正确处理是迁入 `devDependencies`（构建期依赖），详见下条「构建期依赖陷阱」。

## [+] TS 6 弃用 `baseUrl`（TS5101） (2026-10-08)

- **现象**：tsconfig 设置 `"baseUrl": "."` 在 TS 6.0.3 下触发 TS5101 弃用报错。
- **处理**：移除 `baseUrl`，仅保留 `"paths": { "@/*": ["./src/*"] }`，别名照常解析（现代 TS 推荐写法）。

## [+] `resolveJsonModule` 预检（JSON 模块导入） (2026-10-08)

- **场景**：i18n 等 `import xx from "@/locales/.../common.json"`。`moduleResolution: "bundler"` 下 TypeScript 导入 JSON 需显式 `"resolveJsonModule": true`。
- **后果**：缺失时 `pnpm build`（`tsc` 阶段）报 **TS2732/TS5097**，构建直接失败（Vite 运行时能处理 JSON，但 tsc 会拦截）。
- **处理**：导入 JSON 前显式核实/补齐 `resolveJsonModule`；`"esModuleInterop": true` 可作 JSON 默认导入兜底。

## [+] 构建期依赖陷阱：`shadcn` 提供构建期 CSS，前端绑定包零引用即死依赖 (2026-10-09)

- **现象/根因**：`shadcn` 包被置于 `dependencies`（REV-016 判定为 CLI 误入）。但执行期取证发现：`src/index.css` 有 `@import "shadcn/tailwind.css"`，构建期需消费其提供的 `@utility`/自定义 variants/keyframes——**该包不是纯 CLI**。`pnpm remove shadcn` 后 `pnpm build` EXIT 1（`enhanced-resolve` 无法解析 `shadcn/tailwind.css`）。
- **正确处理**：**不删除、不改 `index.css`**，仅把 `shadcn` 由 `dependencies` 迁至 `devDependencies`（构建期依赖，非运行时）。验收改为「`shadcn` 不在 `dependencies` 且 `pnpm build` 通过」。
- **同类：Tauri 插件前端绑定包**——`@tauri-apps/plugin-sql` 在「插件仅 Rust 侧」裁决下**零引用**，安装即死依赖（REV-009）。前端数据访问经自定义 `#[tauri::command]`，**不安装**该前端绑定包。
- **通用原则**：判断依赖分组前先确认其**是否在构建期被消费**（CSS import / 构建插件），不能只按「名字像 CLI」就移除；零导入的前端绑定包应直接不安装。

## [+] sqlx 直依赖取池：经 `DbInstances` state 访问插件连接池 (2026-10-09)

- **场景**：封装边界裁决「插件仅 Rust 侧」后，自定义 `#[tauri::command]` 需拿到 SQLite 连接池执行查询。
- **做法**：`tauri-plugin-sql` 以 Tauri state 暴露 `DbInstances(RwLock<HashMap<String, DbPool>>)`，`DbPool::Sqlite(sqlx::Pool<Sqlite>)`；命令经 `app.state::<DbInstances>()` 取池。
- **代价（必要）**：因需暴露 `sqlx::SqlitePool` 类型，Rust 侧须**直接依赖 `sqlx 0.8`**（与插件内部同主版本，semver 合并，不冲突）。这是「前端禁插件 API」裁决的必要代价，非冗余依赖。
- **备选**：若不直接依赖 sqlx，则只能退回前端 `@tauri-apps/plugin-sql` 默认用法（SQL/Database 实例散落前端），违反 C-04 封装边界，故不采纳。

## [+] SQLite `UNIQUE` 约束下逐条 `UPDATE order_index` 中途冲突 (2026-10-09)

- **现象**：在 `UNIQUE(volume_id, order_index)` 表上做换序/移动时，逐条 `UPDATE ... SET order_index=i` 会在中途撞唯一约束（目标值被尚未移走的旧行占用）。
- **处理**：改用**两阶段重排**（先在事务内把待重排行置唯一负值，再落定连续值）——见 `kb/patterns.md`「两阶段 order_index 重排模式」。移动章另先置负值暂避，再重排源/目标卷。
- **提示**：SQLite 的 UNIQUE 是**立即**校验（非延迟），需在应用层规避中途冲突，不能依赖事务结束再校验。

## [+] dead_code 卫生：预留错误码常量加 `#[allow(dead_code)]` (2026-10-09)

- **现象**：`cargo check` 报 `constant MIGRATION_FAILED is never used`（`error.rs`）。迁移失败由插件 `preload` 阶段在应用启动时处理，**不走 IPC 命令路径**，该错误码当前无消费点。
- **处理**：作为错误码**公共契约完整性**的一部分**保留**，在 `codes` 模块或该常量上加 `#[allow(dead_code)]` + 中文注释「预留：迁移失败错误码（迁移在插件 preload 阶段执行，暂无 IPC 消费点）」；stage-03 挂接启动错误上报时即可消费。
- **取舍**：不因单个 dead_code 告警删契约项，也**不长期放任告警**——告警会稀释真实告警可见性，须显式 `allow` 并注明原因。

## [+] reqwest 用 native-tls 规避 aws-lc-rs 的构建负担（Windows） (2026-10-09)

- **背景**：reqwest 0.13 默认启用 rustls（依赖 aws-lc-rs），在 Windows 上需 CMake/NASM 工具链，构建负担重且易在 CI 失败。
- **处理**：`reqwest = { version = "0.13", default-features = false, features = ["native-tls"] }` → 走 Windows schannel，免 aws-lc-rs/CMake/NASM。SSE 走 http/1.1，无需 http2，关闭 default-features 正确。
- **通用**：Windows 平台优先 native-tls（schannel）；仅需跨平台一致/去系统依赖时才评估 rustls（须先确认 aws-lc-rs 构建链就绪）。

## [+] keyring 4 平台后端与 `delete_credential` API (2026-10-09)

- **后端**：`keyring = "4"` 默认 `v1` feature 自动选择平台后端——Windows = 凭据管理器（Credential Manager）、macOS = Keychain、Linux = Secret Service。
- **API**：`Entry::new(service, account)` → `set_password` / `get_password` / `delete_credential`；用 `Err(NoEntry)` 实现 `exists`（读到即 true，NoEntry 即 false，其它错误 → INTERNAL）。
- **诊断**：平台初始化/写入失败时 `Entry::store_status()` 可诊断；统一映射为 `INTERNAL`。
- **备选否决**：`tauri-plugin-stronghold`（加密保险库 + 口令解锁会话语义）对「存几条 API Key」过重，已否决。

## [+] Tauri Channel vs emit 广播：流式取消语义差异 (2026-10-09)

- **要点**：流式分块回传必须用 **`Channel`**（命令级专属、请求隔离、可配套 AbortHandle）；**`emit` 为广播**语义，多请求会串扰、无背压，且**无法安全取消单条流**。
- **排查信号**：多请求并流时事件互相污染 / abort 后仍收到事件 / 无法定位某条流的结束 → 检查是否误用全局 `emit`。
- **配套**：`abort_stream(request_id)` 须在连接生命周期内有效（`StreamRegistry` 注册 `AbortHandle`，relay 结束或 abort 后移除键），否则句柄泄漏、取消失效。

## [+] 迁移 v2 纪律：走内置 migrations 数组、include_str 单一来源、不旁路 (2026-10-09)

- **纪律**：新增能力必须走 `tauri-plugin-sql` 内置 migrations 数组追加（`include_str!` 单一来源 + `_sqlx_migrations` 幂等），**不得**旁路（如 JSON 文件存配置、手工改库）。
- **落地**：`0002_model_config.sql` 经 `db/migrations.rs` 追加 version 2；`cargo test` 经 `sqlx::migrate!("./migrations")` 与生产**同源**消费，保证测试库/生产库 schema 一致。
- **回归**：升级迁移后须同步更新既有断言——`migration_creates_schema` 表清单加新表、`migration_is_idempotent` 的 `_sqlx_migrations` 计数递增（v2 → `==2`），否则旧期望会误报。

## [+] `react-hooks/set-state-in-effect` 规避：effect 内异步回调 setState (2026-10-10)

- **现象**：`useChapter`/`useOutline`/`useNovels` 在 `useEffect` 内**同步** `setState`（`setChapter(null)`/`setLoading(true)`/`setVolumes(...)`）触发 ESLint `react-hooks/set-state-in-effect`（error）。
- **处理**：effect 改为**仅异步回调**（`.then` / `queueMicrotask`）内 setState；`loading`/`chapter` 等改为**派生值**（如 `loaded?.id !== chapterId`）；加载函数抽为模块级或 `.then` 回调。
- 影响 op-003/005/006/008 多个 hook；属 react-hooks 新版规则，须在设计 hook 时预留异步边界。

## [+] Tiptap 事件总线不含 composition 系列，IME 排队需监听 DOM (2026-10-10)

- **现象**：`editor.on("compositionstart", ...)` **永不触发**——Tiptap `Editor` 事件总线仅发射 `create`/`update`/`selectionUpdate`/`transaction`/`focus`/`blur`/`paste`/`drop` 等编辑器生命周期事件，**不含 DOM 级 composition 事件**；`composing` 恒为 false，IME 排队为死代码。
- **后果**：AI 插入会在用户中文输入法组合期间直接 `dispatch`，**打断/污染 IME 组合**（社区核心用户场景）。
- **处理**：改监听 `editor.view.dom` 的 `compositionstart`/`compositionend`（见 `kb/patterns.md`），并在卸载时移除监听。
- **排查信号**：IME 组合期间插入未排队 / `editor.on("composition*")` 监听器不触发 → 检查是否误用 `editor.on`。

## [+] 切章 × 防抖丢数据坑（BUG-001 根因） (2026-10-10)

- **现象**：编辑第 1 章后在 **800ms 防抖窗口内**切第 2 章，第 1 章的编辑**永久丢失**（实测 `update_chapter` 仅写第 2 章、零写第 1 章）。
- **根因**：切章未先 flush；`RichTextEditor`（`key=chapterId`）卸载、Tiptap 实例销毁，残留防抖计时器回调旧闭包 `editor.getHTML()` 失败 → 置脏重试经 `enqueueRef` 误写**当前活动章**。
- **修复**：`requestSelectChapter` 守卫（先 `await flush` 成功才切）+ `useAutoSave` 的 `chapterIdRef` 章号守卫 + 集成测试「编辑→<800ms 切章→切回内容完整」。
- **通用教训**：跨实例切换（销毁/重建）前必须**同步 flush 并 await**；异步防抖回调须带**目标标识（章号）守卫**，避免切换后误写活动对象。

## [+] 生产构建 chunk 体积警告（Tiptap/ProseMirror 入口 850KB / gzip 268KB，REV-015） (2026-10-10)

- **现象**：`pnpm build` 报 Vite 警告「chunk > 500KB」（入口 chunk **850KB / gzip 268KB**，2026-10-10 实测 `dist/assets/index-*.js` 850.15 kB │ gzip 267.65 kB；stage-04 支点 ~836KB），为 Tiptap/ProseMirror 核心体积固有。
- **处理**：**v0.1 接受现状**（核心依赖懒加载收益有限）；**v0.2 评估**（`manualChunks` 分包 editor/orchestration，或 StarterKit → 精选扩展裁剪）。
- **判定**：非错误、不影响功能；**不单独立任务**，记为已知项一行备查。

## [+] 流式插入与撤销交互：aborted 分支未收敛致状态残留 (2026-10-10)

- **现象**：用户点击「停止」后 `generationStore.status` 残留 `'streaming'`、`requestId` 非空（「半态」），面板状态显示错误。
- **根因**：`start()` 循环退出后仅 `if (!abort.signal.aborted) g.finish();`——**aborted 分支无收敛动作**；`stop()` 若只 `abort()` 而不复位，状态无法收敛。
- **处理**：`stop()` 仅触发 `abort`，收敛由 `start` 收口——循环后 `if (abort.signal.aborted) g.reset(); else g.finish();`；`catch` 走 `fail(IpcError)`；`finally` `dispose()` + `abortRef.current=null`（无悬挂）。断言 `abortRef.current === null`（测试可注入句柄）。
- **撤销交互**：一次 `Ctrl+Z` 撤销整段生成**依赖 stage-04 `newGroupDelay=5000` 的分组合并**，本阶段不重复实现（详见 `kb/patterns.md`「Tiptap 撤销分组合并」）。
- **通用**：中止类操作须显式复位「进行中」状态，勿依赖后续步骤补救（会残留已知中间态）。

## [+] Token 超限防护：上下文预算裁剪 (2026-10-10)

- **风险**：单 Agent 生成把系统提示 + 设定卡 + 前章正文 + 用户指令直接拼入 `messages`，长文/多设定卡时可能超出模型上下文窗口，导致请求失败或截断。
- **处理**：装配器按定稿预算裁剪（系统≤1k + 设定卡≤2k + 前章末尾≤2k + 用户指令不裁；总≤8k），超限按「设定卡→前文」顺序削减；前文取**末尾 M 字**（v0.1 无摘要能力）。
- **注意**：单位取字符数（`String.length`）；`chapter.content` 为 HTML，须先 `stripHtml` 再截取（否则截断标签）。裁剪单测覆盖各源/合计超限。
- **口径**：`word_count` 为近似值，**不得**用作精确 token 估算（见 `kb/patterns.md`「word_count 近似值约定」）。

## [+] 真实 WebView 性能测量待办（人工协验，非缺陷） (2026-10-10)

- **现象**：自动化测试（jsdom）**无法**测量编辑器真实延迟与内存——jsdom 无布局引擎，P95 / 堆增幅口径失真。
- **待办**：`corepack pnpm tauri dev` → 窗口内 BenchPanel（仅 DEV）→「运行延迟基准（200 次插入）」读 **P95**（目标 <16ms）→ 切 20 章后「统计 .ProseMirror 实例数」（应 =1）→「记录堆增幅」（<20%）→ 回填 `src/features/editor/perf/README.md` 实测表。
- **状态**：v0.1 收口仍为**人工协验待办**（stage-05 REV-009 / stage-04 REV-014 合流）；自动化部分（seed/p95 逻辑/边界）已单测覆盖。
- **判定**：非缺陷、不阻断功能；完成实测并复核后相关 REV 方可 closed。
