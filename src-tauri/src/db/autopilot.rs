use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// `autopilot_run` 行（全自动一轮）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AutopilotRunRow {
    pub id: i64,
    pub novel_id: i64,
    pub status: String,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}

/// `autopilot_chapter` 行（单章断点）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AutopilotChapterRow {
    pub id: i64,
    pub run_id: i64,
    pub chapter_id: Option<i64>,
    pub order_index: i64,
    pub state: String,
    pub score: Option<f64>,
    pub degraded_reason: String,
    pub attempt: i64,
    pub updated_at: String,
}

/// 合法 run 状态（与迁移 v6 的 `CHECK` 一致）
const VALID_RUN_STATUS: [&str; 5] = ["running", "paused", "completed", "aborted", "failed"];
/// 合法章状态
const VALID_CHAPTER_STATE: [&str; 5] = ["pending", "running", "done", "degraded", "failed"];

fn validate_status(status: &str) -> Result<(), IpcError> {
    if !VALID_RUN_STATUS.contains(&status) {
        return Err(IpcError::new(codes::VALIDATION, "invalid autopilot run status"));
    }
    Ok(())
}

fn validate_state(state: &str) -> Result<(), IpcError> {
    if !VALID_CHAPTER_STATE.contains(&state) {
        return Err(IpcError::new(codes::VALIDATION, "invalid autopilot chapter state"));
    }
    Ok(())
}

const RUN_COLUMNS: &str = "id,novel_id,status,config_json,created_at,updated_at";
const CHAPTER_COLUMNS: &str =
    "id,run_id,chapter_id,order_index,state,score,degraded_reason,attempt,updated_at";

/// 按 id 取 run
pub async fn get_run(pool: &SqlitePool, id: i64) -> Result<AutopilotRunRow, IpcError> {
    let sql = format!("SELECT {RUN_COLUMNS} FROM autopilot_run WHERE id=?");
    sqlx::query_as::<_, AutopilotRunRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("autopilot_run"))
}

/// 按作品列出 run（**最新在前**）
pub async fn list_runs(pool: &SqlitePool, novel_id: i64) -> Result<Vec<AutopilotRunRow>, IpcError> {
    let sql = format!("SELECT {RUN_COLUMNS} FROM autopilot_run WHERE novel_id=? ORDER BY id DESC");
    Ok(sqlx::query_as::<_, AutopilotRunRow>(&sql)
        .bind(novel_id)
        .fetch_all(pool)
        .await?)
}

/// **upsert** run：`id` 为 `None` → 新建；`Some` → 更新状态与配置（返回行）
pub async fn save_run(
    pool: &SqlitePool,
    id: Option<i64>,
    novel_id: i64,
    status: &str,
    config_json: &str,
) -> Result<AutopilotRunRow, IpcError> {
    validate_status(status)?;
    match id {
        Some(existing) => {
            let n = sqlx::query(
                "UPDATE autopilot_run SET status=?, config_json=?, updated_at=datetime('now') WHERE id=?",
            )
            .bind(status)
            .bind(config_json)
            .bind(existing)
            .execute(pool)
            .await?
            .rows_affected();
            if n == 0 {
                return Err(IpcError::not_found("autopilot_run"));
            }
            get_run(pool, existing).await
        }
        None => {
            let created: i64 = sqlx::query_scalar(
                "INSERT INTO autopilot_run (novel_id,status,config_json) VALUES (?,?,?) RETURNING id",
            )
            .bind(novel_id)
            .bind(status)
            .bind(config_json)
            .fetch_one(pool)
            .await?;
            get_run(pool, created).await
        }
    }
}

/// 按 run 列出章断点（`order_index` 升序）
pub async fn list_chapters(
    pool: &SqlitePool,
    run_id: i64,
) -> Result<Vec<AutopilotChapterRow>, IpcError> {
    let sql = format!(
        "SELECT {CHAPTER_COLUMNS} FROM autopilot_chapter WHERE run_id=? ORDER BY order_index"
    );
    Ok(sqlx::query_as::<_, AutopilotChapterRow>(&sql)
        .bind(run_id)
        .fetch_all(pool)
        .await?)
}

