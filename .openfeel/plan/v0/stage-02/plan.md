# v0.1.0-stage-02 详细计划：核心领域模型与本地存储

## 归属版本
v0.1（最小可用闭环）

## 目标
建立与 UI 解耦的领域模型与基于 SQLite 的持久化层，支撑章节分文档存储与设定卡。

## 对应核心目的
- 目的 1：为作品结构（卷/章）与设定提供可恢复的持久化。
- 目的 2：设定与文本分离存储，为后续「去 AI 味素材」「设定一致性」预留结构。

## 前置依赖
v0.1.0-stage-01

## 技术约束（本阶段适用）
- 存储：Tauri SQL 插件（SQLite）；schema 由**版本化迁移脚本**管理，禁止手工改库。
- 领域层为**纯 TS**（无 UI、无网络、无 Tauri 直接调用），经仓储接口访问存储。
- 章节正文按章独立存储（每条记录一章），禁止整本单条大文本（C-01）。

## 数据模型（首版）
| 实体 | 关键字段 | 说明 |
|------|----------|------|
| Project（作品） | id, title, synopsis, created_at, updated_at | 一部小说 |
| Volume（卷） | id, project_id, title, order_index | 卷 → 章 的中间层 |
| Chapter（章） | id, volume_id, title, content(json/text), order_index, status, word_count | 一章独立一条（分文档基础） |
| SettingCard（设定卡） | id, project_id, title, content, kind, created_at | v0.1 简化版；分级留待 stage-11 |
| Character（角色占位） | id, project_id, name, profile(json) | v0.4 多声部复用 |

## 任务表

| # | 任务 | 交付物 | 验收标准 | 依赖 |
|---|------|--------|----------|------|
| T1 | 定义领域模型与 TypeScript 类型 | `src/domain/*.ts`（实体、值对象、枚举） | 类型编译通过；含单元测试覆盖关键不变量 | stage-01 |
| T2 | 设计并实现 SQLite schema 与迁移 | 迁移脚本（v1 建表）+ 迁移执行器 | 空库执行迁移后表结构正确；重复执行幂等 | T1 |
| T3 | 实现仓储接口与 SQLite 实现 | `domain/repositories`(接口) + `infra`(实现) | CRUD 单元/集成测试通过 | T2 |
| T4 | 打通前端 ↔ Rust/SQL IPC | IPC 命令约定 + 前端仓储客户端 | 前端可增删改查作品/卷/章并有测试 | T2 |
| T5 | 实现章节顺序与统计维护 | order_index 重排 + word_count 计算 | 插入/删除/移动卷章后顺序正确（测试覆盖） | T3 |
| T6 | 数据完整性保护 | 外键级联、事务封装 | 删除作品级联删除其卷章；异常不残留半态 | T3 |

## 阶段验收标准（DoD）
- [ ] 领域层 100% 无 UI/网络依赖（代码审查）。
- [ ] 迁移脚本可从空库构建出完整 schema，重复执行无副作用。
- [ ] 作品/卷/章的 CRUD 与顺序维护有自动化测试且通过。
- [ ] 50 章、每章 3000 字的存取操作在可接受耗时内（单次查询 < 100ms）。
- [ ] 数据写入使用事务，异常回滚可验证。

## 风险与备注
- Chapter.content 结构需与 Tiptap（stage-04）一致；本阶段先用可序列化的 JSON/HTML 文本，编辑器阶段再固化格式，须保持向后兼容。
- 密钥不入库（C-05），配置单独存储（stage-03）。
