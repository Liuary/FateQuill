# v0.1.0-stage-02

## 目标

定义核心领域模型与本地存储层：SQLite schema、迁移机制与仓储（作品 / 卷 / 章 / 设定卡 / 角色占位），为编辑器与 AI 生成提供数据基座。
（v2：依据 REV-v0.1.0-stage-02 修订，见 `plan.md`。）

## 依赖

- v0.1.0-stage-01（已归档）
- 附带清理：stage-01 遗留 REV-016~019（并入本阶段首个 op）

## 操作方案

> 由 openfeel-schemer 制定；任务分解（T1~T7）见本目录 `plan.md`。op 文件位于 `ops/`。

| op | 标题 | 对应任务 | 前置 |
|----|------|:--------:|------|
| op-001 | 清理 stage-01 遗留 REV-016~019（chore） | T7 | — |
| op-002 | 领域模型、类型与不变量校验 | T1 | op-001 |
| op-003 | SQLite schema、插件迁移注册与 seed 工厂 | T2 | op-001、op-002 |
| op-004 | Rust IPC 命令、错误结构与前端 IPC 客户端 | T4 | op-003 |
| op-005 | 仓储接口与 IPC 实现 | T3 | op-004 |
| op-006 | 章节顺序维护与 word_count 回填 | T5 | op-005 |
| op-007 | 数据完整性：外键级联与事务 | T6 | op-006 |

> 说明：T4（op-004）先于 T3（op-005）执行——T3 的 IPC 实现与 `cargo test` 依赖 op-004 提供的 Rust 命令与错误结构；数字序号即执行序。

### 定稿要点（摘要）
- **插件**：`tauri-plugin-sql` v2（Rust 侧）；**不安装** `@tauri-apps/plugin-sql` 前端绑定包（REV-009：零引用即死依赖）。**插件仅在 Rust 侧使用**，前端经 `src/ipc/` 封装的 `invoke` 命令访问，前端不出现 SQL/Database 实例。
- **Rust 侧取池**：`app.state::<DbInstances>()` → `DbPool::Sqlite(Pool<Sqlite>)`，故直接依赖 `sqlx 0.8`（见 op-003/op-004）。
- **迁移**：插件内置 migrations（sqlx `_sqlx_migrations`，天然幂等）；不自研执行器。
- **db 位置**：`sqlite:fatequill.db`（Tauri AppData）。
- **分层落点**：`src/domain/repositories/`（接口）→ `src/ipc/`（实现）→ `src-tauri/`（命令/插件）；**不新建 `src/infra/`**。
- **Chapter.content**：`content TEXT` + `content_format DEFAULT 'html'`（预留 `tiptap-json`）；`status` ∈ `draft|archived`；`word_count` 由 Rust 侧回填。
- **测试**：Vitest（mock invoke）+ `cargo test`（真库）；独立临时库；领域层纯度用 ESLint `no-restricted-imports` 工具化。

### schemer 落实结果
- op 拆分：7 个 op，首 op 并入 REV-016~019 清理（标注 `(chore)`），见上表。
- 文档同步落点：`docs/structure.md` §5 与 repositories↔ipc 对应关系（op-003/op-005）、`docs/ipc.md`（op-004）、`kb/architecture.md`（op-003）、`manual/engineering/scaffold.md`（op-003）、`README.md`（op-001/op-003）、`kb/setup.md`（op-003）。
- REV-009：op-003 明确不安装 `@tauri-apps/plugin-sql` 并提供验证项。
