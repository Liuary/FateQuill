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
