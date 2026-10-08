/** 章节状态（v0.1 值域） */
export const ChapterStatus = { Draft: "draft", Archived: "archived" } as const;
export type ChapterStatus = (typeof ChapterStatus)[keyof typeof ChapterStatus];

/** 章节正文存储格式（v1 默认 html；预留 tiptap-json） */
export const ContentFormat = {
  Html: "html",
  Plaintext: "plaintext",
  TiptapJson: "tiptap-json",
} as const;
export type ContentFormat = (typeof ContentFormat)[keyof typeof ContentFormat];
