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

## [+] LLM-as-judge 主观性缓解：rubric 内联 + 温度 0 + 夹具回放 (2026-10-10)

- **问题**：LLM 维（剧情/世界观/真人感）打分随机性大，跨次不可复现，加权择优失去可比性。
- **缓解**：① 评审 prompt **内联 rubric**（子维度 + 四档分档，`buildReviewSystemPrompt`）约束打分；② LLM 维严格 `temperature=0` 调用；③ 测试用**夹具回放**（假 provider 逐块 yield mock 响应），断言得分落在 `expected.json` 期望区间 → 判定可回归。
- **口径**：重写质量以**反馈项是否改善**衡量，而非单看分值波动。

## [+] 合规误判人工兜底：规则引擎 + 低分不自动重写 (2026-10-10)

- **问题**：合规规则引擎（词表/正则）内置词表**覆盖范围有限**，存在误判 / 漏判。
- **兜底**：合规低分**仅提示人工裁决，不触发自动重写**（避免自动重写放大误判）；规则版本化（`COMPLIANCE_RULES_VERSION`）以应对中国大陆出版规范演进。
- **正则调优示例**：广告类原 `(点击|扫描)下方?(二维码|链接)` 无法命中「点击**下方的**二维码」等表述 → 放宽为 `(点击|扫描)[^。\n]{0,6}(二维码|链接)`。
- **通用**：高风险 / 主观判定维度（合规、伦理）宜「规则初筛 + 人工终裁」，避免全自动动作。

## [+] 评审 Token 放大（约 4~5× 纯生成） (2026-10-10)

- **问题**：四维审查 = 每次生成（含重写轮次）附带 4 次 LLM 评审调用（每维一次），Token 成本约为纯生成的 4~5 倍；重写再加生成 + 复审。
- **缓解**：① 评审**复用 `model_config` 默认模型**（独立廉价评审模型 `reviewModelName?` 仅预留不实现）；② **非流式收口**（聚合后解析 JSON，不新增流式 UI）；③ 评审输入**沿用生成装配预算裁剪**（见 patterns「评审预算裁剪」）；④ 用户可关闭自动审查 / 自动重写以省 Token。
- **注意**：`word_count` 为近似值，**不得**用作精确 token 估算（见「Token 超限防护」条）。

## [+] chunk 体积（Tiptap/ProseMirror 入口，v0.2 持续增长） (2026-10-10)

> 登记：stage-07 REV-011②。

- **现象**：v0.2 新增审查面板（及后续 research 域）后，入口 chunk **持续增长**；`pnpm build` 仍报 Vite 警告「chunk > 500KB」（2026-10-10 实测 ~850KB / gzip ~268KB）。
- **处理**：**v0.2 接受现状**（核心依赖懒加载收益有限）；**v0.3 评估** `manualChunks` 分包（editor / orchestration / research 分组）或 StarterKit → 精选扩展裁剪。
- **判定**：非错误、不影响功能；与 stage-05 REV-015 登记口径衔接，**不单独立任务**，记为已知项备查。

## [+] 「功能无入口」模式：纯函数/契约测试全绿但生产零调用（REV-018 / BUG-001 同类根因） (2026-10-10)

- **现象**：功能在「纯函数 + IPC 命令 + Rust 层」全部成立、单测全绿，但**用户在 UI 上无法使用**——生产代码中**零调用**该能力。
- **两处实证（stage-07）**：
  - **REV-018（high）**：`extractFlavorExcerpts`/`mergeByExcerpt`/`addPendingResults` 仅命中**定义**，无生产调用方 → 研究台无「开始交叉判断」按钮 → `pendingResults` 恒空 → `multi_model_cross` 通道不可达 → DoD「三采集通道」断裂。
  - **BUG-001（medium）**：`materialsToJson`/`materialsToCsv`/`downloadExport` 与 `material.remove` 仅测试引用 → 素材库缺读取侧 UI → DoD「可检索、可导出」界面不可达。
