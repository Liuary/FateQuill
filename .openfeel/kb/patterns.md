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
