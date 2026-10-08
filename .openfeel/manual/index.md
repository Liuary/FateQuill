# 模块手册索引

> `.openfeel/manual/` 记录项目主要模块的职责、核心 API 与结构。按模块分级组织，随阶段推进增量维护。
> 归档官在归档时须检查本阶段涉及模块的 API / 结构 / 职责是否变更，并同步更新对应文档。

## 模块树

- **engineering/** — 工程化基础设施（stage-01 建立）
  - [`scaffold.md`](engineering/scaffold.md)：工程脚手架 —— Tauri 2 + React 19 + Vite + TS(strict) 骨架、目录分层、工具链、i18n 基建、CI

- **core/** — 领域模型与本地存储（stage-02 建立）
  - [`domain-storage.md`](core/domain-storage.md)：领域模型（作品/卷/章/设定卡/角色）、SQLite schema 与插件迁移、仓储接口↔IPC 命令、错误结构与事务约定

> 后续模块（`features/` 用户功能、`orchestration/` 编排引擎等）随对应阶段建立后在此登记。

## 维护约定

- 每个模块文档须含：**职责**、**目录结构 / 核心文件**、**核心 API 或约定**、**关联文档**。
- 模块的 API、结构或职责发生变更时，归档阶段同步更新；未建立的模块不提前占位，避免与实现脱节。
