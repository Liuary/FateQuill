# 模块手册：设定卡（features/setting-cards）

## 职责

FateQuill 的**设定卡**域：第三栏「设定卡」tab 的 CRUD 面板（列表 / 新增 / 编辑 / 删除）；持久化复用 stage-02 设定卡仓储；设定卡作为**生成上下文**（`buildChapterGenerationOptions` → `ChapterSettingCard`）被引用。建立于 **v0.1.0-stage-05**。

## 目录结构 / 关键文件

```
src/features/setting-cards/
├── SettingCardsPanel.tsx  # 列表 + 表单 + 删除 + 空态
├── SettingCardForm.tsx    # 新增/编辑表单（title / content / kind）
└── useSettingCards.ts     # 按作品加载 + 增删改（经 repositories.settingCard）
```

- 实体：`SettingCard { id, novelId, title, content, kind, createdAt }`（`src/domain/models/setting-card.ts`）。
- 第三栏宿主：`src/features/editor/WorkspaceLayout.tsx`（tab：生成 / 设定卡）。

## 核心 API / 约定

- **持久化复用**：`@/ipc/repositories` 的 `settingCard.{listByNovel,get,create,update,remove}` → 命令 `list_setting_cards`/`get_setting_card`/`create_setting_card`/`update_setting_card`/`delete_setting_card`（stage-02）；**不新增 IPC 命令**。
- **与生成共用仓储**：`buildChapterGenerationOptions`（op-002）同样经 `repositories.settingCard.listByNovel` 读取设定卡作为上下文。
- **i18n**：`settingCards` 命名空间（zh-CN / en）。

## 关联文档

- 持久化：`.openfeel/manual/core/domain-storage.md`。
- 生成上下文：`.openfeel/manual/features/generation.md`、`docs/structure.md` §12。
- 目录/边界：`docs/structure.md`。
