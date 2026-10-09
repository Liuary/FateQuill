# Bug 追踪：exploration（多温度推演 / 易经引导）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/exploration/`。

## closed

### BUG-001：运行时「启用易经推演」开关不生效（多实例独立 `useState` 致状态不同步）（medium）
- **阶段**：v0.3.0-stage-09（收口 / BUG-001）｜**关联**：DoD 第 4/9 条、`kb/patterns.md`「store 单例状态共享」
- **现象**：运行时点击「启用易经推演」开关后，推演仍未注入卦象引导（`buildGuideCard`/`renderGuideText` 零调用），须重启（重挂载）才生效；反向（挂载时已开、运行关闭）引导仍注入 → 开关在运行时**无法真正控制**引导注入。
- **根因**：自定义 hook `useIChingEnabled()` 在开关 UI（`ExplorationPanel`）与消费侧（`useExploration`）**各调用一次**，每次调用生成**一份独立 `useState`**——写 `localStorage` 只更新**本实例** state 且另一实例不重读 → 两处状态**互不相通**；`hexagramGuide` 恒受其中一份陈旧 state 控制。既有单测在**挂载前**预置 `localStorage`（或直接传参），两实例初始值恰好一致 → 掩盖「运行时切换」路径；契约层单测全绿。
- **修复**（commit `48ce6e8`）：把跨组件共享的开关状态**提升为 store 单例**（`explorationStore.ichingEnabled` + `setIChingEnabled` 写 store + `localStorage`）；`useIChingEnabled` 改造为 **store 薄封装**（`useExplorationStore(selector)` 读 + 动作，**保留对外 API 不变、移除本地 `useState`**）；消费侧 `useExploration` 改 **store 选择器** → store 订阅天然驱动两处**同步重渲染**（**零新增依赖**）。
- **验收**：openfeel-feel-tester **独立回归探针**——运行时切换用例（挂载关闭 `guideCalls=[]` → 运行时 `click` 开启 → 调用 + `localStorage="true"` → 运行时关闭 → 零调用 + `"false"`）复现原失败路径并验证消除；门禁 `pnpm test` **84 files/415 passed**、`cargo test` **52 passed**、lint 0 error、build OK。状态 **closed**（2026-10-10 04:47）。
- **经验**：**跨组件共享的可变状态必须单一数据源**——勿让多个组件各持一份 `useState`（持久化/存储 ≠ 状态同步）；优先复用已有 store 单例。可选/可关能力的验收须区分**缺省态**与**运行时切换态**，并对两态断言「关闭零副作用」。

## open / fixing / resolved

- （无）
