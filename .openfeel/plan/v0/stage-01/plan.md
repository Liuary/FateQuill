# v0.1.0-stage-01 详细计划：工程脚手架与工程化基础设施

> 修订：v3（2026-10-08）。v2：依据 REV-v0.1.0-stage-01 的 8 条审查意见修订；v3：回写方案审查裁决接受的 3 处技术偏差（React 19 / Node 24 / `ui` 层 → `src/components/`）。

## 归属版本
v0.1（最小可用闭环）

## 目标
建立可运行、可构建、可测试、**可复现**的跨平台桌面工程骨架（FateQuill / 命笔），为后续所有阶段提供基座；落地 i18n 基建与工程化规范（版本固定、CI、环境前置文档）。

## 对应核心目的
- 目的 1（实现构想）：无直接功能，但为一切创作功能提供承载。
- 目的 2（去 AI 味）：无直接功能。
  **流式/节流约定不在本阶段**：其归属为 **stage-03**（Rust SSE 流式中继）与 **stage-05**（生成/编辑器状态隔离）；本阶段仅确立目录边界与 IPC 通道约定，不实现流式逻辑。（修订 REV-005，采用建议 ①）

## 前置依赖
- 内部阶段依赖：**无**。
- 但存在**环境硬前置**（见「阶段前置条件」），非「无」；此处显式描述以免与 DoD「干净环境按 README 可一次构建」矛盾。（修订 REV-003）

## 阶段前置条件（执行前必须就绪）
1. **开发环境**（用户/环境提供，T7 将其文档化并提供检测命令）：
   - Rust stable 工具链（rustup / cargo）；
   - MSVC Build Tools（C++ 工作负载，Windows 上 Rust 链接器必需）；
   - WebView2 Runtime；
   - Node（LTS，见「版本固定」）；
   - pnpm（≥ 9）。
2. **GitHub 仓库托管**（**待用户拍板**）：
   - **默认方案**：由**用户手动创建** `FateQuill` 仓库并授予推送权限（HTTPS token 或 SSH），AI 负责 `git init` / 首次提交 / 配置 remote / push；
   - **备选方案**：用户授权 AI 使用 `gh` CLI 创建仓库。
   - 该事项为 T9/T6 的**阶段前置条件**：未就绪时 T6（CI）无法验收。（修订 REV-002）

## 技术约束（本阶段适用）
- Tauri 2 + **React 19** + Vite + TypeScript（strict）。（v3：官方模板默认 React 19）
- 样式：**TailwindCSS v4（CSS-first，已定稿）+ shadcn/ui**（`components.json` 配置，组件源码入库于 `src/components/ui/`）。（修订 REV-007③）
- **版本固定（定稿，修订 REV-001）**：
  - 包管理器 = **pnpm ≥ 9**（提交 `packageManager` 字段；`.npmrc` 可选强制）；
  - Node = **24**（`package.json` 写入 `engines.node = ">=22"` 兼容下限；**CI 固定 Node 24**，双锚定）；（v3 定稿）
  - Rust = **stable**（`rust-toolchain.toml` 固定 channel）。
  - 仓库**仅一份 `pnpm-lock.yaml`**，禁止 npm/yarn lockfile 混入。
