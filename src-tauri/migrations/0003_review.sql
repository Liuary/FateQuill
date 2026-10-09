-- v0.2.0-stage-06（T6）：审查结果持久化
-- 每维一行：round/dimension/score/reasons_json；按 chapter_id + round 关联「该章某轮审查」
CREATE TABLE IF NOT EXISTS review_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chapter_id INTEGER NOT NULL REFERENCES chapter(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  dimension TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_review_record_chapter ON review_record(chapter_id);
