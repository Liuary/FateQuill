# 构建体积报告（stage-08 T6 / REV-015 兑现）

> 归属阶段：v0.3.0-stage-08（T6）。**兑现 stage-05 REV-015**：`chunk 体积 v0.3 评估 manualChunks 分包 / 扩展裁剪`。
> 实测环境：Windows / Node + pnpm / `corepack pnpm build`（Vite 8 + rolldown）；实测日期 2026-10-10。

## 一、基线（分包前）

| 产物                     | raw           | gzip      |
| ------------------------ | ------------- | --------- |
| `index-*.js`（**入口**） | 909.94 kB     | 285.97 kB |
| `window-*.js`            | 14.33 kB      | 3.49 kB   |
| `index-*.css`            | 32.96 kB      | 6.74 kB   |
| **JS 合计**              | **924.27 kB** | 289.46 kB |

- 现象：入口 chunk **> 500 kB**，`pnpm build` 报 Vite 体积警告（stage-05 REV-015 登记项）。

## 二、分包后（`manualChunks` 生效）

`vite.config.ts` → `build.rollupOptions.output.manualChunks`：

| 分组            | 匹配                                               |
| --------------- | -------------------------------------------------- |
| `editor`        | `node_modules/@tiptap`、`node_modules/prosemirror` |
| `orchestration` | `src/orchestration`                                |
| `research`      | `src/features/research`                            |

实测：

| 产物                     | raw           | gzip      |
| ------------------------ | ------------- | --------- |
| `index-*.js`（**入口**） | 356.57 kB     | 111.45 kB |
| `editor-*.js`            | 466.32 kB     | 146.84 kB |
| `research-*.js`          | 66.03 kB      | 19.76 kB  |
| `orchestration-*.js`     | 20.45 kB      | 8.90 kB   |
| `window-*.js`            | 14.34 kB      | 3.49 kB   |
| `rolldown-runtime-*.js`  | 0.58 kB       | 0.36 kB   |
| `index-*.css`            | 32.96 kB      | 6.74 kB   |
| **JS 合计**              | **924.29 kB** | 290.80 kB |

## 三、收益判定

| 指标                   | 基线      | 分包后                         | Δ                          |
| ---------------------- | --------- | ------------------------------ | -------------------------- |
| **入口 chunk（raw）**  | 909.94 kB | 356.57 kB                      | **−553.37 kB（−60.8%）**   |
| **入口 chunk（gzip）** | 285.97 kB | 111.45 kB                      | **−174.52 kB（−61.0%）**   |
| JS 总增量              | 924.27 kB | 924.29 kB                      | **+0.02 kB（≈0，可忽略）** |
| `> 500 kB` 体积警告    | 有        | **无**（最大 chunk 466.32 kB） | 消除                       |

**判定：采纳**（保留 `manualChunks` 配置）。

理由：

1. 入口 chunk 显著下降（raw −60.8% / gzip −61.0%），**首屏解析成本大幅降低**；
2. **总增量 ≈ 0**（+0.02 kB），无重复打包膨胀；
3. 附带**消除** `> 500 kB` 构建警告（REV-015 登记项闭环）；
4. 分包按域（editor / orchestration / research）切分，加载边界与功能域一致，利于后续按需加载演进。

> 后续可选优化（非本阶段）：`editor`（466 kB，Tiptap/ProseMirror）仍偏大，可评估 StarterKit → 精选扩展裁剪；留待 v0.3+ 按需评估，**不单独立任务**。

## 四、v0.2 人工协验遗留跟踪（BLOCKED，保持跟踪）

> 来源：`.openfeel/dev/v0.2-summary.md` §四。以下 4 项为**真实环境人工协验**（AI 不可替代），**保持 BLOCKED 跟踪**、**不阻塞 stage-08**；闭合后 **M2 正式达成**。

| #   | 项目                                          | 状态        | 执行主体           | 入口                                                      |
| --- | --------------------------------------------- | ----------- | ------------------ | --------------------------------------------------------- |
| 1   | 真实 Key E2E（生成全链路）                    | **BLOCKED** | 用户 / feel-tester | `docs/smoke-check-v0.1.md`（M1–M10）                      |
| 2   | 真机 WebView 冒烟（审查 + 研究流程）          | **BLOCKED** | 用户 / feel-tester | `docs/smoke-check-v0.2.md`（R1–R10 / S1–S5）              |
| 3   | T6 实验回填（skill 注入前后度量）             | **BLOCKED** | 用户 / feel-tester | `src/features/research/experiments/report.md`（数据状态） |
| 4   | 编辑器 perf 人工实测（P95 / 实例数 / 堆增幅） | **BLOCKED** | 用户 / feel-tester | `src/features/editor/perf/README.md`（实测记录表）        |

