# 模块手册索引

> `.openfeel/manual/` 记录项目主要模块的职责、核心 API 与结构。按模块分级组织，随阶段推进增量维护。
> 归档官在归档时须检查本阶段涉及模块的 API / 结构 / 职责是否变更，并同步更新对应文档。

## 模块树

- **engineering/** — 工程化基础设施（stage-01 建立）
  - [`scaffold.md`](engineering/scaffold.md)：工程脚手架 —— Tauri 2 + React 19 + Vite + TS(strict) 骨架、目录分层、工具链、i18n 基建、CI

- **core/** — 领域模型与本地存储（stage-02 建立）
  - [`domain-storage.md`](core/domain-storage.md)：领域模型（作品/卷/章/设定卡/角色）、SQLite schema 与插件迁移、仓储接口↔IPC 命令、错误结构与事务约定
  - [`model-config.md`](core/model-config.md)：模型配置持久化（迁移 v2）、OS 密钥链（keyring）封装、设置页 UI（stage-03 建立）

- **orchestration/** — AI 编排引擎（stage-03 建立）
  - [`engine.md`](orchestration/engine.md)：可插拔 Provider/Agent/Pipeline 注册表、自研 SSE 协议适配器、Rust 侧流式中继与消费工具；**审查评估（`review/`）**；**多温度推演（`exploration/`）**；**起卦解卦（`iching/`）**；**多声部对话（`dialogue/`，stage-10，详文于 op-008）**（stage-06/08/09/10 补）；**研究域（`research/`：采样/交叉判断契约与算法，provider 无关）**（stage-07 补）

- **features/** — 用户功能模块（stage-04 建立）
  - [`editor.md`](features/editor.md)：章节编辑器（Tiptap 一章一实例、HTML 存储）、卷章大纲树与 dnd-kit 排序、自动保存、AI 增量插入接口（stage-04 建立）
  - [`generation.md`](features/generation.md)：生成入口/面板、`generationStore` 边界、模式 A 流式直插（stage-05 建立）
  - [`setting-cards.md`](features/setting-cards.md)：设定卡 CRUD 面板（stage-05 建立）
  - [`review.md`](features/review.md)：审查流水线 —— 四维评估器 / 加权择优 / 重写回路 / 审查面板 / 审查记录持久化（迁移 v3 + IPC）（stage-06 建立）
  - [`research.md`](features/research.md)：研究工作台 —— 多模型采样 / 交叉判断 / 用户标注 / 素材库（迁移 v4 + 导出）/ 规避 skill 库 / 闭环回注与度量实验（stage-07 建立）
  - [`exploration.md`](features/exploration.md)：多温度并行推演 —— 契约与温度 clamp / 走向卡 / 分支对比视图 / 克制收敛 / 采纳丢弃安全网 / 并发与成本（stage-08 建立）
  - [`iching.md`](features/iching.md)：易经卦象系统 —— 64 卦数据与手写校验 / 朱熹变爻推导 / 起卦 / 引导卡 / 角色宿命卡写入设定卡 / **可选可关**（stage-09 建立）
  - [`characters.md`](features/characters.md)：角色档案（复用既有 `Character` 仓储）（stage-10 建立，详文收尾于 op-008）
  - [`dialogue.md`](features/dialogue.md)：多声部对话（选角 → 生成 → 会话内存条目 → 合并落章）（stage-10 建立，详文收尾于 op-008）

## 维护约定

- 每个模块文档须含：**职责**、**目录结构 / 核心文件**、**核心 API 或约定**、**关联文档**。
- 模块的 API、结构或职责发生变更时，归档阶段同步更新；未建立的模块不提前占位，避免与实现脱节。
