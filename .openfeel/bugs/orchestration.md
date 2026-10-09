# Bug 追踪：orchestration（AI 编排引擎）

> 模块 Bug 关闭后的核心结论与根因分析。详细报告、复现步骤与验收详情见私域 `.openfeel/users/{username}/bugs/orchestration/`。

## closed

### BUG-001：Rust SSE 中继测试模块遗留未使用方法，`cargo test` 产生 dead_code 告警（low）
- **阶段**：v0.1.0-stage-03（op-003 引入）
- **根因**：`src-tauri/src/stream.rs` 测试模块 `MemSink::events()` 定义后未被任何断言调用（其余 `chunks()` / `last_error_code()` / `is_done()` 均被使用）。
- **影响**：仅 `#[cfg(test)]` 编译告警，`cargo check`（lib）无该告警，不影响运行期；退出码仍 0。
- **修复**：删除未使用方法 `MemSink::events()`（commit fa1c8a2）；复核 `cargo test` 41/41、**零告警**。
- **经验**：与 stage-02 REV-014 同类代码卫生——测试辅助方法应随用随加，避免 dead_code 稀释真实告警可见性。

## open / fixing / resolved

- （无）
