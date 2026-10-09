# Bug 追踪：build（构建）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/build/`。

## closed

### BUG-001：生产构建 chunk 体积登记值（311KB / gzip 97KB）与实际严重不符（low）
- **阶段**：v0.1.0-stage-05（T6 / BUG-001）
- **现象**：登记文档记入口 chunk **311KB / gzip 97KB**，但实测 stage-05 HEAD 为 `dist/assets/index-*.js` **850.15 kB │ gzip 267.65 kB**；stage-04 收口支点独立 worktree 实测 ~835KB / gzip ~263KB（依赖锁定未变）。gzip 比（≈3.2）一致 → 同一指标口径下数值错误（311 疑似早期误记，被 stage-05 op-001「对齐」时原样沿用）。
- **影响**：`kb/troubleshooting.md`、`manual/features/editor.md`、`code_review`（stage-04 + index）四处同错；会使 REV-015 登记失去观测意义、误导 v0.2 `manualChunks` 分包收益判断。**无功能影响、不阻断 M1 闭环**（构建仅 >500KB 警告、EXIT 0）。
- **修复**（commit `e3a9e5a`）：更正**活文档**——`kb/troubleshooting.md`（标题 + 现象）与 `manual/features/editor.md` 的「311KB / gzip 97KB」→「**850KB / gzip 268KB（2026-10-10 实测）**」；`code_review/index.md`、`code_review/v0.1.0-stage-04.md` 为历史评审留痕，**不改动以保留审计轨迹**。
- **验收**：openfeel-feel-tester 独立复核——实测 `pnpm build`（850.15 kB │ gzip 267.65 kB）与更正后文档一致；`rg "850|268"` 双命中、活文档「311」残留清零；历史记录保留被验收接受（审计轨迹不可变）。状态 **closed**。
- **经验**：登记实测值时须**标注测量日期/口径**并定期复测；历史评审记录不可篡改（活文档更正、留痕保留）；`manualChunks` 等优化评估应基于可复现的当前实测基线。

## open / fixing / resolved

- （无）
