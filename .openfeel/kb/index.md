# 知识库索引

> 记录「这个项目是什么样的」与「遇到问题怎么办」。分类摘要供快速定位；条目详情见各分类文件。`[+]` 启用 / `[-]` 禁用。

## 项目快速概览

| 项 | 值 |
|----|----|
| 项目 | FateQuill（命笔）— 跨平台 AI 辅助长篇创作桌面工具 |
| 技术栈 | Tauri 2 + React 19 + Vite + TS(strict) + Tailwind v4 + shadcn/ui + i18next + pnpm |
| 源文件 | 200（`glob src/**/*.ts`；另有 `.tsx` 54） |
| Agent 数 | 9（`glob .opencode/agents/*.md`，当前项目级无 agents 目录，取全局 9） |
| 最近更新 | 2026-10-10 |

## 分类概览

| 文件 | 主题 | 条目 | 摘要 |
|------|------|:----:|------|
| [architecture.md](architecture.md) | 架构决策 | 26 | 技术栈定稿与理由；目录分层与状态隔离约定；IPC 通道约定；SQLite 选型与封装边界（单一来源迁移）；领域层三段式分层 + IPC 错误结构/统一事务入口；AI 数据面（ADR-001，Rust SSE 中继 + 前端适配器）；模型配置持久化 + 密钥链；可插拔编排引擎（Provider/Agent/Pipeline 注册表）；流式通道（Channel + requestId + AbortHandle）；编辑器分层与 editorStore 单一事实源边界；一章一实例策略；T8 增量插入接口契约；生成内容落地模式 A 流式直插（ADR-002）；generationStore 元状态边界与双 store 隔离；四维评审机制（LLM-as-judge + 合规规则引擎）；会话级版本池与加权择优；重写回路（上限 2/反馈注入/合规排除/入池不替换）；去 AI 味数据流闭环（采样→交叉→标注→素材库→skill→回注）；双资产（material/skill）模型与迁移 v4；采样（研究）vs 生成路径差异；**多温度并行推演编排（同模型多温度 + clamp + 乱序归位 + 会话内存分支）**；**克制收敛两层机制（生成期约束注入 + 产出期覆盖降权，终选权归用户）**；**采纳双路径安全网（新建下一章无损 / 替换加强制快照）**；**易经卦象系统（64 卦数据 + 朱熹变爻 + 引导卡 + 角色宿命）**；**术数引导「可选可关」设计（缺省关闭 + 运行时即时生效 + 关闭零副作用）** |
| [patterns.md](patterns.md) | 代码模式 | 38 | ESM 写法（禁 `__dirname`）；`@/*` 别名双端一致；i18n 命名空间；提交消息规范；仓储接口↔命令 1:1 对齐；两阶段 order_index 重排；word_count 近似值约定；EventSink 可测试性；SSE CRLF 状态机归一化；传输契约真实类型对齐（禁强转）；AUTH_DENYLIST 授权头丢弃；Rust codes 与前端 IpcErrorCode 同 PR 同步；切章守卫 `requestSelectChapter`；`flush → Promise<boolean>` + 章号守卫；Tiptap 撤销分组合并 `newGroupDelay`；IME 监听 `view.dom`；自动保存串行链 `chainRef`；rg 验证口径区分逻辑/数据夹具；上下文装配预算与裁剪序；提示模板版本化；生成状态机收敛；Profiler C-03 断言；评审 JSON 容错降级（extractJson + DEGRADED_SCORE）；rubric 双载体版本一致性；合规排除重写（triggerDims 三处隔离）；评审预算裁剪（单一来源复用）；引文精确交集合并（verbatim 为键 + 命中分级）；三通道 sourceType 透传（单一来源 domain）；skill 注入预算桶（≤500 字/system 拼接/向后兼容）；UI 接线验证（生产调用非零 rg 断言）；**温度 clamp + 并行乱序归位（索引槽位 + 取任务前查中止）**；**走向卡存在性校验（过滤 LLM 幻觉引用）**；**diff 精确集合差（不做模糊对齐）**；**manualChunks 分包（Vite 8/rolldown，入口 −60%）**；**手写类型守卫做数据校验（无第三方校验库）**；**朱熹变爻纯函数 + 可注入随机源（种子复现）**；**store 单例状态共享（防多实例独立 useState 不同步）**；**装配层可选注入参数（向后兼容，缺省零影响）** |
| [troubleshooting.md](troubleshooting.md) | 排查经验 | 33 | pnpm 安装坑；Tailwind v4 CSS-first 与 shadcn preset；TS6 `baseUrl` 弃用；`resolveJsonModule` 预检；构建期依赖陷阱（shadcn/前端绑定包）；sqlx 直依赖取池；UNIQUE 重排冲突；dead_code 卫生；reqwest native-tls；keyring 4 平台后端；Channel vs emit 取消语义；迁移 v2 纪律；`react-hooks/set-state-in-effect` 规避；Tiptap 事件总线不含 composition；切章×防抖丢数据（BUG-001）；Tiptap chunk 体积警告；流式插入与撤销交互；Token 超限防护；真实 WebView perf 测量待办；LLM-as-judge 主观性缓解（rubric+温度0）；合规误判人工兜底；评审 Token 放大（4~5×）；功能无入口模式（纯函数/契约测试全绿但生产零调用）；删除引用防护（JSON 冗余引用精确判定 + 拒绝删除）；交叉判断 JSON 容错复用（extractJson + 逐模型容错）；**采纳误触致数据丢失的防范（确认门 + 无损路径 + 强制回滚点三件套）**；**「功能无 UI 入口」模式再现与防范（推演交付复验 + 上下文取值观察项）**；**多实例独立 useState 致运行时状态不同步（BUG-001 根因）**；**可选开关「关闭零副作用」的可判定验证** |
| [setup.md](setup.md) | 环境配置 | 10 | 环境前置与版本锚定；构建/测试/CI 命令；数据存储位置与重置；Rust 数据层测试（内存库/迁移幂等）；密钥链（keyring）与测试凭据清理；编辑器依赖版本表；长文性能基准 BenchPanel 用法；真机冒烟检查单用法；**v0.2 冒烟检查单用法（研究/审查流程）** |

