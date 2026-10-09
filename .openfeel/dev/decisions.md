# 决策记录（ADR）

> 长期技术/架构决策（技术选型、架构方向、跨会话有效的设计取舍）以 ADR 轻量格式记录于此。
> 会话临时决策（流程调整、单次取舍）记录在 .openfeel/users/{username}/dev_last/decisions.md（主题文件「决策记录」），不写入本文件。
> 写入时机：Feel 做出长期技术/架构决策时，同步追加一条 ADR 记录。

## ADR 模板

### ADR-{NNN}：{决策标题}
- **日期**：{yyyy-mm-dd}
- **状态**：proposed / accepted / superseded / deprecated
- **决策**：{一句话描述采纳的决策内容}
- **理由**：{为什么这样决策，含备选方案及取舍分析}

---

### ADR-001：AI 调用层 = Rust 侧 provider 无关 SSE 中继 + 前端自研协议适配器（v0.1 不引入 Vercel AI SDK）
- **日期**：2026-10-09
- **状态**：accepted
- **背景**：大计划 §2 原定稿「AI 层 = Vercel AI SDK」，但其为 JS/TS 库，在 Tauri 中只能运行于前端 WebView，provider 默认以 `fetch` 直连云端——引入即违反 C-04（前端不直连外网）；且明文 API Key 必须下发前端才能发起请求，违反 C-05。与 T2/T3 既定的「Rust SSE 中继 + TS 适配器」设计存在未裁决的架构矛盾。
- **决策**：v0.1 **移除 Vercel AI SDK**（`ai` 包降级为「后续可评估」，不引入）。数据面定为 **Rust 侧 provider 无关 SSE 中继**（`reqwest` + Tauri `Channel`，仅透明转发「URL+headers+body → 分块事件」，不含 provider 语义）+ **前端自研协议适配器**（解析 openai-compatible `data:`/`[DONE]` 与 anthropic SSE 事件类型）。API Key 仅 Rust 侧从系统密钥链（`keyring` crate）读取并拼装请求头，**永不下发前端**。
- **备选**：① 前端直连 —— 否决（CORS + 密钥下发，违反 C-04/C-05）；② 保留 AI SDK + 自定义 fetch 桥 —— 否决（IPC 事件流伪装成 `Response` 的胶水复杂度、中断/背压透传风险大于 v0.1 收益；AI SDK 多 provider 抽象与自建 `ModelProvider` 接口重复，违反 C-08）。
- **后果**：需自写 provider 的 SSE 解析（openai-compatible 一实现即覆盖多数兼容 API，解析量小可控）；换取干净的数据面、密钥零下发、可取消的流式通道（Channel + requestId + AbortHandle）。AI SDK 的流式 UI hooks 与自建 `generationStore`（stage-05）重复，不再需要。多模型交叉判断场景（stage-06/07）如需可再评估（fetch 桥 / Node sidecar）。

---

### ADR-002：生成内容落地交互 = 流式直插编辑器（模式 A）
- **日期**：2026-10-10
- **状态**：accepted
- **背景**：stage-04 已交付 `EditorController.appendChunk/flushPending` + `useChunkInjection`（撤销会话合并 `newGroupDelay=5000`、IME 排队、节流批次），专为「生成期间流式直插编辑器」设计。原 stage-05 计划却描绘「生成态 store + 预览面板 → 显式『插入到章节』」——两条路径互斥：选预览+显式插入会使 stage-04 T8 投资空转（违反 C-08）；且大计划 M1 与 overview 均为「流式插入」字面。
- **决策**：**采用模式 A（流式直插）**。`generationStore` 订阅 stage-03 `subscribeChunks` → 节流 → stage-04 `EditorController.appendChunk`；**「生成面板」仅承载状态（进度/停止/重试/错误），不设内容预览面板**。
- **备选**：模式 B（先预览再一次性插入）——否决（stage-04 T8 的撤销合并/IME 排队/节流机制闲置，投资空转；且与 M1「流式插入」措辞不符）。
- **后果**：M1「AI 生成一章并流式插入」字面兑现；创作体验连续（边生成边读边改）；生成期间编辑器零 React 重渲染由 ProseMirror 直改 DOM 保证（C-03，React Profiler 断言 render 计数=0）。停止/失败时已插入内容按「草稿」语义保留，用户可 `Ctrl+Z` 一次撤销整段。
