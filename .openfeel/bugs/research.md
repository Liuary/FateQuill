# Bug 追踪：research（去 AI 味研究）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/research/`。

## closed

### BUG-001：素材库缺少浏览/检索/导出/删除 UI，DoD「可检索、可导出」在界面层不可达（T4）（medium）
- **阶段**：v0.2.0-stage-07（T4 收口 / BUG-001）｜**关联**：DoD 第 2 条（plan L84/L77）、REV-018 同类根因
- **现象**：取证 `rg -n "materialsToJson|materialsToCsv|downloadExport" src --glob "!*.test.*"` **仅命中 `export.ts` 自身定义**（生产零调用）；`rg "material.remove"` **零命中**；`material.list` 仅被 `useSkillLibrary` 用于 skill 选材。研究台仅有 `ResearchWorkbench`/`AnnotationPanel`/`SkillLibrary`，**无素材库组件**。→ 素材入库后无法在研究台查看/检索/导出/删除。
- **根因**：T4 交付的「素材库」在 UI 层**只有「写入（标注入库）」一条路径**，缺「读取/检索/导出/删除」——功能仅在**纯函数 + IPC 命令 + Rust 层**成立，**端到端（用户可操作）不可达**。与 REV-018（`extractFlavorExcerpts` 等生产零调用致通道不可达）**属同类缺陷模式**：纯函数/契约测试全绿掩盖「功能无 UI 入口」。
- **影响**：**DoD 第 2 条判「未达成」**（数据层就绪、界面不可达）；三采集通道/迁移 v4 幂等/skill 归纳与引用/回注注入均不受影响。
- **修复**（commit `9ad8693`）：新增 `src/features/research/{useMaterialLibrary.ts,MaterialLibrary.tsx}` 并挂载 `ResearchWorkbench`——**列表浏览**（来源模型/引文/理由/标签/通道/状态 6 字段）+ **检索**（status / sourceType / query → `material.list`，复用 `list_materials`）+ **导出**（`materialsToJson`/`materialsToCsv`/`downloadExport`，JSON/CSV，默认仅本地）+ **删除**（`material.remove`；`FK_VIOLATION` → `delete-referenced` 拒绝提示，其余 → `delete-failed`）。**未改 Rust/迁移/IPC**。i18n `research` 补 13 键（zh/en）。
- **验收**：openfeel-reviewer 修复复审 + openfeel-feel-tester **独立复核（不轻信声明）**——复现步骤全部转绿（`rg` 生产调用**非零**：导出三函数命中 `MaterialLibrary.tsx`、`material.remove`/`material.list` 命中 `useMaterialLibrary.ts`）；读源码确认四能力真实、错误判定链路真实（`invokeCommand` catch 中 `parseIpcError` 构造 `IpcError` 实例，`instanceof IpcError && code===FkViolation` 成立）；门禁 `pnpm test` **64 files/295 passed**、`cargo test` **52 passed**、lint 0 error、build OK。状态 **closed**（2026-10-10 03:45），DoD 第 2 条由未达成 → **完整达成**。
- **经验**：**「功能内置但无入口」缺陷由「测试通过」掩盖**——凡「契约先行、UI 后接」的交付，收口**必须**含**生产调用非零的 rg 断言**（`--glob "!*.test.*"` 排除夹具）+ 真实链路可达性测试；审查/验收对纯函数型交付须追问「谁调用它」（详见 `kb/patterns.md`「UI 接线验证」、`kb/troubleshooting.md`「功能无入口模式」）。

## open / fixing / resolved

- （无）
