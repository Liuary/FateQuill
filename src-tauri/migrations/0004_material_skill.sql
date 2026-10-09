-- v0.2.0-stage-07（T4）：素材库（material）与经验条目（skill_entry）
-- 注（REV-016①）：`excerpt` 以 material.excerpt 列为**唯一权威**；`position_json` 仅存上下文
--     `{contextBefore?, contextAfter?}`（不再单列 context_before/context_after，避免冗余存储）
CREATE TABLE IF NOT EXISTS material (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_model TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL,
  position_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  chapter_id INTEGER REFERENCES chapter(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','confirmed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_material_source_type ON material(source_type);
CREATE INDEX IF NOT EXISTS idx_material_status ON material(status);

-- 经验条目（skill 载体 = DB；素材→skill 以 id 引用；CRUD 归 stage-07 T5）
CREATE TABLE IF NOT EXISTS skill_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  examples_json TEXT NOT NULL DEFAULT '[]',
  source_material_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
