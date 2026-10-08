# v0.1.0-stage-01

## 目标

搭建 FateQuill（命笔）的工程脚手架与工程化基础设施：Tauri 2 + React 19 + Vite + TypeScript + TailwindCSS v4 + shadcn/ui 可运行骨架，含工程化规范（pnpm≥9 / Node 24 / Rust stable 版本固定）、构建、测试、CI、环境前置文档与 **i18n 基建**。

## 依赖

- 内部阶段依赖：无。
- **环境硬前置**（执行前须就绪）：rustup(Rust stable)、MSVC Build Tools(C++)、WebView2 Runtime、Node 24、pnpm ≥ 9。
- **GitHub 仓库托管**：待用户拍板（默认用户手动创建 `FateQuill` 仓库并授权推送）。

详见本目录 `plan.md`「阶段前置条件」与「待用户拍板」。

## 操作方案

> 由 openfeel-schemer 制定，任务分解（T1~T9）见本目录 `plan.md`。op 文件位于 `ops/`。
> 本阶段已按 REV-v0.1.0-stage-01 的 8 条审查意见修订（v2），并按方案审查裁决回写 3 处技术偏差（v3）：React 19、Node 24、`ui` 层 → `src/components/`。

| op | 标题 | 对应任务 | 前置 | 人工前置 |
|----|------|:--------:|------|----------|
| op-001 | 初始化 Tauri 2 + React + Vite + TS 工程骨架与 Git 仓库 | T1 | — | — |
| op-002 | 接入 TailwindCSS v4 与 shadcn/ui | T2 | op-001 | — |
| op-003 | 确立目录分层与路径别名 `@/*` 及目录约定文档 | T3 | op-001、op-002 | — |
| op-004 | 配置代码质量与测试工具链 ESLint/Prettier/Vitest/cargo test | T4 | op-001、op-003 | — |
| op-005 | 实现 Rust IPC `ping` 命令与命令通道约定文档 `docs/ipc.md` | T5 | op-001、op-003 | — |
| op-006 | 配置 GitHub Actions CI（windows-latest） | T6 | op-004、op-009 | 远程仓库就绪后协验 CI |
| op-007 | 编写开发者文档 README 与环境前置说明 | T7 | op-001、op-004 | — |
| op-008 | 接入 i18n 基建与命名空间约定 | T8 | op-002、op-003 | — |
| op-009 | 配置 GitHub 仓库托管与远程推送 | T9 | op-001 | **用户手动创建 `FateQuill` 空仓库并授权推送** |

### 执行前需用户拍板/知悉
- **GitHub 仓库创建方式**：默认「用户手动创建 `FateQuill` 空仓库 + 授权推送」（`gh` 未安装）；备选「安装 `gh` 后由 AI 创建」。
- **技术偏差（已裁决接受，plan.md v3 已回写）**：React 19（官方模板默认）；Node 24（`engines.node = ">=22"`，CI 固定 24）；`ui` 层映射为 `src/components/`（shadcn 组件落 `src/components/ui/`）。
