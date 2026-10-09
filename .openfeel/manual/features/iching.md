# 模块手册：易经卦象系统（features/iching）

## 职责

FateQuill 的**易经卦象系统**：**六十四卦只读数据**（公有领域《周易》白文）+ **起卦**（随机/手动）+
**朱熹变爻推导** + **卦象引导卡**（剧情/宿命映射）+ **角色宿命卡写入设定卡**；作为推演的
**可选辅助**（**缺省关闭**、**零副作用**），**不覆盖设定卡硬约束**。建立于 **v0.3.0-stage-09**。

分层：数据在 `src/data/iching/`；纯函数在 `src/orchestration/iching/`；UI 与开关在 `src/features/exploration/`；
**无新增 IPC**（宿命卡经既有 `create_setting_card` 落库）。

## 目录结构 / 关键文件

```
src/data/iching/                 # 只读静态数据 + 手写校验
├── types.ts                     # LineState / Trigram / Hexagram
├── trigrams.ts                  # 八卦（binary 3 位自下而上）
├── hexagrams.ts                 # 64 卦白文（ICHING_DATA_VERSION）
└── validate.ts                  # validateIChing（六条规则；**无第三方校验库**）

src/orchestration/iching/        # 纯函数（无 IO）
├── types.ts                     # ZhuXiReading / Casting
├── derive.ts                    # deriveHexagram / zhuXiReading / readingVerses
├── random.ts                    # castRandom / createSeededRng(mulberry32) / castManual
├── guide.ts                     # buildGuideCard / renderGuideText
└── fate.ts                      # buildFateCard

src/features/exploration/        # UI 与开关（复用推演 tab）
├── IChingPanel.tsx              # 随机/手动起卦 + 本卦/之卦/变爻 + 朱熹解读（经文原样）
├── FatePanel.tsx                # 选目标（角色/设定卡）→ 宿命卡 → 写入设定卡（kind="fate"）
└── useIChingEnabled.ts          # 可选开关（localStorage，缺省关闭）
```

## 核心 API / 约定

- **数据**：64 卦（King Wen 1~64，`binary` 6 位**自下而上**，`upper`/`lower` 为八卦名）+ 384 爻辞（**不含**乾用九/坤用六）；六条手写校验（① 64 ② 384 ③ 名唯一 ④ 8×8 ⑤ 卦序连续 ⑥ binary↔卦名自洽）。来源/许可/校对口径见 `docs/iching-data.md`。
- **起卦**：随机 = 三枚铜钱法（**可注入随机源**；`createSeededRng(seed)` **种子复现**）；手动 = 指定 `binary` + 变爻下标；**时间起卦（农历/干支）v0.3 不呈现**（不引入历法依赖）。
- **朱熹七情形**（`zhuXiReading`）：0 本卦卦辞 / 1 本卦变爻辞 / 2 本卦两变爻（**上爻为主**）/ 3 本卦与之卦卦辞 / 4 之卦两不变爻（**下爻为主**）/ 5 之卦不变爻辞 / 6 之卦卦辞；含「变爻集合 = 两卦差异位」一致性守卫。
- **引导卡（`buildGuideCard`）**：`{ hexagramName, judgmentDigest, changingLineReadings, plotHints, fateHints }`（**确定性**；经文**不译**）；`renderGuideText` 产出可注入 **system 段**的文本。
- **宿命卡（`buildFateCard`）**：**一次性**提示卡（不做跨章自动持续约束）；写入 **`setting_card`**（`kind="fate"`，**零迁移**；REV-008：仅**新建**单一路径）→ 此后**自然进入**下一轮注入与覆盖判据（复用 stage-08 机制，零新增逻辑）。
- **可选可关（零副作用）**：开关 `useIChingEnabled`（`localStorage['fatequill.iching.enabled']`，**缺省关闭**，不做强制前置）；**关闭时**入口不可见且 `buildGuideCard`/`renderGuideText` **零调用**；开启且已起卦 → 引导文本经 `buildExplorationOptions.hexagramGuide?` 并入 system（**缺省向后兼容**）。
- **不覆盖设定卡硬约束**：卦象引导**不进入 `converge` 的设定卡覆盖判据**（`settingCardIds` 不变；设定卡约束最高优先）。
- **i18n**：`iching` 命名空间（UI 文案双语；**卦辞/爻辞经文原样展示、不翻译**）。
- **范围排除**：**大六壬**等其它术数**显式排除**，**留 stage-12** 评估（本阶段仅六十四卦）。

## 关联文档

- 数据来源/许可/校对：`docs/iching-data.md`。
- 落点与体积：`docs/structure.md` §16、`docs/build-size-report.md` §六、`docs/ipc.md`（无新增命令）。
- 推演装配：`.openfeel/manual/features/exploration.md`（`hexagramGuide?`）；引擎：`.openfeel/manual/orchestration/engine.md`。
- 遗留登记：`.openfeel/kb/troubleshooting.md`（stage-08 REV-009/010、v0.2 BLOCKED 跟踪）。
