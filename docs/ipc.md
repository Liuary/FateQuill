# IPC 通道约定（FateQuill / 命笔）

> 本文档描述前端（React）与 Rust 后端（`src-tauri/`）之间的 IPC 通道约定。
> 归属阶段：v0.1.0-stage-01（T5）。**本阶段仅落地「命令通道」**；事件流通道预留至 stage-03。

## 1. 通道类型总览

| 通道类型                     | 机制                                     | 状态                                |
| ---------------------------- | ---------------------------------------- | ----------------------------------- |
| 命令通道（command / invoke） | 前端 `invoke` → Rust `#[tauri::command]` | **本阶段实现**                      |
| 事件流通道（event / stream） | Rust `emit` / `Channel` → 前端监听       | **延后至 stage-03**（SSE 流式中继） |

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

## 6. 事件流通道延后声明

- **SSE 流式中继**（Rust `emit` / `Channel` 向前的增量推送）**归属 stage-03**。
- 本阶段**不实现**事件流/流式逻辑；前端生成/编辑器状态隔离归属 **stage-05**。

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

### 8.1 命令清单（25 个）

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

### 8.2 错误结构与错误码表

Rust 侧错误序列化为 `{ code, message, detail? }`；前端 `src/ipc/errors.ts` 归一化为 `IpcError`。

| 错误码             | 触发场景                                   |
| ------------------ | ------------------------------------------ |
| `NOT_FOUND`        | get/update/delete 影响行数为 0             |
| `VALIDATION`       | 标题为空、`content_format` / `status` 非法 |
| `UNIQUE_VIOLATION` | 唯一约束冲突（SQLite 2067 / 1555）         |
| `FK_VIOLATION`     | 外键无效（SQLite 787）                     |
| `MIGRATION_FAILED` | 迁移失败（预留）                           |
| `DB_LOCKED`        | 数据库锁定（SQLite 5 / 6）                 |
| `INTERNAL`         | 其他内部错误（含连接池未就绪）             |

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
