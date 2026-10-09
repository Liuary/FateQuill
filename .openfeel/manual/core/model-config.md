# 模块手册：模型配置与密钥（core/model-config）

## 职责

多 provider 模型配置的持久化、OS 密钥链封装与设置页 UI。建立于 **v0.1.0-stage-03**。

- **非密钥配置**（provider / label / base_url / model_name / temperature / is_default）入库（SQLite `model_config`，迁移 v2）。
- **API Key** 仅存 OS 密钥链（`keyring`），**不入库、不入 Git、不下发前端、不入日志**（C-05）。
- **关联约定**：`model_config(provider,label)` ↔ keyring 条目 `fatequill/{provider}/{label}`。

## 目录结构 / 核心文件

```
src/domain/models/model-config.ts                   # ModelConfig 领域模型
src/domain/repositories/model-config-repository.ts  # 仓储接口（list/get/create/update/remove）
src/ipc/repositories/model-config-repository.ts     # 实现（invokeCommand，snake_case↔camelCase，is_default 0/1↔boolean）
src/ipc/keyring.ts                                  # keyringSet / keyringDelete / keyringExists（无 get）
src/features/settings/
├── SettingsPage.tsx       # 列表 + 表单 + Key 状态
├── ModelConfigForm.tsx    # provider/label/baseUrl/modelName/temperature/isDefault + Key（password，不回显）
└── ModelConfigList.tsx
src/locales/{zh-CN,en}/settings.json                # i18n settings 命名空间（双语）

src-tauri/migrations/0002_model_config.sql          # 迁移 v2（表不含 key 字段）
src-tauri/src/db/model_config.rs                    # 行结构 + CRUD
src-tauri/src/keyring_store.rs                      # keyring 封装（get 仅 Rust 内部使用）
src-tauri/src/auth.rs                               # 授权头合成：AUTH_DENYLIST 丢弃 + keyring 注入
```

## 数据模型（schema v2）

| 表 | 关键字段 |
|----|----------|
| `model_config` | id, provider, label, base_url, model_name, temperature(默认 0.7), is_default(0/1), created_at, updated_at；`UNIQUE(provider,label)`；**无 key 字段** |

- 迁移 v2 走插件内置 migrations 数组追加（`include_str!` 单一来源 + `_sqlx_migrations` 幂等，不旁路）。

## 核心 API / 约定

- **IPC 命令（8 个）**：`list/get/create/update/delete_model_config`（5）+ `keyring_set` / `keyring_delete` / `keyring_exists`（3，**无 `keyring_get`**）。全仓命令计数见 `docs/ipc.md`（§8.1 数据访问 36 个 + §6 流式 2 个）。
- **Key 流向闭环**：前端只能 set/delete/exists；流式请求时 auth 仅传非密钥元数据（`AuthSpec`），Rust 从 keyring 读取 Key 并注入授权头。
- **错误脱敏**：中继错误 payload 仅 `{code,message,statusCode?}`，不含 URL/headers/body/Key。
- **设置页可达**：`src/app/App.tsx` 提供视图切换入口（T4 人工验证路径）。

## 测试基线（v0.1.0-stage-03）

- Rust：`model_config` CRUD、迁移 v2 幂等（`_sqlx_migrations`==2、6 表）、keyring roundtrip（set→get→delete）、Key 不落库（`pragma_table_info` 精确 9 列 + 负向 `INSERT ... api_key` 应被拒绝）。
- Vitest：model-config 仓储命令名/参数/映射（mock invoke）。
- 卫生：keyring 测试用唯一 label 且清理；`cmdkey /list` 无 `fatequill` 残留。

## 关联文档

- IPC 契约：`docs/ipc.md`（§6 授权头合并、§8 配置/密钥命令、config↔keyring 关联）
- 知识库：`.openfeel/kb/architecture.md`（模型配置持久化 + 密钥链）、`setup.md`（密钥链 / 测试凭据清理）、`troubleshooting.md`（keyring 4 / 迁移 v2）
- 阶段计划：`.openfeel/plan/v0/stage-03/plan.md`
- 相关模块：`manual/core/domain-storage.md`（存储与三段式分层）、`manual/orchestration/engine.md`（流式调用）