/// **upsert** 章断点（键 = `run_id + order_index`）；`score` 为 `None` 时置空（未评分）
#[allow(clippy::too_many_arguments)]
pub async fn save_chapter(
    pool: &SqlitePool,
    run_id: i64,
    chapter_id: Option<i64>,
    order_index: i64,
    state: &str,
    score: Option<f64>,
    degraded_reason: &str,
    attempt: i64,
) -> Result<AutopilotChapterRow, IpcError> {
    validate_state(state)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO autopilot_chapter (run_id,chapter_id,order_index,state,score,degraded_reason,attempt)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(run_id, order_index) DO UPDATE SET
           chapter_id=excluded.chapter_id,
           state=excluded.state,
           score=excluded.score,
           degraded_reason=excluded.degraded_reason,
           attempt=excluded.attempt,
           updated_at=datetime('now')
         RETURNING id",
    )
    .bind(run_id)
    .bind(chapter_id)
    .bind(order_index)
    .bind(state)
    .bind(score)
    .bind(degraded_reason)
    .bind(attempt)
    .fetch_one(pool)
    .await?;

    let sql = format!("SELECT {CHAPTER_COLUMNS} FROM autopilot_chapter WHERE id=?");
    sqlx::query_as::<_, AutopilotChapterRow>(&sql)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(IpcError::from)
}

#[cfg(test)]
mod tests {
    use crate::db::{autopilot, novel, test_util::test_pool_migrated};
    use crate::error::codes;

    #[tokio::test]
    async fn autopilot_run_save_get_list_and_upsert() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();

        // 新建（status 缺省 running）
        let run = autopilot::save_run(&pool, None, n.id, "running", r#"{"a":1}"#)
            .await
            .unwrap();
        assert_eq!(run.status, "running");
        assert_eq!(run.config_json, r#"{"a":1}"#);

        let got = autopilot::get_run(&pool, run.id).await.unwrap();
        assert_eq!(got.id, run.id);

        // upsert：同 id 更新状态与配置（不新增行）
        let updated = autopilot::save_run(&pool, Some(run.id), n.id, "completed", r#"{"a":2}"#)
            .await
            .unwrap();
        assert_eq!(updated.status, "completed");
        assert_eq!(updated.config_json, r#"{"a":2}"#);
        assert_eq!(autopilot::list_runs(&pool, n.id).await.unwrap().len(), 1);

        // 其它作品查不到
        let other = novel::create(&pool, "N2", "").await.unwrap();
        assert!(autopilot::list_runs(&pool, other.id).await.unwrap().is_empty());

        // 非法状态 → VALIDATION；不存在 → NOT_FOUND
        let bad = autopilot::save_run(&pool, None, n.id, "bogus", "{}").await.unwrap_err();
        assert_eq!(bad.code, codes::VALIDATION);
        let missing = autopilot::save_run(&pool, Some(9999), n.id, "running", "{}")
            .await
            .unwrap_err();
        assert_eq!(missing.code, codes::NOT_FOUND);
        let missing_get = autopilot::get_run(&pool, 9999).await.unwrap_err();
        assert_eq!(missing_get.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn autopilot_chapter_upsert_by_run_and_order() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let run = autopilot::save_run(&pool, None, n.id, "running", "{}").await.unwrap();

        // 第 0 章：running → done（**同键 upsert，不新增行**）
        autopilot::save_chapter(&pool, run.id, None, 0, "running", None, "", 1)
            .await
            .unwrap();
        let done = autopilot::save_chapter(&pool, run.id, None, 0, "done", Some(82.0), "", 1)
            .await
            .unwrap();
        assert_eq!(done.state, "done");
        assert_eq!(done.score, Some(82.0));

        // 第 1 章：降级（含原因）
        autopilot::save_chapter(&pool, run.id, None, 1, "degraded", Some(41.0), "重写 2 轮未过阈", 2)
            .await
            .unwrap();

        let chapters = autopilot::list_chapters(&pool, run.id).await.unwrap();
        assert_eq!(chapters.len(), 2); // **UNIQUE(run_id,order_index) 生效**
        assert_eq!(chapters[0].order_index, 0);
        assert_eq!(chapters[0].score, Some(82.0));
        assert_eq!(chapters[1].state, "degraded");
        assert_eq!(chapters[1].degraded_reason, "重写 2 轮未过阈");
        assert_eq!(chapters[1].attempt, 2);

        // 非法 state → VALIDATION
        let bad = autopilot::save_chapter(&pool, run.id, None, 2, "bogus", None, "", 0)
            .await
            .unwrap_err();
        assert_eq!(bad.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn autopilot_cascade_on_run_and_novel_delete() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let run = autopilot::save_run(&pool, None, n.id, "running", "{}").await.unwrap();
        autopilot::save_chapter(&pool, run.id, None, 0, "done", Some(70.0), "", 0)
            .await
            .unwrap();

        // 删 novel → run/chapter 级联删除
        novel::delete(&pool, n.id).await.unwrap();
        assert!(autopilot::list_runs(&pool, n.id).await.unwrap().is_empty());
        assert!(autopilot::list_chapters(&pool, run.id).await.unwrap().is_empty());
    }
}
