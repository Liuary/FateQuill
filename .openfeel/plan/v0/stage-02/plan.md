# v0.1.0-stage-02 详细计划：核心领域模型与本地存储

> 修订：v2（2026-10-09，依据 REV-v0.1.0-stage-02 的 8 条审查意见修订）。

## 归属版本
v0.1（最小可用闭环）

## 目标
建立与 UI 解耦的领域模型与基于 SQLite 的持久化层，支撑章节分文档存储与设定卡。

## 对应核心目的
- 目的 1：为作品结构（卷/章）与设定提供可恢复的持久化。
- 目的 2：设定与文本分离存储，为后续「去 AI 味素材」「设定一致性」预留结构。

## 前置依赖
v0.1.0-stage-01（已归档）。stage-01 遗留 REV-016~019 在本阶段首个 op 附带清理（见 T7）。

## 技术约束（本阶段适用）

### 存储与插件选型（定稿，修订 REV-001）
- 插件：**`tauri-plugin-sql` v2**（Rust：`tauri-plugin-sql = { version = "2", features = ["sqlite"] }`）+ 前端绑定包 **`@tauri-apps/plugin-sql ^2`**；精确 minor/patch 以 `Cargo.lock` / `pnpm-lock.yaml` 锁定，并在方案阶段记录到 `kb/architecture.md`。
- **封装边界裁决（定稿）**：**SQL 插件仅在 Rust 侧使用**；前端**不得** `import` 插件 JS API（`@tauri-apps/plugin-sql`），数据库实例与 SQL 语句**不出现在前端代码**。所有数据访问经 `src/ipc/` 封装的 `invoke` 自定义命令；`src/domain/repositories` 仅含接口。该裁决与 stage-01 已固化表述一致（`docs/structure.md` §5、`kb/architecture.md` L34、`manual/engineering/scaffold.md` L39）。
- **数据库文件位置（定稿）**：`sqlite:fatequill.db`，落在 Tauri **AppData 目录**（Windows：`%APPDATA%/com.fatequill.app/fatequill.db`）；同步写入 `README.md` 与 `kb/setup.md`。
- **须同步更新的文档/kb 范围（schemer 在方案阶段落实）**：`docs/structure.md`（§5 补插件与封装边界）、`docs/ipc.md`（数据访问命令与错误结构）、`kb/architecture.md`（新增「SQLite 选型与封装边界」条目）、`manual/engineering/scaffold.md`（补插件依赖与 db 位置）。

### 迁移机制（定稿，修订 REV-002）
- 采用**插件内置 migrations**：Rust 侧注册 `Migration` 数组，底层 sqlx 以 `_sqlx_migrations` 表管理版本，**天然幂等**；**不自研迁移执行器**（避免无复用价值的重复建设，C-08）。
- 交付物改述为「**插件迁移注册 + v1 迁移脚本（建表 SQL）**」。
- 失败处理：迁移在连接初始化时执行；失败即**启动报错并中止**（不进入半迁移态），错误经 IPC 错误结构上报。

### 分层落点（定稿，修订 REV-003）
- 三段式：`src/domain/repositories/`（纯 TS 仓储接口 + 领域类型）→ `src/ipc/`（实现仓储接口，经 `invoke` 访问 Rust）→ `src-tauri/`（Rust 命令 + 插件注册）。
- **不新建 `src/infra/`**（保持与 stage-01 目录分层一致）。
- `docs/structure.md` 相应小节由 schemer 在方案阶段同步（注明 `repositories` 接口与 `ipc` 实现的对应关系）。

### 领域层纯度与测试策略（定稿，修订 REV-005/007）
- 领域层纯 TS：无 UI/网络/Tauri 依赖；**工具化判定**：ESLint `no-restricted-imports` 约束 `src/domain/**` **禁止导入** `react*`、`@tauri-apps/*`、`@/ipc`、`@/components`、`@/ui`、`@/features`、`@/store`；规则接入 `pnpm lint` 并在 CI 生效。
- 测试分两层（可判定）：
  - **Vitest**：领域层单测；前端仓储客户端经 `vi.mock("@tauri-apps/api/core")` mock `invoke`，验证参数/返回映射与错误路径——**不连接 Tauri runtime**。
  - **`cargo test`**：对命令处理函数 + SQLite 真库做集成测试（CRUD / 级联 / 事务）。