- **根因**：方案层缺口（op 覆盖了纯函数/契约与测试，但**未规划 UI/编排调用落点**）；`*.test.ts` **正常覆盖纯函数**，于是「测试通过」掩盖了「功能不可用」。
- **排查信号**：
  ```powershell
  rg -n "目标函数名" src --glob "!*.test.*"     # 仅命中定义文件 → 疑无入口
  rg -n "目标仓储方法" src --glob "!*.test.*"    # 零命中或仅被无关功能引用 → 疑不可达
  Get-ChildItem src/features/<域> -Filter *.tsx  # 列出 UI 组件，核对是否存在承载该能力的组件
  ```
- **修复范式**：新增**编排 hook**（如 `useCrossJudge`）+ **UI 组件**（如 `MaterialLibrary`）并挂载到宿主页；复用既有纯函数/仓储（**不改 Rust/迁移/IPC**）；补**端到端可达性测试**（真实链路经 `save_material` 断言）。
- **预防**：契约先行/UI 后接的交付，收口验证**必须含生产调用非零断言**（见 `kb/patterns.md`「UI 接线验证」）；审查/验收时对「纯函数型交付」追问「谁调用它」。

## [+] 删除引用防护：JSON 冗余引用无外键，删除前精确判定 (2026-10-10)

- **背景**：`skill_entry.source_material_ids_json` 是对 `material.id` 的 **JSON 冗余引用**（无数据库外键）——直接删 `material` 会造成 skill 侧引用悬挂，破坏「来源素材可追溯」DoD。
- **错误做法**：用 `source_material_ids_json LIKE '%<id>%'` 判定被引用会**误判**（如 `id=1` 命中 `"[11]"`）。
- **正确模式**：`material::delete` 前**全表读 `skill_entry` + Rust 侧 `serde_json` 解析为 `Vec<i64>` 精确判定**（`ids.contains(&id)`）；被引用则**拒绝删除**，错误码 `FK_VIOLATION`、`detail` 携带引用它的 skill 列表 `[{id,title}]`；影响行 0 → `NOT_FOUND`。UI 侧据 `FK_VIOLATION` 显示 `delete-referenced` 专属提示。
- **对称校验**：`skill::insert/update` 校验 `source_material_ids` 对应素材均存在（不存在 → `VALIDATION`）——双保险，防双向悬挂。
- **通用**：JSON 冗余引用（无外键）的完整性**只能应用层保证**；判定「是否被引用」须**结构化解析**而非子串匹配（子串匹配在数字 id 场景必然误判）。

## [+] 交叉判断 JSON 容错复用（extractJson + 逐模型容错） (2026-10-10)

- **复用而非重造**：交叉判断 `extractFlavorExcerpts` 摘取片段时，**复用 `src/orchestration/review/json.ts` 的 `extractJson`**（去 JSON 代码围栏 / 取首 `{` 至末 `}`）解析模型输出，不另写解析器。
- **抛错 vs 容错的分层**：`parseExcerpts` **非法 JSON 抛错**（与 review `parseEvaluationJson` 一致，**不静默返空**）；**逐模型容错由调用方负责**——`useCrossJudge` 对单模型摘取 `catch {}` **容错跳过**，其余模型结果仍参与精确交集，**整体不失败**（单模型异常不阻断交叉判断）。
- **通用**：LLM 输出解析宜「**底层严格抛错 + 上层按粒度容错**」；同一项目内相似解析（评审 JSON ↔ 交叉判断 JSON）应**复用同一 `extractJson` 单一来源**，避免多套围栏剥离逻辑漂移。

## [+] 采纳误触致数据丢失的防范：破坏性动作「确认门 + 无损路径 + 强制回滚点」三件套 (2026-10-10)

