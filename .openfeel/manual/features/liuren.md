# 模块手册：大六壬（features/liuren）

## 职责

FateQuill 的**大六壬课体引导**域（**可选可关**）：以**公有领域古籍白文**静态数据为基座，
**手动指定月将 + 时辰 + 日干支**起课（**不引历法库**，方案 b），产出**课体引导**（四课 / 三传 / 天盘 / 天将 / 课体名）
并入推演与生成 prompt——与**易经卦象并列可选**、可叠加。建立于 **v0.6.0-stage-12**。

分层：数据与校验在 `src/data/liuren/`（**只读静态 + 手写守卫**）；算法与引导在 `src/orchestration/liuren/`（**纯函数**）；
开关与起课结果在 `src/store/explorationStore.ts`（**状态单源**）；UI 在 `src/features/exploration/`；**无新增 IPC**（前端静态数据 + 纯函数）。

## 目录结构 / 关键文件

```
src/data/liuren/           # 只读静态数据 + 手写校验（零依赖）
├── types.ts               # LiurenGeneral / LiurenPalace / LiurenLessonSlot / LiurenTransmissionSlot / LiurenPattern
├── ganzhi.ts              # 十天干 / 十二地支 / 六十甲子 JIAZI_60 / isJiazi / **十干寄宫** STEM_HOME_PALACE / 支序与相冲
├── generals.ts            # LIUREN_GENERALS（**12 天将**顺布序 + 六吉六凶 + 一句话基础表述）
├── palaces.ts             # LIUREN_PALACES（**12 宫** = 十二支 + 月将名 + 五行）
├── lessons.ts             # 四课课位 / 三传位 / **九宗门课体**（名 + 取用规则 + 简述）
├── validate.ts            # validateLiuren（**手写守卫**：12 / 12 / 4 / 3 / 9 / 60 / 十干寄宫）
└── index.ts               # LIUREN_DATA_VERSION = "1.0.0" + LIUREN_DATA

src/orchestration/liuren/  # 纯函数（provider 无关、无 IO）
├── types.ts               # LiurenLesson / LiurenTransmission / LiurenPatternResult / LiurenChart / CastLiurenResult
├── cast.ts                # castLiuren（月将加时 → 四课 → 贼克取用 → 三传 → **天将**；非法输入**早返回**）
├── guide.ts               # buildLiurenCard / renderLiurenText（引导卡与注入文本）
└── index.ts

src/features/exploration/
├── LiurenPanel.tsx        # 月将 / 时辰 / 日干支（60 甲子）下拉 + 起课 + 课体展示（`liuren-panel`）
└── useLiurenEnabled.ts    # 开关 **store 薄封装**（`{ enabled, setEnabled }`，无本地 useState）
```

## 核心 API / 约定

- **`castLiuren({ monthGeneral, hourBranch, dayGanzhi })`** → `CastLiurenResult`：三要素**皆手动指定**；
  `dayGanzhi` **必填**（**REV-006 定稿**，四课以日干支为据）且校验为六十甲子之一；非法 → `{ ok:false, error }`（**不抛穿**，错误信息指出字段）。
  盘面口径：**月将加时顺布** → 四课（一课取日干**寄宫支**上神，二/四课取前课上神之上神，三课取日支上神）→
  取用（**先判天地盘特例**：月将 = 时辰 → `伏吟课`；相冲 → `返吟课`；再**贼克法**：下贼上优先，多则取比日干者，无贼取克，俱无 → `昴星课`）→
  三传（初 = 发用；中/末 = 前传之上神）→ **天将**（天乙贵人按**昼/夜贵**起宫，落 `亥..辰` **顺布**、`巳..戌` **逆布**）。
- **`buildLiurenCard(chart)` / `renderLiurenText(chart)`**：引导卡（课体 / 四课 / 三传 / 天盘 / 天将）与注入文本；
  文本固定声明「**仅为叙事参考，不得违背用户设定约束**」。
- **开关**：`useLiurenEnabled()` → `{ enabled, setEnabled }`（**store 单源**，`localStorage['fatequill.liuren.enabled']`，**缺省关闭**）；
  起课结果落 `explorationStore.liurenChart`（跨组件共享，供 `useExploration` 装配 `liurenGuide`）。
- **注入**：`buildExplorationOptions.liurenGuide?` 与 `buildChapterGenerationOptions.liurenGuide?` —— **可选参数**，
  与 `hexagramGuide?` **并列可选、可叠加**；**缺省 / 空白 → 输出与基线逐字段一致（零副作用）**。
- **简化口径（明示，不夸大）**：`涉害 / 遥克 / 别责 / 八专` **仅作课体名登记**，本实现不据此细分取用；本域**不断验**（课体引导，非断卦）。
- **零新增依赖 / 无迁移 / 无 IPC**：数据与算法**零第三方依赖**（无历法库、无校验库），**无新增 Rust 命令**。

## 关联文档

- 数据口径与校验规则：`docs/liuren-data.md`（五节：来源与许可 / 校对口径 / 校验规则 / **简化口径** / 体积与版本）。
- 范式来源：`.openfeel/manual/features/iching.md`（stage-09 易经「可选可关 + 静态数据 + 引导契约」范式）。
- 推演链：`.openfeel/manual/features/exploration.md`（`hexagramGuide?` 并列注入）；生成装配：`.openfeel/manual/features/generation.md`。
- 落点：`docs/structure.md` §19、§21（开关矩阵）。