- **测试库隔离**：测试一律使用 `sqlite::memory:` 或临时目录唯一文件名，**禁止触达 AppData 开发库**；与运行中的 `tauri dev` 并发前须先关闭 dev（或接受文件锁失败重试）。
- **IPC 错误结构约定（REV-007③）**：`{ code: string; message: string; detail?: unknown }` + 错误码表（如 `NOT_FOUND` / `UNIQUE_VIOLATION` / `FK_VIOLATION` / `MIGRATION_FAILED` / `DB_LOCKED`）；T4 交付物，同步 `docs/ipc.md`。

### 其他
- 章节正文按章独立存储（每条一章，C-01）。
- 密钥不入库（C-05），配置单独存储（stage-03）。

## 数据模型（首版，修订 REV-004）

| 实体 | 关键字段 | 说明 |
|------|----------|------|
| Novel（作品） | id, title, synopsis, created_at, updated_at | 一部小说（与 `docs/ipc.md` 的 `novel` 命名一致） |
| Volume（卷） | id, novel_id, title, order_index | 卷 → 章 的中间层 |
| Chapter（章） | id, volume_id, title, **content TEXT**, **content_format TEXT NOT NULL DEFAULT 'html'**, order_index, **status**, word_count | 一章独立一条（分文档基础） |
| SettingCard（设定卡） | id, novel_id, title, content, kind, created_at | v0.1 简化版；分级留待 stage-11 |
| Character（角色占位） | id, novel_id, name, profile(json) | v0.4 多声部复用 |

- **`content_format` 定稿**：v1 初值 `html`（占位备选 `plaintext`）；预留 `tiptap-json` 迁移位。stage-04 引入 Tiptap JSON 时**按行迁移**（`UPDATE ... WHERE content_format='html'`），向后兼容由格式位保证，**不破坏已有数据**。
- **`status` 枚举定稿**：v0.1 值域 = `draft` / `archived`（写入 T1 领域类型）。
- **`word_count` 落点定稿**：由 **Rust 侧写入时统一计算回填**（避免前端双份逻辑）；计算方式按 `content_format` 分支（html → 去标签取文本；tiptap-json → 遍历文本节点）。

## 任务表

| # | 任务 | 交付物 | 验收标准（可判定） | 依赖 |
|---|------|--------|---------------------|------|
| T1 | 领域模型与类型（含不变量清单） | `src/domain/**`（实体、值对象、枚举 `ChapterStatus`） | 类型编译通过；Vitest 覆盖**不变量清单**：①同一卷内 `order_index` 唯一且连续；②`novel_id`/`volume_id` 外键有效；③`content` 非空约束；④`content_format` 属枚举值域；⑤删除后统计（word_count/章数）一致 | stage-01 |
| T2 | schema 与迁移（插件内置）+ 测试数据工厂 | 插件迁移注册 + v1 建表 SQL（含 `PRAGMA foreign_keys=ON` 显式声明）+ seed 工厂 | 空库迁移后表结构与数据模型一致；连续启动两次 `_sqlx_migrations` 记录**不重复**、业务表 schema/数据不变；`PRAGMA foreign_keys` 断言为 on；seed 可按参数生成 50 章 × 3000 字数据集 | T1 |
| T3 | 仓储接口 + IPC 实现 | `src/domain/repositories/`（接口）+ `src/ipc/`（实现，经 invoke） | 接口不含实现细节（纯 TS）；Vitest（mock invoke）验证参数/返回映射与错误路径；`cargo test` 对真库 CRUD 通过；**不新建 `src/infra/`** | T2 |
| T4 | 打通 IPC 命令 + 错误结构 | Rust 命令 + `src/ipc/` 客户端 + 错误码表 + `docs/ipc.md` 更新 | 两层可判定：①Vitest mock 层验证命令名/参数/错误分支；②`cargo test` 对命令处理函数 + 真库的 CRUD/级联/事务通过；错误结构符合 `{code,message,detail?}` | T2 |
| T5 | 章节顺序与统计维护 | `order_index` 重排 + `word_count`（Rust 计算回填） | 插入/删除/移动卷章后顺序正确（测试覆盖）；`word_count` 按 `content_format` 正确；**基于 seed 数据集**的 50×3000 基准脚本可重复执行，单次查询 < 100ms | T3 |
| T6 | 数据完整性保护 | 外键级联 + 事务封装 | `cargo test` **真实断言**级联（删除作品→其卷/章级联删除）与事务回滚不残留半态；显式 `PRAGMA foreign_keys=ON` 双保险 | T3 |
| T7 | stage-01 遗留清理（REV-016~019） | 修复补丁（**并入本阶段首个 op，提交标注 `(chore)`**） | REV-016（`shadcn` CLI 移出 `dependencies`）、REV-017（`Cargo.toml` 模板元数据修正）、REV-018（`index.html` `lang` 动态/`zh-CN`）、REV-019（`pnpm-workspace.yaml` 注释 / README i18n 链接 / `vitest.config.ts` 扩展名）均消除 | stage-01 |