- **状态管理（Zustand）归属声明（修订 REV-008）**：Zustand **不在本阶段安装**；本阶段仅建立 `src/store/` 目录并在目录约定文档中注明其初始化时机。**Zustand 首个接入阶段 = stage-04（编辑器态 `editorStore`）**；stage-05 增加 `generationStore`。stage-03 的模型配置态如需状态管理，复用 stage-04 引入的 Zustand。
- 所有外部 HTTP 一律后续经 Rust 侧；本阶段仅确立目录边界，不实现网络。
- **命名与标识（定稿）**：应用显示名 `FateQuill`（中文名「命笔」）、Tauri identifier `com.fatequill.app`、npm 包名 `fatequill`、Cargo crate 名 `fatequill`；全仓不得出现 `NovelCreate` 残留。
- **i18n（定稿）**：采用 i18next + react-i18next；语言资源目录与命名空间约定；默认 zh-CN，可切换 en；英文缺失项回退中文。创作向内容不本地化（见大计划 §1.5）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 初始化工程 + Git 仓库 + LICENSE | Tauri 2 + React 19 + Vite + TS 骨架；**`git init` + 首次提交**；**`LICENSE`(MIT)**；`package.json`(含 `packageManager`/`engines`)；`rust-toolchain.toml` | `pnpm install` 成功且仅生成一份 `pnpm-lock.yaml`；`package.json` 含 `packageManager` 与 `engines.node`；`pnpm build` 通过；`cargo check` 通过；`pnpm tauri dev` 启动**不报错**（窗口行为人工确认单列）；bundle identifier = `com.fatequill.app`；`LICENSE` 为 MIT 文本；`git log` 至少有 1 次提交 | — |
| T2 | 接入 TailwindCSS v4 与 shadcn/ui | Tailwind v4 配置（CSS-first）、`components.json`、至少 3 个 ui 组件源码 | 组件可在页面渲染；无黑盒 UI 依赖；Tailwind 主版本为 v4（无 v3 config 依赖） | T1 |
| T3 | 确立目录分层、路径别名与 store 约定 | `src/{app,components,features,domain,orchestration,ipc,store}`、`src-tauri/`、别名 `@/*`、目录约定文档 | 目录存在且被 tsconfig/vite 识别；**约定文档明确 `ui` 层映射为 `src/components/`（shadcn 组件落 `src/components/ui/`）**，含 `store/` 初始化时机与 Zustand 归属声明（见约束） | T1 |
| T4 | 配置代码质量与测试工具链 | ESLint + Prettier、Vitest + Testing Library、Rust 测试 | `pnpm lint`、`pnpm test`（Vitest）、`cargo test` 均通过（含各 1 个示例测试） | T1 |
| T5 | Rust IPC 示例与**命令通道**约定 | `#[tauri::command] ping` + 前端 `invoke`；**约定文档 `docs/ipc.md`** | 前端调用 `ping` 返回预期值；`docs/ipc.md` 存在且描述命令通道注册约定（事件流通道留待 stage-03） | T1 |
| T6 | 配置 CI（范围定稿） | GitHub Actions workflow | 提交 PR 触发 CI 并全绿；CI 范围 = `pnpm lint` + Vitest + `pnpm build`（含 tsc 类型检查）+ `cargo check` + `cargo test`；**`tauri bundle` 打包不在 CI（移至 stage-12 或标注为可选 job）**；runner = `windows-latest` | T4, T9 |
| T7 | 编写开发者文档 | `README.md`（**六节命令清单**：环境前置 / 安装 / dev / build / lint / test）、`.gitignore`（含密钥、`target/`、`node_modules`） | README 六节命令清单**逐条执行通过**；「环境前置」章节含 rustup / MSVC Build Tools / WebView2 / Node / pnpm 的安装说明与检测命令（`node -v`/`pnpm -v`/`cargo --version`） | T1 |
| T8 | 接入 i18n 基建 + 命名空间约定 | i18next 初始化、`locales/{zh-CN,en}/` 资源、语言切换器、缺失回退、**命名空间约定文档** | 界面示例文案可中英切换；缺英文回退中文；**命名空间约定文档含初始清单（如 `common`/`editor`/`settings`）** | T2, T3 |
| T9 | GitHub 仓库托管与远程推送 | 远程仓库配置 + 推送可用 | `git remote -v` 指向 `FateQuill` 仓库；`git push` 成功；**责任方式见「阶段前置条件」#2（用户手动创建=默认 / 授权 gh CLI=备选）** | T1 |

