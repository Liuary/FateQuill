# 计划变更日志

> 最多 30 条，最新在上。格式：`{yyyy-mm-dd} {username}: 变更描述`（含跳转链接）。

- **2026-10-09** Liuary（openfeel-planner）：依 REV-v0.1.0-stage-03（8 条，4 blocking）修订 stage-03 计划至 v2 并落实架构裁决选项 A：大计划 §2 技术栈「AI 层」改为 Rust 侧 provider 无关 SSE 中继 + 前端自研协议适配器（Vercel AI SDK 降级，v0.1 不引入）；延伸 C-04/C-05；新增 §3.4 ADR-001 并同步 `.openfeel/dev/decisions.md` ADR-001；stage-03 定稿 keyring、Channel+requestId+AbortHandle、迁移 v2 model_config、纯 TS 订阅工具、超时/Key 脱敏、REV-013/014 清理与设置页落点；同步 stage-03 `overview.md` 与 `roadmap/v0.md`。
- **2026-10-09** Liuary（openfeel-planner）：依 REV-v0.1.0-stage-02（8 条，5 blocking）修订 stage-02 计划至 v2：定稿 tauri-plugin-sql v2 与「插件仅 Rust 侧」封装边界 + db 位置、插件内置迁移机制、三段式落点（不建 src/infra）、Chapter.content 格式位/status/word_count 定稿、双层测试与 ESLint 工具化、seed 工厂、IPC 错误结构，并将 stage-01 遗留 REV-016~019 并入首 op 清理；同步 stage-02 `overview.md`。
- **2026-10-08** Liuary（openfeel-planner）：回写方案审查裁决接受的 3 处技术偏差至 stage-01 计划 v3：React 18→19、Node LTS→Node 24（engines.node `>=22`，CI 固定 24）、`ui` 层→`src/components/`（shadcn 落 `src/components/ui/`）；同步 `plan/plan.md` §8.1 与 stage-01 `overview.md`。
- **2026-10-08** Liuary（openfeel-planner）：依 REV-v0.1.0-stage-01（8 条，5 blocking）修订 stage-01 计划至 v2：固定 pnpm≥9/Node LTS/Rust stable、新增 git 初始化与 GitHub 托管任务(T9)、补环境硬前置、定稿 CI 范围与 runner、澄清流式归属、强化可判定验收、补 LICENSE/i18n命名空间/Tailwind v4、声明 Zustand 归属；同步 `plan/plan.md` §8.1、stage-01 `overview.md`。
- **2026-10-08** Liuary（openfeel-planner）：需求变更 —— 项目名定稿 FateQuill（命笔）、新增 i18n 需求、8 项待确认全部拍板。更新 `plan/plan.md`、`roadmap/v0.md`、`plan/index.md`、`plan/v0/index.md`、stage-01/03/06/07/12 计划。
- **2026-10-08** Liuary（openfeel-planner）：创建 v0 系列大计划、分期大纲与 12 个工作阶段划分。→ `plan/plan.md`、`roadmap/v0.md`、`deps.yaml`
