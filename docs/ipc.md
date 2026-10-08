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
