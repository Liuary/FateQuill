# Changelog

> 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)；本项目发布许可：**MIT**。
> 版本号：发布版本使用 `X.Y.Z`（内部迭代 W 位见 `.openfeel/` 计划文档）。

## [Unreleased]

## [0.6.0] - 2026-10-10

> 里程碑 **M6（v0.6.0-stage-12）**：术数扩展 + 全自动创作 + 开源发布工程。

### Added

- **大六壬（可选可关）**：公有领域白文静态数据（12 天将 / 12 宫 / 四课三传 / 九宗门 / 六十甲子 / 十干寄宫）+ **手写校验**；
  **手动指定月将 + 时辰 + 日干支**起课（**不引历法库**）；课体引导经 `liurenGuide` 与易经**并列可选**并入推演 / 生成 system 段，
  **缺省关闭、关闭零副作用**（`localStorage['fatequill.liuren.enabled']`，开关状态单源）。
- **全自动创作（无人值守）**：决策规则表（推演多温度**择优** / 生成 / 审查阈值 / 重写 ≤ N / 降级收录 / 自动归档）；
  **熔断三层**（预算 / 连续失败 K=3 / 总章数）触发即停并出报告；**迁移 v6** 断点落库（`autopilot_run` + `autopilot_chapter`）
  → **中断后可续跑**（已完成章不重跑）；**冲突策略**：默认「**暂停 + 通知**」，用户显式授权后可「**自动 `ignored` 继续**」——
  **两路径均落 `conflict_record` 留痕**（可审计）。
- **发布工程**：`tauri bundle`（**Windows nsis** 为主）+ 干净环境 CI 构建 job（`.github/workflows/release.yml`）；
  **依赖许可清单工具化**（`license-checker` + `cargo license` → `docs/dependency-licenses.md`，MIT 兼容白名单 + 例外登记）；
  版本号三处同步脚本（`pnpm version:sync` / `version:check`）；本 `CHANGELOG.md`。
- **英文收口**：i18n 键完整性检查与豁免清单（**op-007 收口**）。

### Changed

- 设定注入默认按 `tier` 分级：`main` / `short` 注入，`dark`（暗线）与 `temp` **不再进入**生成 / 推演 / 对话 prompt（**硬隔离**，见 v0.5 迁移影响声明）。
- `.github/workflows/release.yml` 打包目标收敛为 **nsis**；WebView2 依赖由安装引导（`downloadBootstrapper`）自动处理。

## [0.5.0] - 2026-10-10

> 里程碑 **M5（v0.5.0-stage-11）**：设定分级归档 + 一致性引擎。

### Added

- **四级分级** `tier`（`main` / `dark` / `short` / `temp`，与 `kind` 正交；**迁移 v5**）；
- **归档抽取**（LLM + `evidence` **原文回查**防幻觉 + 名称精确去重）→ 待确认队列 → 确认后**事务批落库**；
- **一致性引擎**：**L1 规则**（结构化断言，零幻觉）+ **L2 语义**（`advisory` 建议非结论）+ 冲突报告与**误报率样本集**；
- **冲突面板与处置**（改分级 / 编辑设定卡（跳转 + verbatim 定位）/ 标记误报 / 忽略）+ `conflict_record` 落库（**5 命令**）；
- **分级注入**（白名单 `{main, short}`，`dark` 硬隔离）。

## [0.4.0] - 2026-10-10

> 里程碑 **M4（v0.4.0-stage-10）**：多声部对话。

### Added

- 角色档案（`profile` 契约）与**多声部对话**：旁白 / 台词分离生成、**防串味白名单**（他人仅公开身份摘要）、
  场景上下文四块（设定卡 + 前文 + 场景指令 + 已定稿对话）、双路径落章（含快照安全网）、成本预估与并发上限、
  **可选接入 stage-06 评审**（「千人一腔」与「真人感」互认）。

## [0.3.0] - 2026-10-10

> 里程碑 **M3（v0.3.0-stage-08/09）**：多温度推演 + 易经卦象。

### Added

- **多温度并行推演**（`{0.3, 0.7, 1.1}`、per-provider clamp、走向卡、分支对比、克制收敛、双路径采纳安全网、并发与成本）；
- **易经卦象系统**（64 卦白文与手写校验、朱熹变爻推导、起卦、引导卡、宿命卡写入设定卡，**可选可关**）。

## [0.2.0] - 2026-10-10

> 里程碑 **M2（v0.2.0-stage-06/07）**：四维审查与研究工作台。

### Added

- **审查流水线**（四维 LLM-as-judge + 合规规则、加权择优、重写回路 ≤ 2、审查面板、审查记录持久化 v3）；
- **研究工作台**（多模型采样、交叉判断、用户标注、素材库（迁移 v4 + 导出）、规避 skill 库、闭环回注）。

## [0.1.0] - 2026-10-09

> 里程碑 **M1（v0.1.0-stage-01~05）**：最小可用闭环。

### Added

- 工程脚手架（Tauri 2 + React 19 + Vite + TS(strict)、i18n、CI）；领域模型与 SQLite 迁移/仓储/IPC；
  可插拔 AI 编排引擎（Provider/Agent/Pipeline + 自研 SSE 中继）；章节编辑器（Tiptap + 卷章大纲树 + 自动保存）；
  生成面板与流式直插；设定卡；模型配置与 OS 密钥链。

[Unreleased]: https://github.com/Liuary/FateQuill/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.6.0
[0.5.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.5.0
[0.4.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.4.0
[0.3.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.3.0
[0.2.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.2.0
[0.1.0]: https://github.com/Liuary/FateQuill/releases/tag/v0.1.0
