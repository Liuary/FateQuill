# 计划系列索引 v0

> 系列 v0 ｜ 主题：FateQuill（命笔）首发系列 ｜ 阶段根目录：`.openfeel/plan/v0/`
> 大计划见 `../plan.md`；分期大纲见 `.openfeel/roadmap/v0.md`；依赖见 `.openfeel/deps.yaml`。
> **状态：✅ 已完成（12/12 阶段全部归档，2026-10-10）**——里程碑 M1~M6 代码/自动层均达成；真机/语义层待统一人工协验批次（见 `stage-12/clearance.md`）；整体总结见 `.openfeel/dev/v0-summary.md`。

## 核心摘要

以「可插拔 AI 编排引擎 + 高性能编辑器 + 去 AI 味研究子系统」为骨架，分六版推进：
先跑通最小可用闭环（v0.1），再建质量闭环与去 AI 味子系统（v0.2），
随后叠加术数引导（v0.3）、多声部角色（v0.4）、设定一致性（v0.5），终至开源发布（v0.6）。
UI 走 i18n 中英双语（创作能力仅面向中文市场）；项目名 FateQuill（命笔）；协议 MIT。

## 阶段清单

| 阶段 ID | 主题 | 版本 | 硬依赖 | 计划文件 |
|---------|------|------|--------|----------|
| v0.1.0-stage-01 | 工程脚手架与工程化基础设施 | v0.1 | — | `v0/stage-01/plan.md` |
| v0.1.0-stage-02 | 核心领域模型与本地存储 | v0.1 | stage-01 | `v0/stage-02/plan.md` |
| v0.1.0-stage-03 | AI 编排引擎骨架与模型配置 | v0.1 | stage-01,02 | `v0/stage-03/plan.md` |
| v0.1.0-stage-04 | 编辑器基础（Tiptap 章节文档 + 大纲树） | v0.1 | stage-01,02 | `v0/stage-04/plan.md` |
| v0.1.0-stage-05 | 单 Agent 章节生成 + 设定卡（v0.1 闭环） | v0.1 | stage-03,04 | `v0/stage-05/plan.md` |
| v0.2.0-stage-06 | 审查流水线（剧情/世界观/合规/真人感） | v0.2 | stage-03,05 | `v0/stage-06/plan.md` |
| v0.2.0-stage-07 | 去 AI 味研究子系统 v1 | v0.2 | stage-03,06 | `v0/stage-07/plan.md` |
| v0.3.0-stage-08 | 多温度并行推演引擎 | v0.3 | stage-03,05 | `v0/stage-08/plan.md` |
| v0.3.0-stage-09 | 易经卦象系统（六十四卦 + 爻变） | v0.3 | stage-08 | `v0/stage-09/plan.md` |
| v0.4.0-stage-10 | 角色 Agent 多声部对话 | v0.4 | stage-03,05 | `v0/stage-10/plan.md` |
| v0.5.0-stage-11 | 设定分级归档与一致性引擎 | v0.5 | stage-05,10 | `v0/stage-11/plan.md` |
| v0.6.0-stage-12 | 大六壬进阶 + 全自动创作 + 发布打磨 | v0.6 | stage-09,11 | `v0/stage-12/plan.md` |
