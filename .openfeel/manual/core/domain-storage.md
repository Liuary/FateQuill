# 模块手册：领域模型与本地存储（core/domain-storage）

## 职责

FateQuill 的核心领域模型（作品 / 卷 / 章 / 设定卡 / 角色占位）与基于 SQLite 的持久化层，为编辑器（stage-04）与 AI 生成（stage-05）提供数据基座。建立于 **v0.1.0-stage-02**。

- 领域层与 UI/网络/Tauri 解耦（纯 TS），仓储接口与实现分离。
- 存储边界：SQLite 访问**仅在 Rust 侧**，前端经 IPC 命令访问（约束 C-04）。
- 章节正文**每章独立一条**（分文档基础，C-01）。

## 目录结构 / 核心文件

```
src/domain/                          # 纯 TS 领域层（禁 UI/网络/Tauri/IPC）
├── models/{novel,volume,chapter,setting-card,character}.ts   # 实体接口 + index
├── values.ts                        # ChapterStatus / ContentFormat 枚举
├── invariants.ts (+ .test.ts)       # 5 条不变量纯函数校验
├── repositories/*-repository.ts     # 仓储接口（纯 TS，仅依赖 models）
└── index.ts

src/ipc/                             # 前端 IPC 适配层（invoke 封装）
├── client.ts (+ .test.ts)           # invokeCommand：统一调用 + 错误归一化
├── errors.ts (+ .test.ts)           # IpcError / IpcErrorCode / parseIpcError
└── repositories/*-repository.ts     # 实现领域仓储接口；snake_case↔camelCase 映射

src-tauri/
├── migrations/0001_init.sql         # 建表 SQL（单一来源，include_str! 与 sqlx::migrate! 同源）
└── src/
    ├── error.rs                     # IpcError {code,message,detail?} + 7 错误码 + sqlx 映射
    ├── commands.rs                  # 28 命令薄封装（取池 → db 函数）
    ├── lib.rs                       # 插件注册 + generate_handler![28 命令]
    └── db/
        ├── mod.rs                   # DB_URL、get_pool、begin（统一事务入口）、test_util（内存库）
        ├── migrations.rs            # 插件 Migration 数组
        ├── {novel,volume,chapter,setting_card,character}.rs   # 行结构 + CRUD
        ├── word_count.rs            # 按 content_format 计算字数
        ├── ordering.rs              # 两阶段重排 / 移动
        ├── seed.rs / bench.rs / integrity.rs   # #[cfg(test)] 测试支撑
```

## 数据模型（schema v1）

| 实体 | 表 | 关键字段 |
|------|----|----------|
| Novel | `novel` | id, title, synopsis, created_at, updated_at |
| Volume | `volume` | id, novel_id(FK CASCADE), title, order_index, `UNIQUE(novel_id,order_index)` |
| Chapter | `chapter` | id, volume_id(FK CASCADE), title, content, `content_format`(默认 html), order_index, `status`(draft/archived), word_count, created_at, updated_at, `UNIQUE(volume_id,order_index)` |
| SettingCard | `setting_card` | id, novel_id(FK CASCADE), title, content, kind, created_at |
| Character | `character` | id, novel_id(FK CASCADE), name, profile(JSON 字符串) |

- TS 侧字段 camelCase（`novelId`/`contentFormat`/`wordCount`/`orderIndex`），SQL snake_case 映射由 `src/ipc/` 承担。
- `id` 为 SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`（v0.1 不引入 UUID）。

## 核心 API / 约定

- **仓储接口 ↔ IPC 命令 1:1**：每个实体 `list* / get / create / update / remove` 五方法，与同名 Rust 命令对应；Chapter 另有 `move(id,toVolumeId,toIndex)` / `reorder(volumeId,orderedIds)`。
- **IPC 命令共 28 个**：25 CRUD（5 实体 × 5）+ 3 ordering（`reorder_volumes` / `reorder_chapters` / `move_chapter`）。契约见 `docs/ipc.md`。
- **错误结构**：`{ code, message, detail? }`；错误码 `NOT_FOUND / VALIDATION / UNIQUE_VIOLATION / FK_VIOLATION / MIGRATION_FAILED / DB_LOCKED / INTERNAL`；前端 `parseIpcError` 归一化为 `IpcError`（按 `.code` 分支）。
- **迁移**：`tauri-plugin-sql` 内置（`_sqlx_migrations`，幂等）；`tauri.conf.json` `plugins.sql.preload` 启动即应用；db 位置 `sqlite:fatequill.db`（AppData）。
- **事务**：`db::begin(pool)` 为多步写入唯一入口（错误即回滚）；删除章/卷后在同一事务内紧凑化 `order_index`。
- **顺序不变量**：同一父级内 `order_index` 唯一且连续（从 0 起）；重排用「两阶段」（先置负值）规避 UNIQUE 中途冲突。
- **word_count**：Rust 侧写入回填，单位=非空白字符；`html` 分支为**近似值**（简易去标签 + 常用实体解码）。
- **领域层纯度**：ESLint `no-restricted-imports` 约束 `src/domain/**` 禁 `react*`/`@tauri-apps/*`/`@/ipc`/`@/components`/`@/ui`/`@/features`/`@/store`。

## 测试基线（v0.1.0-stage-02）

- `cargo test` 28/28：迁移建表/幂等、CRUD 往返、NOT_FOUND/VALIDATION、ordering、完整性（FK 级联真实断言、事务回滚）、word_count 三分支、bench（50×3000 单查询 < 100ms）。
- Vitest 36/36：ipc client/errors + 5 仓储（mock `invoke`）。
- 测试隔离：`sqlite::memory:`（`foreign_keys(true)`、`max_connections(1)`），不触达 AppData 开发库。

## 关联文档

- IPC 契约：`docs/ipc.md`（§8 数据访问命令与错误结构）｜目录分层：`docs/structure.md`（§5~§7）
- 知识库：`.openfeel/kb/architecture.md`（分层/错误结构/事务）、`patterns.md`（仓储对齐/重排/word_count）、`troubleshooting.md`
- 阶段计划：`.openfeel/plan/v0/stage-02/plan.md`
- 上游模块：`manual/engineering/scaffold.md`（工程脚手架）