- **现象/根因（REV-007 high）**：分支采纳 = **整章替换当前打开章**（`replaceContent`）+ 版本池登记「**可选（默认不启用）**」+ stage-04 `useAutoSave` **自动保存**三者叠加——用户误触「采纳」→ 当前章正文被走向卡草稿覆盖 → 自动保存先持久化 → 即便 `Ctrl+Z` 恢复编辑器，DB 层原正文已**永久丢失**（undo 栈随文档销毁）。
- **排查信号**：破坏性动作（覆盖/删除用户资产）**无确认门** + 目标为**当前正在编辑/自动保存的对象** + 安全网「可选/默认关」→ 数据丢失高危组合，违反数据完整性优先原则。
- **防范（最低组合）**：① **无损主路径优先**——采纳目标改为**新建下一章草稿**（`chapter.create`，**不改当前章 DB** → 从根上消除覆盖）；② 危险次路径**替换前强制入池快照（必做，非可选）**，使 DB/会话层始终有回滚点；③ 两条路径均加**二次确认对话框**（明示后果）。
- **测试守护**：主路径断言 `chapter.update` **零调用**；次路径断言替换前 `reviewStore.versions` 出现 `content=替换前正文` 的快照；确认门取消 → 零副作用（无 create/replace/入池）。
- **通用**：**破坏性动作**（覆盖/删除现有用户资产）必须「**确认门 + 无损替代路径 + 强制回滚点**」三件套；安全网**不可设为默认关闭的可选项**，语义上「是否可撤销」须与 UI 文案一致（主路径新增章不适用 `Ctrl+Z`，次路径替换才适用）。

## [+] 「功能无 UI 入口」模式再现与防范（推演能力交付，stage-08 复验） (2026-10-10)

- **背景**：stage-07 曾两度踩「功能无入口」（REV-018 high / BUG-001 medium）——纯函数 + 契约测试全绿，但**生产零调用、UI 不可达**（见下条同名模式）。stage-08 交付多温度推演能力时作为**高危模式**主动防范。
- **防范执行（本阶段落地）**：① 推演 UI 挂工作区**第三栏「推演」tab**（`WorkspaceLayout` 生产挂载 `<ExplorationPanel>`，`tab === "exploration"`）；② 采纳能力经 `BranchCompare → useAdoptBranch` 生产接线（`adoptAsNextChapter`/`replaceCurrentChapter`/`discard`）；③ 收口以**生产调用非零 rg 断言**核验（`rg -n -e "ExplorationPanel" -e "useAdoptBranch" src --glob "!*.test.*"` 命中生产组件/宿主）。
- **关键认知复述**：**测试通过 ≠ 功能可用**；「契约先行、UI 后接」的交付，收口**必须**做端到端可达性核验（生产调用非零 + 真实链路测试）。评审/验收对「纯函数型交付」须追问「**谁调用它**」。
- **观察项（非缺陷，产品取舍）**：`build-exploration-options` 取「前章（`idx-1`）末尾」为前文（与 stage-05 `build-chapter-options` 完全一致，符合 op-001 定稿），但推演场景用户通常停留**当前章**，其本章正文未进入上下文——是否改「当前章末尾」属产品取舍，建议后续与用户确认（**当前实现忠实于方案，非执行偏差**）。

## [+] stage-08 REV-009：采纳次路径快照为「会话内存级」（原正文丢失窗口） (2026-10-10)

> 登记：stage-09 T6（遗留登记）。

- **现象**：`useAdoptBranch.replaceCurrentChapter`（次路径「替换当前章」）在替换前把**原正文**入 `reviewStore.versions`（会话内存），**未持久化**——若应用崩溃/强杀，该快照随会话丢失（原正文仍在 DB，故**不是 DB 级丢失**，但会话内回滚窗口消失）。
- **持久化路线登记（stage-09 不实现）**：后续版本将 `reviewStore.versions` 快照**持久化**（**迁移 v5** 新增 `adoption_snapshot` 表，或落地为**本地文件**），使「替换前快照」跨会话可恢复。
- **现网缓解**：主路径「新建下一章草稿」**不改当前章**（无此窗口）；次路径另有**单条 `Ctrl+Z` 撤销**与**确认对话框**双保险。
- **判定**：非缺陷（会话级约束已声明）；登记为**已知限制**，随持久化落地关闭。

