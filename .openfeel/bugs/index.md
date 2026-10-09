# Bug 追踪索引（公共域）

> 存放各模块 Bug 关闭后的核心结论摘要与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/{module}/`。

## 状态统计

- **open 0 ｜ fixing 0 ｜ resolved 0 ｜ closed 2**

## 按模块

### v0.1.0-stage-01（工程脚手架与工程化基础设施）@openfeel-feel-tester

- **无 Bug**。正式测试验收 11/11 DoD、6/6 门禁全部通过，0 新增缺陷。
- 测试发现项均已被 openfeel-reviewer 在代码审查阶段登记为 REV-016~019（非新增，不重复提交）。
- 验收报告：`.openfeel/tmp/stage-01-acceptance.md`

### v0.1.0-stage-03（AI 编排引擎骨架与模型配置）@openfeel-feel-tester

- **2 个 low Bug，均已闭环**（修复 commit `fa1c8a2`，验收人 openfeel-feel-tester）；
  验收结论 DoD 10/10、门禁 6/6；`cargo test` 41/41（零告警）、Vitest 63/63。
- [`orchestration.md`](orchestration.md)：**BUG-001** — 中继测试模块 `MemSink::events()` 未使用（dead_code 告警）→ 删除方法。
- [`persistence.md`](persistence.md)：**BUG-002** — 「Key 不落库」哨兵断言恒真（不可证伪）→ 改为列集合精确断言 + 负向 INSERT 拒绝断言。
- 验收报告：`.openfeel/tmp/stage-03-acceptance.md`