- **口径**：**不伪造数据**；BLOCKED 项以「待回填 + 所需步骤」登记，闭合后随对应检查单更新数据状态。
- stage-08 新增的推演流程（推演/对比/采纳）同样需真机协验，已并入 #2 检查单的同批人工操作范畴（后续可在 v0.3 冒烟检查单扩展）。

## 六、易经卦象数据体积（stage-09 T6 补测）

> 口径同 §二（`corepack pnpm build`，2026-10-10 实测）。卦象数据为 **TS 静态常量**（64 卦白文 + 384 爻辞）+
> 纯函数模块，**无新增依赖**；随分包配置落入 `orchestration` 分组。

| 产物                     | stage-08 T6（分包后） | stage-09（含卦象） | Δ                        |
| ------------------------ | --------------------- | ------------------ | ------------------------ |
| `index-*.js`（**入口**） | 356.57 kB             | 365.25 kB          | +8.68 kB                 |
| `orchestration-*.js`     | 20.45 kB              | 50.81 kB           | +30.36 kB                |
| `research-*.js`          | 66.03 kB              | 66.03 kB           | 0                        |
| `editor-*.js`            | 466.32 kB             | 466.32 kB          | 0                        |
| `window-*.js`            | 14.34 kB              | 14.34 kB           | 0                        |
| `rolldown-runtime-*.js`  | 0.58 kB               | 0.58 kB            | 0                        |
| `index-*.css`            | 32.96 kB              | 33.16 kB           | +0.20 kB                 |
| **JS 合计**              | **924.29 kB**         | **963.33 kB**      | **+39.04 kB（≈ +4.2%）** |
| **JS 合计（gzip）**      | **290.80 kB**         | **304.78 kB**      | **+13.98 kB**            |

**结论：可接受**——六十四卦白文（64 卦辞 + 384 爻辞）与其上纯函数合计约 **+39 kB（raw）/ +14 kB（gzip）**，
无新增第三方依赖；`> 500 kB` 体积警告仍**不复现**（最大 chunk 仍为 `editor` 466.32 kB）。

> 说明：`orchestration` 分组增量（+30.36 kB）主要来自 `src/data/iching/hexagrams.ts` 白文常量；如需进一步压缩，可评估**按需动态导入**（仅开启易经时加载），留待 v0.3+ 评估、**不单独立任务**。

## 七、多声部对话与角色档案体积（stage-10 T7 补测）

> 口径同 §二（`corepack pnpm build` = `tsc && vite build`，2026-10-10 实测）。本阶段为**纯 TS/TSX 增量**
> （对话编排 + 角色/对话 UI + i18n 两命名空间），**零新增依赖、无迁移、无 IPC 增量**。

| 产物                     | stage-09      | stage-10（含对话/角色） | Δ                        |
| ------------------------ | ------------- | ----------------------- | ------------------------ |
| `index-*.js`（**入口**） | 365.25 kB     | 382.97 kB               | +17.72 kB                |
| `orchestration-*.js`     | 50.81 kB      | 55.26 kB                | +4.45 kB                 |
| `research-*.js`          | 66.03 kB      | 66.03 kB                | 0                        |
| `editor-*.js`            | 466.32 kB     | 466.32 kB               | 0                        |
| `window-*.js`            | 14.34 kB      | 14.34 kB                | 0                        |
| `rolldown-runtime-*.js`  | 0.58 kB       | 0.58 kB                 | 0                        |
| `index-*.css`            | 33.16 kB      | 33.19 kB                | +0.03 kB                 |
| **JS 合计**              | **963.33 kB** | **985.50 kB**           | **+22.17 kB（≈ +2.3%）** |
| **JS 合计（gzip）**      | **304.78 kB** | **310.38 kB**           | **+5.60 kB**             |

**结论：可接受**——本阶段 JS 增量约 **+22 kB（raw）/ +5.6 kB（gzip）**（入口 +17.72 kB 为对话/角色面板与
`review-bridge` 接线；`orchestration` +4.45 kB 为 `dialogue/` 契约与编排）；**零新增第三方依赖**；
`> 500 kB` 体积警告仍**不复现**（最大 chunk 仍为 `editor` 466.32 kB）。

> 说明：入口增量含**可选**的台词评审接线（复用 stage-06 评估器，未引入新依赖）；如需进一步压缩，可评估
> 对话面板**按需懒加载**（仅切到「对话」tab 时加载），留待 v0.4+ 评估、**不单独立任务**。
