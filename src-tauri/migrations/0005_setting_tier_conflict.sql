-- v0.5.0-stage-11（T1）：设定分级（tier，四级）与一致性冲突记录（conflict_record）
-- 注：`tier` 与既有 `kind` **正交**（`kind`=内容类型，`tier`=叙事层级；不扩 `kind` 值域）。
-- 注：`ADD COLUMN` 携带列级 `CHECK`（SQLite 允许；禁用的是 PRIMARY KEY/UNIQUE 与无默认的 NOT NULL）。
ALTER TABLE setting_card ADD COLUMN tier TEXT NOT NULL DEFAULT 'short'
  CHECK (tier IN ('main','dark','short','temp'));

CREATE INDEX IF NOT EXISTS idx_setting_card_tier ON setting_card(tier);

-- 一致性冲突记录：设定库内冲突（设定 vs 设定）；处置状态与动作留痕
CREATE TABLE IF NOT EXISTS conflict_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  novel_id INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
  a_id INTEGER NOT NULL REFERENCES setting_card(id) ON DELETE CASCADE,
  b_id INTEGER NOT NULL REFERENCES setting_card(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conflict_record_novel ON conflict_record(novel_id);
CREATE INDEX IF NOT EXISTS idx_conflict_record_status ON conflict_record(status);