## [+] stage-08 REV-010：`abort` 分支 `error="aborted"` 未特判 / 主路径新章固定追加卷末 (2026-10-10)

> 登记：stage-09 T6（遗留登记）。

- **现象 ①**：`runExploration` 在 `signal.aborted` 时把在跑分支置 `status="error"`、`error="aborted"`——UI **未特判**「用户主动停止」与「真实失败」（均显示失败样式）。
- **现象 ②**：采纳主路径创建的「下一章草稿」**固定追加当前卷末**，不支持指定卷/位置。
- **归属**：**stage-10 或人工协验批处理**（两者均属 UX 细化，非阻塞）。
- **判定**：非缺陷；登记为**已知项**，不单独立任务。

## [+] v0.2 人工协验 4 项：BLOCKED 保持跟踪 (2026-10-10)

> 登记：stage-09 T6（遗留登记）。

- **范围**：真实 Key E2E / 真机 WebView 冒烟（v0.1+v0.2）/ T6 实验回填 / 编辑器 perf 实测——**执行主体 = 用户 / feel-tester**（AI 不可替代），详见 `docs/build-size-report.md` §四。
- **口径**：**保持 BLOCKED 跟踪**、**不阻塞** v0.3 阶段推进、**不伪造数据**；四项全部闭合后 **M2 正式达成**。

## [+] 多实例独立 `useState` 致运行时状态不同步（BUG-001 根因） (2026-10-10)

- **现象**：运行时点击「启用易经推演」开关后，推演仍未注入卦象引导（`buildGuideCard`/`renderGuideText` 零调用）；须重启应用（重挂载）才生效；反向（挂载时已开、运行关闭）引导仍注入 → 开关在运行时**无法真正控制**引导注入。
- **根因**：自定义 hook `useIChingEnabled()` 在开关 UI（`ExplorationPanel`）与消费 hook（`useExploration`）**各调用一次**，每次调用生成**一份独立 `useState`**——写 `localStorage` 只更新**本实例** state 且另一实例不重读 → 两处状态**互不相通**。
- **为何漏报**：既有单测在**挂载前**预置 `localStorage`（或直接传参），两实例初始值恰好一致 → 掩盖「运行时切换」路径；契约层单测全绿。
- **修复**：跨组件状态**提升为 store 单例**（`explorationStore.ichingEnabled`），hook 改 store 薄封装（无本地 `useState`），两处**同源** → 运行时即时生效；既有用例预置方式改为 **store 动作**（不再依赖挂载前 `localStorage`）。修复 commit `48ce6e8`。
- **排查信号**：开关/选项「运行时不生效、重启才生效」+ 该状态经**多处 `useState` 各自持有**（或同一 hook 被多组件分别调用）→ 命中本模式。
- **通用**：`useState` 只在**单组件内**有效；需跨组件共享的状态必须用**单一数据源**（store/context）；持久化（`localStorage`）≠ 状态同步（写方不通知读方）。

## [+] 可选开关「关闭零副作用」的可判定验证 (2026-10-10)

- **目标**：断言「可选功能关闭时对既有链路**零影响**」（stage-09 易经开关 DoD 第 6 条）。
- **验证三件套（可判定）**：① **输出逐字段一致**——关闭时 `buildExplorationOptions` 的 `options` 与「改造前基线」`toEqual`（含 `messages` 深相等），空白 guide 视为未传、无空段；② **下游模块零调用**——`vi.mock("@/orchestration/iching")` 记录 `buildGuideCard`/`renderGuideText`，关闭态调用记录为 `[]`；③ **旁路边界**——装配函数本身不 import 被测模块（文本由调用方渲染），故「零调用」断言落于**宿主组件**而非装配层（避免断言在错误层而空洞）。
- **运行时态同样断言**：缺省关闭与**运行时切换关闭**均 `guideCalls=[]`（防「仅缺省态零调用」假绿；BUG-001 教训）。
- **通用**：可选/可关能力的验收**必须含「关闭态零副作用」可判定断言**，且区分**缺省态**与**运行时切换态**；「零调用」断言要落在真实持有调用点的层。

