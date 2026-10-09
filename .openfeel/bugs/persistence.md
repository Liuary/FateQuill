# Bug 追踪：persistence（持久化与密钥）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/persistence/`。

## closed

### BUG-002：「Key 不落库」哨兵断言恒真（vacuous），验收证据无效（low）
- **阶段**：v0.1.0-stage-03（op-005）
- **根因**：`model_config_not_persist_key` 测试仅 `create(...)` 写入一条**不含 Key** 的配置，再断言库文件不含 `SENTINEL`——`SENTINEL` 从未进入写入路径，断言恒为真、无法证伪。
- **影响**：结构上「Key 不落库」仍成立（`model_config` 表无 key 列 + CRUD 无 key 入参，Key 仅在 OS 密钥链）；影响面为**验收证据质量**（DoD 第 6 条缺有效证据）。
- **修复**：重写测试（commit fa1c8a2）——① `pragma_table_info` 列集合**精确等于**预期 9 列（新增任意列即失败）；② **可证伪负向断言**：直接 `INSERT ... (…, api_key)` 应被拒绝。已实测可证伪（临时注入 `api_key` 列 → 用例 FAILED，还原后通过）。
- **经验**：安全性质断言必须**可证伪**（构造会触发失败的输入），恒真断言不构成证据。

## open / fixing / resolved

- （无）
