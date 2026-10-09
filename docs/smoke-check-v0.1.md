# v0.1 真机冒烟检查单

> 归属阶段：v0.1.0-stage-05（T6 收口）。**真机（Tauri 窗口）人工协验**；自动化部分见 `pnpm test`（Vitest mock 全链路）与 `cargo test --manifest-path src-tauri/Cargo.toml`（数据层往返）。
> 执行方式：`corepack pnpm tauri dev` → 按下表逐项操作并填写「实际 / 结果」。

## 前置

- 已按 `README.md` 完成环境前置（Rust / MSVC / WebView2 / Node / pnpm）。
- 首次运行前可在「设置」配置一个 `model_config` 并写入有效 API Key（keyring）。

## 检查项

| #   | 步骤                                          | 预期                                                         | 实际                    | 结果 |
| --- | --------------------------------------------- | ------------------------------------------------------------ | ----------------------- | :--: |
| M1  | 启动应用；若空态 →「新建作品」创建一部        | 进入工作区，左大纲树 + 中编辑器 + 右生成面板                 | BLOCKED(需人工 WebView) |  ⛔  |
| M2  | 在大纲树「新增卷」→「新增章」；选中第 1 章    | 章节出现在树中；编辑器加载                                   | BLOCKED(需人工 WebView) |  ⛔  |
| M3  | 在编辑器输入正文（中文）                      | 文本正常输入；右下/状态显示保存中→已保存                     | BLOCKED(需人工 WebView) |  ⛔  |
| M4  | 生成面板输入指令 → 点「开始生成」             | 文本**流式直插**到正文末尾；进度递增；编辑器无卡顿           | BLOCKED(需人工 WebView) |  ⛔  |
| M5  | 生成中切换「设定卡」tab →「新增设定卡」→ 保存 | 设定卡出现在列表                                             | BLOCKED(需人工 WebView) |  ⛔  |
| M6  | **关窗重开** → 重新进入工作区                 | **第 1 章正文仍在**（含 M4 生成内容）；**设定卡仍在**        | BLOCKED(需人工 WebView) |  ⛔  |
| M7  | 无 `model_config` 或 keyring 无 Key 时        | 生成按钮禁用 + 提示「前往设置」                              | BLOCKED(需人工 WebView) |  ⛔  |
| M8  | 生成中点「停止」                              | 生成停止；**已插入内容保留**；一次 `Ctrl+Z` 撤销整段生成     | BLOCKED(需人工 WebView) |  ⛔  |
| M9  | 生成过程中制造失败（如断网/非法 Key）         | 显示错误（IpcError）；已插入内容保留；状态复位（可再次生成） | BLOCKED(需人工 WebView) |  ⛔  |
| M10 | 大纲树拖拽排序（卷/章）；重启后               | 顺序持久化（重启后保持）                                     | BLOCKED(需人工 WebView) |  ⛔  |

## 结果汇总

- 通过项：0 / 10（**BLOCKED(需人工 WebView)**：本轮执行环境**无 GUI 会话**，未实测；非失败、非通过）
- 未通过项与现象：无（未执行）
- 环境（OS / WebView2 / 日期 / 操作者）：Windows / WebView2 / 2026-10-10 / openfeel-executor（BLOCKED）

> **BLOCKED(需人工 WebView)**：M1–M10 全部待人工在 `pnpm tauri dev` 窗口内逐项执行并回填「实际/结果」两列；本 op（stage-06 op-001）**不伪造**手测结果，**不阻塞**其余任务。

> 说明：v0.1 **不引入 tauri-driver**（成本/收益低，留 v0.2+ 评估）；「重启不丢」由 M6 一条手测承载。M4 的延迟/内存口径见 `src/features/editor/perf/README.md`（真实 WebView 基准）。
