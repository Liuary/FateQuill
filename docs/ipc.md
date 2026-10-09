# IPC 通道约定（FateQuill / 命笔）

> 本文档描述前端（React）与 Rust 后端（`src-tauri/`）之间的 IPC 通道约定。
> 命令通道于 v0.1.0-stage-01（T5）落地；事件流通道于 v0.1.0-stage-03（T2）落地。

## 1. 通道类型总览

| 通道类型                     | 机制                                     | 状态                                         |
| ---------------------------- | ---------------------------------------- | -------------------------------------------- |
| 命令通道（command / invoke） | 前端 `invoke` → Rust `#[tauri::command]` | **本阶段实现**                               |
| 事件流通道（event / stream） | Rust `emit` / `Channel` → 前端监听       | **stage-03 已实现**（`Channel` + requestId） |

## 2. 命令通道注册约定

- **Rust 侧**：用 `#[tauri::command]` 标注处理函数，统一在 `tauri::Builder::default()` 的
  `invoke_handler(tauri::generate_handler![...])` 中注册。新增命令必须加入该宏列表，否则前端调用返回「command not found」。
- **前端侧**：所有 `invoke` 调用**统一封装于 `src/ipc/*.ts`**；组件层（`src/app/`、`src/components/`、`src/features/` 等）**不得直接 `invoke`**，只能经 `@/ipc/*` 封装函数调用，以隔离命令名与参数形态（对应大计划边界约定 C-04）。

## 3. 命名约定

- **命令名**：Rust 侧小写下划线（snake_case），如 `ping`、后续 `list_novels`、`save_chapter`。
- **前端封装函数**：`src/ipc/*.ts` 导出的函数用 camelCase（如 `listNovels`），文件可按领域拆分。
- **返回值**：命令返回 `Result<T, E>`；成功值经 `invoke<T>` 返回，错误以异常抛出，前端用 `try/catch` 处理（`invoke` 的 promise reject）。

## 4. 参数命名与映射

- Rust 侧参数使用 snake_case，前端 `invoke(cmd, args)` 的 `args` 对象使用 **camelCase**（Tauri 2 默认自动在 snake_case 与 camelCase 之间转换）。
- 例：Rust `fn save_chapter(novel_id: String, content: String)` 对应前端
  `invoke("save_chapter", { novelId, content })`。
- 若需禁用/自定义转换，在命令或 `tauri.conf` 层显式配置；默认不启用。

## 5. 边界约定（C-04）

- **所有外部 HTTP、密钥、SQLite 访问仅在 Rust 侧**（`src-tauri/`）。
- 前端**只经 IPC**（`src/ipc/*`）调用后端，不直接发起外部网络请求、不直连数据库或读取密钥。
- 该边界与 `docs/structure.md` §5 一致。

## 6. 事件流通道约定（stage-03 落地）

- **命令**：`http_stream(request_id, url, headers, body, auth, on_event)` —— Rust 侧 provider 无关的 SSE 透明中继，经 Tauri `Channel<StreamEvent>` 流式回传；`abort_stream(request_id)` 断流取消（`AbortHandle`，drop future → 连接关闭）。
- **`StreamEvent` 三态**：`Chunk { data }`（完整 SSE 事件块，按空行边界切分，兼容 `\n\n` / `\r\n\r\n`）/ `Done` / `Error { code, message, statusCode? }`。
- **超时**：connect 10s / read 60s → `TIMEOUT`；v0.1 **不自动重试**。
- **https-only**：`url` 仅允许 `https://`（`ensure_https`，REV-009①）。
- **授权头（REV-009②）**：授权类头（`authorization`/`x-api-key`/`proxy-authorization`/`api-key`）由 Rust 侧从密钥链读取并**合并/覆盖**，前端传入的同名头**一律丢弃**；非 Key 头（Content-Type/Accept 等）允许前端传入。**Key 仅在 Rust 内存，永不下发前端**。
- **错误脱敏**：中继错误 payload 仅 `{code,message,statusCode?}`，**不含 URL/headers/body/Key**。
- **前端口径**：`src/ipc/stream.ts` 的 `httpStream()` 封装（`requestId` 可选、内部缺省 `crypto.randomUUID()`，REV-011）。

## 7. 示例：`ping` 完整链路

1. **Rust 定义与注册**（`src-tauri/src/lib.rs`）：

   ```rust
   #[tauri::command]
   fn ping() -> String {
       "pong".to_string()
   }

   pub fn run() {
       tauri::Builder::default()
           .invoke_handler(tauri::generate_handler![ping])
           .run(tauri::generate_context!())
           .expect("error while running tauri application");
   }
   ```

2. **前端封装**（`src/ipc/ping.ts`）：

   ```ts
   import { invoke } from "@tauri-apps/api/core";

   export async function ping(): Promise<string> {
     return invoke<string>("ping");
   }
   ```

3. **组件调用**（`src/app/App.tsx`，经封装、不直接 `invoke`）：

   ```tsx
   import { ping } from "@/ipc/ping";
   // ...
   setResult(await ping());
   ```

4. **预期**：点击按钮后显示 `pong`。

## 8. 数据访问命令与错误结构

### 8.1 数据访问命令清单（36 个）

> 另见 §6 流式通道命令（`http_stream` / `abort_stream`）——故全仓实际注册命令共 38 条。

5 实体 × [list / get / create / update / delete]，命令名 snake_case：

