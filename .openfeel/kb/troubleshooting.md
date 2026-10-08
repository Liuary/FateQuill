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

## [+] TS 6 弃用 `baseUrl`（TS5101） (2026-10-08)

- **现象**：tsconfig 设置 `"baseUrl": "."` 在 TS 6.0.3 下触发 TS5101 弃用报错。
- **处理**：移除 `baseUrl`，仅保留 `"paths": { "@/*": ["./src/*"] }`，别名照常解析（现代 TS 推荐写法）。

## [+] `resolveJsonModule` 预检（JSON 模块导入） (2026-10-08)

- **场景**：i18n 等 `import xx from "@/locales/.../common.json"`。`moduleResolution: "bundler"` 下 TypeScript 导入 JSON 需显式 `"resolveJsonModule": true`。
- **后果**：缺失时 `pnpm build`（`tsc` 阶段）报 **TS2732/TS5097**，构建直接失败（Vite 运行时能处理 JSON，但 tsc 会拦截）。
- **处理**：导入 JSON 前显式核实/补齐 `resolveJsonModule`；`"esModuleInterop": true` 可作 JSON 默认导入兜底。