## [+] 「生产端最小占位未替换为完整实现」模式（BUG-001 根因，与 stage-07「功能无入口」/stage-09 同类） (2026-10-10)

> 登记：stage-10 BUG-001（dialogue, medium, closed）。

- **现象**：完整能力在 `orchestration` 层实现且**单测全绿**，但**生产不可达**——宿主（`useDialogue`）仍停留在早期的**最小占位实现**，「稍后替换为完整装配」的约定**未兑现**；结果：文档 / DoD 声明的能力（场景上下文四块：设定卡 / 前文 / 场景指令 / 公共对话历史）**生产仅落地 1/4**。
- **根因分层**：① 过渡期**本地最小占位**与目标**共享函数同名**（`buildPublicContext` 双份）→ 替换时易漏、易误留；② 占位「稍后在 op-006 替换」为**意图而非强制**（无断言守护）→ 跨 op 交接处静默断裂；③ 既有测试只覆盖**单元函数**（`context.test.ts`），未覆盖**生产装配路径**（`useDialogue`）→ 全绿掩盖。
- **排查信号**：
  ```powershell
  rg -n "const buildPublicContext" src/features            # 本地最小实现仍存在 → 疑未替换
  rg -n "@/orchestration/dialogue/context" src/features/dialogue/useDialogue.ts  # 应命中（生产调用完整装配）
  ```
  同类历史：stage-07 REV-018（交叉判断纯函数生产零调用）/ stage-07 BUG-001（素材库导出函数生产零调用）——**「契约先行、UI 后接」的高危断裂点**。
- **修复范式**：删除本地占位、改调**共享函数（单源）**；补「**生产调用非零** + **输出正确** + **空输入零副作用**」三断言（spy 包装真实实现，见 `kb/patterns.md`「单源装配」）。
- **预防**：跨 op 交接的「占位 → 完整」约定，须在**收口 op 用断言强制兑现**（生产调用非零 rg/spy），而非仅靠备注；对纯函数型交付，审查 / 验收追问「**谁在生产调用它**」。

## [+] context 单源消除重名（同名双实现 → 删除本地最小实现改调共享模块） (2026-10-10)

> 登记：stage-10 BUG-001 修复要点。

- **现象 / 根因**：`useDialogue` 内本地最小 `buildPublicContext` 与 `@/orchestration/dialogue/context` 的完整 `buildPublicContext` **同名重名**——前者遮蔽后者，生产实际只调到最小实现，完整装配**不可达**（BUG-001）。
- **处理（单源三件套）**：① **删除**本地同名函数；② 从共享模块 **import 完整实现**（`useDialogue.ts` 顶部 `import { buildPublicContext } from "@/orchestration/dialogue/context"`）；③ 宿主内 `assemblePublicContext()` 负责**把 store 条目实时映射为 history** 后调共享函数（宿主只做「取数据 + 传参」，不含装配逻辑）。
- **可判定核验**：
  ```powershell
  rg -n "const buildPublicContext" src/features/dialogue   # 期望：零命中（单源）
  rg -n "@/orchestration/dialogue/context" src/features/dialogue/useDialogue.ts  # 期望：命中
  ```
  另以 `vi.mock(path, importOriginal)` **spy 真实实现**断言调用次数 ≥1。
- **通用教训**：**同名函数 = 隐性遮蔽**——「本地占位 + 共享完整实现」并存必致调用漂移；消除重名的唯一可靠方式是**删除占位并显式 import 单源**，并以 rg「零命中 + 命中」双断言守护。

## [+] 「生产不可达 / 功能无入口」缺陷模式跨阶段复发（UI 接线缺失）——收口检查清单 (2026-10-10)

> 登记：stage-11 BUG-001（consistency, high, closed）——**第 4 次复发**（stage-07 REV-018 / stage-07 BUG-001 / stage-09 BUG-001 / stage-10 BUG-001 同源）。