## 阶段验收标准（DoD）
- [ ] 领域层纯度**工具化判定**：ESLint `no-restricted-imports` 规则生效，`pnpm lint` 与 CI 通过（REV-005/007②）。
- [ ] 迁移（插件内置）：空库可构建完整 schema；连续启动两次 `_sqlx_migrations` 不重复、schema/数据不变（REV-002）。
- [ ] 仓储 CRUD 与顺序维护有自动化测试（Vitest mock 层 + `cargo test` 真库层）且通过。
- [ ] IPC 错误结构 `{code,message,detail?}` 落地并同步 `docs/ipc.md`（REV-007③）。
- [ ] 50 章 × 3000 字（**由 seed 工厂构造**）存取基准可重复，单次查询 < 100ms（REV-006）。
- [ ] 数据写入使用事务，异常回滚可验证；外键级联有真实断言（REV-008②）。
- [ ] 测试使用独立临时库，未触达 AppData 开发库（REV-005①）。
- [ ] 插件选型/封装边界/db 位置已同步至 `docs/structure.md`、`docs/ipc.md`、`kb/architecture.md`、`manual/engineering/scaffold.md`（REV-001）。
- [ ] stage-01 遗留 REV-016~019 已清理（REV-008④）。

## REV 修订自查

| REV | 级别 | 处理 | 落点 |
|-----|:----:|------|------|
| REV-001 | high | ✅ | 技术约束「存储与插件选型」：定稿 v2+绑定包、裁决插件仅 Rust 侧、db 位置 `sqlite:fatequill.db`、文档同步范围 |
| REV-002 | medium | ✅ | 技术约束「迁移机制」+ T2 交付物/验收（`_sqlx_migrations` 断言） |
| REV-003 | medium | ✅ | 技术约束「分层落点」三段式、不建 `src/infra/`；T3 验收 |
| REV-004 | medium | ✅ | 数据模型：`content_format`/`status`/`word_count` 定稿 + stage-04 兼容承诺 |
| REV-005 | medium | ✅ | 技术约束「测试策略」两层 + 测试库隔离；T3/T4 验收 |
| REV-006 | low | ✅ | T2 seed 工厂 + T5 基准 + DoD 第 5 条 |
| REV-007 | low | ✅ | T1 不变量清单；ESLint 工具化（DoD 1）；IPC 错误结构（T4 + DoD 4） |
| REV-008 | low | ✅ | 风险节（单连接池/PRAGMA/构建锁）+ T6 级联断言 + T7 清理 REV-016~019 |

## 风险与备注
- **SQLite 并发**：插件默认**单连接池**，UI 单写者场景足够；假设**避免多窗口/后台任务并发写**，若后续需要再评估 WAL 与连接数。
- **外键级联前提**：SQLite `PRAGMA foreign_keys` 默认关闭；迁移脚本与连接配置**显式声明 `ON`** 双保险，且 T6 测试须**真实断言**级联行为（非仅建外键）。
- **构建锁**：测试/`cargo check` 与运行中的 `tauri dev` 并发会争抢 `src-tauri/target` 锁，op 执行须**串行**（与 stage-01 相同纪律）。
- **`content_format` 兼容**：stage-04 引入 `tiptap-json` 时按行迁移；`word_count` 计算须同时支持两种格式分支。

## 待用户拍板
无（本阶段为技术性定稿；封装边界已按推荐方案「插件仅 Rust 侧」裁决，无需用户决策）。

## 需 schemer 在方案阶段落实
1. op 拆分与执行序（首 op 并入 T7 遗留清理，标注 `(chore)`）。
2. 文档同步：`docs/structure.md` §5、`docs/ipc.md`、`kb/architecture.md`、`manual/engineering/scaffold.md`、`README.md`、`kb/setup.md`。