## 最近更新

- **2026-10-10**：归档 v0.3.0-stage-09（易经卦象系统，**v0.3 收官 / 里程碑 M3 达成**），新增 architecture×2 / patterns×4 / troubleshooting×2 共 8 条（setup 无新增）；并计入 op-006 遗留登记 troubleshooting×3（T6）+ **修正 4 条既有条目标题日期格式**（括号含附加内容致解析漏收：`(2026-10-10, stage-09 T6)` / `(2026-10-10, stage-07 REV-011②)` → 规范为 `(2026-10-10)`，troubleshooting 计数 28→33）。更新 `kb/index.md`（源文件 183→200、`.tsx` 50→54 + 分类摘要 + 最近更新）。关键：**六十四卦 + 爻变建模**（公有领域经文白文 + 手写校验，**无第三方校验库**）、**朱熹变爻七情形**纯函数、起卦（随机可注入种子 / 手动）+ 时间起卦推迟、**引导卡经 `buildExplorationOptions.hexagramGuide?` 注入推演 system 段（向后兼容、缺省零影响）**、角色宿命写入设定卡（零迁移）、**可选可关（缺省关闭，运行时即时生效，关闭零副作用）**、**store 单例状态共享（BUG-001 修复）**。测试 cargo 52/52、Vitest 415/415。
- **2026-10-10**：归档 v0.3.0-stage-08（多温度并行推演引擎，v0.3 首阶段），新增 architecture×3 / patterns×4 / troubleshooting×2 共 9 条（setup 无新增）；更新 `kb/index.md`（源文件 160→183、`.tsx` 42→50 + 分类摘要 + 最近更新）。关键：**多温度并行推演**（同模型多温度 + per-provider clamp + 乱序归位 + 会话内存分支）、**克制收敛两层**（生成期约束注入 system + 产出期覆盖检查降权标注，终选权归用户）、**采纳双路径安全网**（新建下一章无损 / 替换加强制快照 + 单撤销，REV-007）、manualChunks 分包（入口 −60%）、走向卡存在性校验（防幻觉引用）。测试 cargo 52/52、Vitest 353/353。
- **2026-10-10**：归档 v0.2.0-stage-07（去 AI 味研究子系统 v1，**v0.2 收官**），新增 architecture×3 / patterns×4 / troubleshooting×3 / setup×1 共 11 条；更新 `kb/index.md`（源文件 132→160、`.tsx` 34→42 + 分类摘要 + 最近更新）。关键：去 AI 味数据流闭环（采样→交叉→标注→素材库→skill 库→回注生成）、双资产（material/skill）迁移 v4、引文精确交集合并、三通道 sourceType、skill 注入预算桶、UI 接线验证（防「功能内置无入口」复发）。
- **2026-10-10**：归档 v0.2.0-stage-06（审查流水线：剧情/世界观/合规/真人感），新增 architecture×3 / patterns×4 / troubleshooting×3 共 10 条（setup 无新增）；更新 `kb/index.md`（源文件 94→132、`.tsx` 30→34 + 分类摘要 + 最近更新）。关键：四维评审（LLM-as-judge ×3 + 合规规则引擎）、加权择优、会话级版本池、重写回路（上限 2/反馈注入/合规排除），迁移 v3 + IPC 40 命令。
- **2026-10-10**：归档 v0.1.0-stage-05（单 Agent 章节生成 + 设定卡，**v0.1 闭环终点**），新增 architecture×2 / patterns×4 / troubleshooting×3 / setup×1 共 10 条；更新 `kb/index.md`（源文件 84→94、`.tsx` 23→30 + 分类摘要 + 最近更新）；**并修正 6 条既有/新增条目标题格式**（`## [+] 标题 (日期)` 标题与日期间缺空格或日期括号含附加内容，致解析漏收）。
- **2026-10-10**：归档 v0.1.0-stage-04（编辑器基础：Tiptap 章节文档 + 大纲树），新增 architecture×3 / patterns×5 / troubleshooting×4 / setup×1 共 13 条；并补齐 stage-04 op-001 已落地的 patterns 条目（码表同 PR 同步）与 op-002 的 setup 版本表条目计数。
- **2026-10-09**：归档 v0.1.0-stage-03（AI 编排引擎骨架与模型配置），新增 architecture×2 / patterns×4 / troubleshooting×4 / setup×1 共 11 条，并修复 1 条既有条目标题格式（AI 数据面，原 `(日期, ADR-001)` 不符合解析规则致索引漏收）。
- **2026-10-09**：归档 v0.1.0-stage-02（核心领域模型与本地存储），新增 architecture×2 / patterns×3 / troubleshooting×4 / setup×1 共 10 条，并修订 1 条既有条目（shadcn 依赖卫生）。
- **2026-10-09**：初始化知识库；归档 v0.1.0-stage-01（工程脚手架与工程化基础设施），提取 architecture×3 / patterns×4 / troubleshooting×4 / setup×2 共 13 条。
