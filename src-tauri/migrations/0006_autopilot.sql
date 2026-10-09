-- v0.6.0-stage-12（T3）：全自动创作**断点续跑**（autopilot_run + autopilot_chapter）
-- 目的：无人值守流水线状态**落库可续**（对照 stage-08 会话内存局限：中断后必须可恢复）
CREATE TABLE IF NOT EXISTS autopilot_run (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','paused','completed','aborted','failed')),
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS autopilot_chapter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES autopilot_run(id) ON DELETE CASCADE,
  chapter_id INTEGER REFERENCES chapter(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','done','degraded','failed')),
  score REAL,
  degraded_reason TEXT NOT NULL DEFAULT '',
  attempt INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (run_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_autopilot_run_novel ON autopilot_run(novel_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_chapter_run ON autopilot_chapter(run_id);