## 阶段验收标准（DoD）
- [ ] **版本固定**：`package.json` 含 `packageManager`（pnpm ≥9）与 `engines.node`；`rust-toolchain.toml` 固定 stable；仓库仅一份 `pnpm-lock.yaml`。（REV-001）
- [ ] **Git/托管**：`git log` 有提交；`LICENSE`(MIT) 存在；`git remote -v` 指向 FateQuill 且可推送。（REV-002/007①）
- [ ] **环境前置**：README「环境前置」六节命令清单逐条通过（rustup/MSVC/WebView2/Node/pnpm）。（REV-003）
- [ ] **CI**：PR 上全绿，范围为 lint + Vitest + `pnpm build` + `cargo check` + `cargo test`（无 tauri bundle），runner 为 windows-latest。（REV-004）
- [ ] `pnpm build` + `cargo check` 通过；`pnpm tauri dev` 启动不报错（窗口行为由人工确认，单列）。（REV-006④）
- [ ] `pnpm lint` / `pnpm test` / `cargo test` 全部通过。
- [ ] `.gitignore` 覆盖密钥与构建产物，仓库无敏感文件。
- [ ] shadcn/ui 组件以源码形式存在且可修改；Tailwind 主版本为 v4。
- [ ] 命名标识全部为 FateQuill / `com.fatequill.app` / `fatequill`，全仓无 `NovelCreate` 残留。
- [ ] i18n 基建可用：至少 1 处 UI 文案可中英切换，英文可回退中文；命名空间约定文档存在。
- [ ] `docs/ipc.md` 存在并描述命令通道约定；目录约定文档含 `store/` 初始化时机与 Zustand 归属。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「版本固定」+ T1 交付物/验收 + DoD 第 1 条 |
| REV-002 | medium | ✅ | 阶段前置条件 #2 + T1（git init/提交）+ T9 + DoD 第 2 条 |
| REV-003 | medium | ✅ | 阶段前置条件 #1 + T7 六节命令清单 + DoD 第 3 条 |
| REV-004 | medium | ✅ | T6 验收定稿 CI 范围与 runner + DoD 第 4 条；打包移 stage-12 |
| REV-005 | medium | ✅ | 「对应核心目的」改述，归属 stage-03/05（采建议 ①） |
| REV-006 | low | ✅ | T1/T5/T7/T8 验收改为可判定（见各任务）+ DoD 第 5 条 |
| REV-007 | low | ✅ | T1 加 LICENSE；T8 加命名空间文档；T2/约束注明 Tailwind v4 |
| REV-008 | low | ✅ | 技术约束「Zustand 归属声明」+ T3 约定文档 |

## 风险与备注
- **CI runner 选择**：定稿 `windows-latest`（与开发平台一致，避免 Linux 上 `libwebkit2gtk` 等系统依赖）。若改用 ubuntu，须在 workflow 安装 `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf` 等，属额外成本；本阶段不采用。
- **Tailwind v4 依据**：v4 为 CSS-first 配置（无 v3 `tailwind.config.js` 主配置），与新版 shadcn/ui 兼容；若团队要求 v3，需在 T2 覆盖并说明差异。
- **纯 AICoding 版本漂移**：`packageManager` + `engines` + `rust-toolchain.toml` 三处硬约束是防止 AI 跨会话混用工具链的关键，缺一不可。
- i18n 资源命名空间需尽早约定（如 `common` / `editor` / `settings`），避免后续文案堆积冲突。

## 待用户拍板（建议默认值）
1. **GitHub 仓库创建方式**：建议默认「用户手动创建 `FateQuill` 仓库并授权推送」；备选「授权 AI 用 `gh` CLI 创建」。（影响 T9/T6 前置）

> 已定稿（原待确认项，v3 关闭）：**React 19**、**Node 24**（`engines.node=">=22"`，CI 固定 24）、**TailwindCSS v4**（CSS-first）、`ui` 层 → `src/components/`（shadcn 组件落 `src/components/ui/`）。
