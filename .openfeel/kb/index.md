# 知识库索引

> 记录「这个项目是什么样的」与「遇到问题怎么办」。分类摘要供快速定位；条目详情见各分类文件。`[+]` 启用 / `[-]` 禁用。

## 项目快速概览

| 项 | 值 |
|----|----|
| 项目 | FateQuill（命笔）— 跨平台 AI 辅助长篇创作桌面工具 |
| 技术栈 | Tauri 2 + React 19 + Vite + TS(strict) + Tailwind v4 + shadcn/ui + i18next + pnpm |
| 源文件 | 38（`glob src/**/*.ts`，不含 `.tsx`） |
| Agent 数 | 9（`glob .opencode/agents/*.md`，当前项目级无 agents 目录，取全局 9） |
| 最近更新 | 2026-10-09 |

## 分类概览

| 文件 | 主题 | 条目 | 摘要 |
|------|------|:----:|------|
| [architecture.md](architecture.md) | 架构决策 | 5 | 技术栈定稿与理由；目录分层与状态隔离约定；IPC 通道约定（事件流延后）；SQLite 选型与封装边界（单一来源迁移）；领域层三段式分层 + IPC 错误结构/统一事务入口 |
| [patterns.md](patterns.md) | 代码模式 | 7 | ESM 写法（禁 `__dirname`）；`@/*` 别名双端一致；i18n 命名空间；提交消息规范；仓储接口↔命令 1:1 对齐；两阶段 order_index 重排；word_count 近似值约定 |
| [troubleshooting.md](troubleshooting.md) | 排查经验 | 8 | pnpm 安装坑；Tailwind v4 CSS-first 与 shadcn preset；TS6 `baseUrl` 弃用；`resolveJsonModule` 预检；构建期依赖陷阱（shadcn/前端绑定包）；sqlx 直依赖取池；UNIQUE 重排冲突；dead_code 卫生 |
| [setup.md](setup.md) | 环境配置 | 3 | 环境前置与版本锚定；构建/测试/CI 命令；数据存储位置与重置；Rust 数据层测试（内存库/迁移幂等） |

## 最近更新

- **2026-10-09**：归档 v0.1.0-stage-02（核心领域模型与本地存储），新增 architecture×2 / patterns×3 / troubleshooting×4 / setup×1 共 10 条，并修订 1 条既有条目（shadcn 依赖卫生）。
- **2026-10-09**：初始化知识库；归档 v0.1.0-stage-01（工程脚手架与工程化基础设施），提取 architecture×3 / patterns×4 / troubleshooting×4 / setup×2 共 13 条。
