-- SQLite 外键默认关闭；显式声明（双保险）。
-- 注：PRAGMA 在事务内为 no-op，运行时另依赖 sqlx 默认 foreign_keys=true（见下）。
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS novel (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS volume (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  UNIQUE (novel_id, order_index)
);
CREATE TABLE IF NOT EXISTS chapter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_id INTEGER NOT NULL REFERENCES volume(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_format TEXT NOT NULL DEFAULT 'html',
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','archived')),
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (volume_id, order_index)
);
CREATE TABLE IF NOT EXISTS setting_card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS character (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  profile TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_volume_novel ON volume(novel_id);
CREATE INDEX IF NOT EXISTS idx_chapter_volume ON chapter(volume_id);
CREATE INDEX IF NOT EXISTS idx_setting_card_novel ON setting_card(novel_id);
CREATE INDEX IF NOT EXISTS idx_character_novel ON character(novel_id);