| 实体        | 命令                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Novel       | `list_novels` `get_novel` `create_novel` `update_novel` `delete_novel`                                    |
| Volume      | `list_volumes` `get_volume` `create_volume` `update_volume` `delete_volume`                               |
| Chapter     | `list_chapters` `get_chapter` `create_chapter` `update_chapter` `delete_chapter`                          |
| SettingCard | `list_setting_cards` `get_setting_card` `create_setting_card` `update_setting_card` `delete_setting_card` |
| Character   | `list_characters` `get_character` `create_character` `update_character` `delete_character`                |

- 参数：Rust 侧 snake_case（如 `novel_id`、`content_format`），前端 `invoke(cmd, { novelId, contentFormat })` 自动映射。
- 返回：实体行对象（snake_case 列名，如 `novel_id`/`content_format`/`order_index`/`word_count`）；`delete_*` 返回空。

顺序维护命令（ordering，共 3 个）：

| 类别     | 命令               | 参数（前端 camelCase）               | 语义                                                                   |
| -------- | ------------------ | ------------------------------------ | ---------------------------------------------------------------------- |
| Ordering | `reorder_volumes`  | `{ novelId, orderedIds: number[] }`  | 按给定顺序重写该作品下卷的 `order_index`（0..n-1），两阶段重排，事务内 |
| Ordering | `reorder_chapters` | `{ volumeId, orderedIds: number[] }` | 同上（卷下章）                                                         |
| Ordering | `move_chapter`     | `{ chapterId, toVolumeId, toIndex }` | 跨卷移动章，源卷/目标卷均紧凑化（`toIndex` 越界 clamp），事务内        |

模型配置命令（model_config，共 5 个）：

| 类别        | 命令                                      | 参数（前端 camelCase）                                                | 语义                            |
| ----------- | ----------------------------------------- | --------------------------------------------------------------------- | ------------------------------- |
| ModelConfig | `list_model_configs` / `get_model_config` | 无 / `{ id }`                                                         | 列出 / 获取模型配置             |
| ModelConfig | `create_model_config`                     | `{ provider, label, baseUrl, modelName, temperature, isDefault }`     | 新增（`(provider,label)` 唯一） |
| ModelConfig | `update_model_config`                     | `{ id, provider, label, baseUrl, modelName, temperature, isDefault }` | 更新                            |
| ModelConfig | `delete_model_config`                     | `{ id }`                                                              | 删除                            |

密钥命令（keyring，共 3 个；**无 `keyring_get`**，Key 永不回传前端）：

| 类别    | 命令             | 参数（前端 camelCase）     | 语义                                  |
| ------- | ---------------- | -------------------------- | ------------------------------------- |
| Keyring | `keyring_set`    | `{ provider, label, key }` | 写入/更新 OS 密钥链（Key 不下发前端） |
| Keyring | `keyring_delete` | `{ provider, label }`      | 删除密钥                              |
| Keyring | `keyring_exists` | `{ provider, label }`      | 查询是否存在（布尔；不返回 Key）      |

#### 配置表 ↔ 密钥链条目关联

- `model_config(provider, label)` ↔ keyring 条目：`service = fatequill`、`account = {provider}/{label}`（即 `fatequill/{provider}/{label}`）。
- 经 `keyring_set` / `keyring_delete` / `keyring_exists` 三命令管理（**无 `keyring_get`**）：**Key 不入库**（`model_config` 表不含 key 列，C-05）、**不下发前端**；仅 Rust 中继（`http_stream`）在注入授权头时内部读取。

> 后续 op 新增命令须同步本清单（stage-03 已完成 `http_stream` / `abort_stream`（§6）与模型配置/密钥命令（本清单））。

### 8.2 错误结构与错误码表

Rust 侧错误序列化为 `{ code, message, detail? }`；前端 `src/ipc/errors.ts` 归一化为 `IpcError`。

| 错误码             | 触发场景                                        |
| ------------------ | ----------------------------------------------- |
| `NOT_FOUND`        | get/update/delete 影响行数为 0                  |
| `VALIDATION`       | 标题为空、`content_format` / `status` 非法      |
| `UNIQUE_VIOLATION` | 唯一约束冲突（SQLite 2067 / 1555）              |
| `FK_VIOLATION`     | 外键无效（SQLite 787）                          |
| `MIGRATION_FAILED` | 迁移失败（预留）                                |
| `DB_LOCKED`        | 数据库锁定（SQLite 5 / 6）                      |
| `TIMEOUT`          | SSE 中继连接/读取超时（connect 10s / read 60s） |
| `INTERNAL`         | 其他内部错误（含连接池未就绪）                  |

### 8.3 前端调用客户端

`src/ipc/client.ts` 的 `invokeCommand` 统一封装 `invoke` 并归一化错误：

```ts
import { invokeCommand } from "@/ipc/client";
import { IpcError, IpcErrorCode } from "@/ipc/errors";

try {
  const novels = await invokeCommand<Novel[]>("list_novels");
} catch (e) {
  if (e instanceof IpcError && e.code === IpcErrorCode.NotFound) {
    // 处理未找到
  }
}
```

### 8.4 边界声明

- 前端**不 import** `@tauri-apps/plugin-sql`；SQL 语句与 Database 实例**不出现在前端**。
- 前端数据访问**只经** `src/ipc/*` 封装的命令；组件层不直接 `invoke`。

> **生成流程（stage-05）**：复用现有 IPC——SSE 中继 `http_stream`/`abort_stream`（§6）与仓储命令（§8）；**本阶段不新增 IPC 命令**。