- **现象（同源四例）**：完整能力在 `orchestration` 层实现、单测全绿，但**生产不可达**——
  - stage-07：交叉判断纯函数（REV-018）/ 素材库导出与删除函数（BUG-001）**生产零调用**；
  - stage-09：`useIChingEnabled` 各持独立 `useState`，开关运行时不同步（BUG-001）；
  - stage-10：`useDialogue` 本地最小 `buildPublicContext` 未替换为共享完整实现（BUG-001）；
  - stage-11：`ArchivePanel` 未挂载任何 tab + `SettingCardForm` 无 `tier` → 「手动归档并分四级」（DoD 1）**应用内完全不可达**（BUG-001）。
- **根因共性**：**UI 接线缺失**——「契约先行、UI 后接」的交付在跨 op 交接处静默断裂；既有测试只覆盖**单元函数/hook**，未覆盖**生产挂载路径** → 门禁全绿掩盖缺陷。
- **跨阶段检查清单（收口必查，沉淀自 4 次复发）**：
  1. **生产调用非零**：对每个纯函数/命令交付，`rg` 追问「**谁在生产调用它**」（`rg "fnName" src/features` 命中**生产文件**而非仅自身+测试）。
  2. **挂载/接线断言**：组件交付须断言**被生产渲染树挂载**（如 `WorkspaceLayout` tab 双区 `data-testid` 同时存在），而非仅组件内单测。
  3. **落库/命令非零**：写路径（`save_*`/`update_*`）须断言**生产路径实际调用**（spy 真实实现）。
  4. **状态单源**：跨组件共享状态**禁用多份独立 `useState`**（落单例 store + 薄封装）。
  5. **占位替换**：跨 op 的「占位 → 完整」约定**必须在收口 op 用断言强制兑现**（单源 rg 零命中 + 生产调用非零），勿仅靠备注。
  6. **表单/入口贯通**：新字段（如 `tier`）须从**表单 → 输入类型 → 命令 → 落库**全链断言，勿只做数据层。
- **可判定探针**：验收以**独立探针**（唯一标记）走**真实生产渲染树**复验（不复用实现方用例，见 `kb/patterns.md`「单源装配」）。
- **通用**：**「测试全绿」不等于「用户可达」**——凡「契约先行、UI 后接」的交付，收口须逐条核验生产可达性；建议将上方 6 条固化为**跨阶段收口检查清单**。

## [+] IPC 文档计数基数漂移（终态预写 vs 与实现同提交） (2026-10-10)

> 登记：stage-11 REV-007（medium, closed）——stage-02 REV-013「基数漂移」教训**复发模式**（本项目两代已知坑）。

- **现象**：本阶段新增 6 命令（归档批落库 1 + 冲突 CRUD 5），若在**首个 chore op（文档回写骨架）**即把 `docs/ipc.md` 计数**预写为终态**（§8.1 45→51 / 全仓 47→53），则在命令真正落地（op-003/op-005）之前的**多个提交窗口内，文档计数（51/53）与实际注册命令（45/47）不符**——文档虚高。
- **根因**：文档计数是**随实现递增的过程量**，不能在实现之前预写终态；双口径（§8.1 数据访问子集 vs 全仓含 §6 流式）混用无定义加剧歧义。
- **修正范式**：① **首个 chore op 只做「占位声明」**（明示「本 op 不改计数数值」+ 计划新增命令清单 + 终态预期），**不写终态数值**；② **计数更新收归到命令实现 op，与实现同提交**（op-003：45→46 / 47→48；op-005：46→51 / 48→53）；③ 补**双口径定义**（§8.1 = 数据访问命令子集；全仓 = §8.1 + §6 流式 2）；④ 验证标准加**防回归断言**（`rg` 确认首个 op 无终态计数句）。
- **通用**：**文档中的「随实现增长的计数」不得早于实现写入**——占位声明先行、与实现同提交更新、口径显式定义；跨 op 的中间态须与前一 op 衔接（勿跳号）。
