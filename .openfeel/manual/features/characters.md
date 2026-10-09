# 模块手册：角色档案（features/characters）

## 职责

FateQuill 的**角色档案域**：在既有 `Character` 模型上补齐「**可复用角色定义**」——身份 / 性格 / 说话风格
/ 口癖 / 关系等**结构化档案**（`profile` JSON 契约），供多声部对话（`dialogue`）与后续写作链路复用。
**复用既有 `Character` 仓储与命令**（`list/get/create/update/delete_character`），**无新增 IPC、无迁移**。
建立于 **v0.4.0-stage-10**。

分层：契约归一在 `src/orchestration/dialogue/profile.ts`（与对话共享，**单一来源**）；UI 在 `src/features/characters/`。

## 目录结构 / 关键文件

```
src/orchestration/dialogue/profile.ts  # profile 契约：PROFILE_TEXT_KEYS / normalizeProfile / toProfileRecord
src/features/characters/
├── CharactersPanel.tsx                # 角色列表 + 新建/编辑/删除（`data-testid="characters-panel"`）
├── CharacterForm.tsx                  # 表单：姓名 + 档案字段（身份/性格/说话风格/口癖/关系）
└── useCharacters.ts                   # 加载/增删改（经 `repositories.character.*`）
```

## 核心 API / 约定

- **`profile` 契约（`profile.ts`）**：
  - `PROFILE_TEXT_KEYS`：档案的**文本字段白名单**（`identity` / `personality` / `speechStyle` / `verbalTics` / `relationships`）；
  - `normalizeProfile(raw)`：把**任意 JSON**（含缺省 / 脏值）归一为**完整 `DialogueProfile`**——缺失补空串、非字符串丢弃、未知键**剔除**；`major` 支持布尔（非布尔 → `false`）；
  - `toProfileRecord(profile)`：归一结果**回写同构 JSON**（持久化用）。
- **`major` 标记**：`profile.major === true` 表示「主要角色」，供对话「**仅主要角色**」过滤（`selectParticipants`）——缺省 `false`（全部参与）。
- **存储**：档案存于既有 `character.profile`（JSON 文本列）；**不新增表、不新增迁移**。
- **边界**：角色档案仅作**素材契约**，不参与生成编排；具体编排见 `dialogue`。

## 关联文档

- 对话编排：`.openfeel/manual/features/dialogue.md`（profile 契约的消费方）。
- 领域模型与命令面：`.openfeel/manual/core/domain-storage.md`、`docs/ipc.md`（`character` 五命令，**无增量**）。
- 落点：`docs/structure.md` §17。
