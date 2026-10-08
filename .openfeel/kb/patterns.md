# 代码模式

> 记录项目约定、代码模式与最佳实践。`[+]` 启用 / `[-]` 禁用。

## [+] ESM 写法约定：禁止 `__dirname` (2026-10-08)

`package.json` 为 `"type": "module"`，`vite.config.ts` 等 ESM 环境**不得**使用 `__dirname`：

```ts
import { fileURLToPath, URL } from "node:url";
resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }
```

- 使用 `path.resolve(__dirname, "./src")` 会触发 `ReferenceError: __dirname is not defined`，导致 `pnpm build` 失败。
- 该坑曾在 op-002 与 op-003 的别名写法上出现矛盾（REV-010），统一为 Vite 官方 ESM 写法。

## [+] `@/*` 路径别名双端一致 (2026-10-08)

- `tsconfig.json`：`"paths": { "@/*": ["./src/*"] }`；`vite.config.ts`：`resolve.alias["@"]` 指向 `src`。两端必须一致。
- **TS 6 下不使用 `baseUrl`**：TS 6.0.3 设置 `baseUrl` 触发 TS5101 弃用报错，仅保留 `paths` 即可正常解析别名（现代 TS 写法）。
- 空目录以 `.gitkeep` 占位保证入 Git。

## [+] i18n 命名空间约定 (2026-10-08)

- **资源布局**：`src/locales/{zh-CN,en}/{namespace}.json`；初始命名空间 `common` / `editor` / `settings`。
- **初始化**：`src/app/i18n.ts`（app 装配层）；`defaultNS = common`；`fallbackLng = zh-CN`（英文缺失自动回退中文）；`supportedLngs = ["zh-CN", "en"]`。
- **持久化与同步**：localStorage key `fatequill.lang`；init 后**立即**同步 `document.documentElement.lang`（防首帧静态 lang 与实际语言不一致，REV-014③），切换语言时同步更新。
- **键命名**：camelCase，按语义分组（如 `common.actions.save`）。
- **新增文案**：须同时提供 zh-CN 与 en；**创作向内容不翻译**（C-11）。约定文档 `docs/i18n.md`。

## [+] 提交消息规范 `<type>(scope): <desc> (T#)` (2026-10-08)

- 每个 op 完成后**必须提交**，格式如 `feat(ui): add Tailwind v4 and shadcn/ui setup (T2)`，消息尾部标注任务编号。
- 目的：保证阶段**按 op 独立可回滚**（约束 C-09），且 op-009 推送时远程代码完整（否则 CI 上 test/build 必挂，REV-009）。
- 推送前校验：`git status --porcelain` 输出为空（全部变更已提交）方可 push。

## [+] 仓储接口 ↔ IPC 命令 1:1 对齐约定 (2026-10-09)

- 每个实体的仓储接口方法集与 Rust 命令**一一对应**（每实体 5 个）：`list → list_*`、`get → get_*`、`create → create_*`、`update → update_*`、`remove → delete_*`；**不得缺 `get`**（即使 UI 暂未用，也保持对称，避免命令与接口漂移）。
- 命令名一律 `snake_case`；前端 `invoke(cmd, { camelCase })` 由 Tauri 自动映射到 Rust `snake_case` 参数。
- 新增/变更命令时须**同步更新** `docs/ipc.md` 命令清单（含计数），避免「命令已注册但契约文档过时」（stage-02 REV-013 教训）。
- 接口层（`src/domain/repositories/`）仅依赖领域模型，实现层（`src/ipc/repositories/`）持有 `*Row`（snake_case）与 `toModel` 映射函数。

## [+] 两阶段 order_index 重排模式 (2026-10-09)

- **问题**：`UNIQUE(volume_id, order_index)` 约束下，逐条 `UPDATE order_index` 做换序/移动会**中途撞唯一约束**（新值恰被尚未移走的旧行占用）。
- **模式**：重排在事务内分两阶段——① 先把待重排行 `order_index` 统一置为**唯一负值**（如 `-1 - id`）暂避冲突；② 再按目标顺序落定 `0..n-1`。移动章到目标卷时先把该章置负值，再重排源卷与目标卷。
- `reorder_volumes` / `reorder_chapters` / `move_chapter` 均走此模式；删除（章/卷）后在同一事务内紧凑化同父级顺序，保持「连续唯一（从 0 起）」不变量。

## [+] word_count 近似值约定 (2026-10-09)

- **落点**：`word_count` 由 **Rust 侧写入时统一计算回填**（前端不做双份逻辑），按 `content_format` 分支：`html` → 去标签 + 常用实体解码；`tiptap-json` → 遍历 `text` 节点；`plaintext` → 直接计数。
- **单位**：**非空白字符数**（面向中文「字数」；DoD 的「3000 字」即 3000 个非空白字符）。
- **为近似值（显式声明局限）**：`html` 分支为简易状态机去标签 + 常用实体解码（`&nbsp;`→0 字），未处理属性值内 `>`、`<script>/<style>` 文本与未知实体。stage-04/05 **不得把 `word_count` 当精确指标消费**；需精确字数时引入 HTML 解析器，或以 `tiptap-json` 文本节点遍历为准。
