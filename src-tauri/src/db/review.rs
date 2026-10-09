use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// review_record 表行结构（**每维一行**）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReviewRecordRow {
    pub id: i64,
    pub chapter_id: i64,
    pub round: i64,
    pub dimension: String,
    pub score: i64,
    pub reasons_json: String,
    pub created_at: String,
}

/// 合法审查维度（与前端 `ReviewDimension` 一致）
const VALID_DIMENSIONS: [&str; 4] = ["plot", "worldview", "compliance", "humanity"];

/// 校验：dimension 合法、score 落在 0–100
fn validate(dimension: &str, score: i64) -> Result<(), IpcError> {
    if !VALID_DIMENSIONS.contains(&dimension) {
        return Err(IpcError::new(codes::VALIDATION, "invalid dimension"));
    }
    if !(0..=100).contains(&score) {
        return Err(IpcError::new(codes::VALIDATION, "score out of range"));
    }
    Ok(())
}

const COLUMNS: &str = "id,chapter_id,round,dimension,score,reasons_json,created_at";

/// 按 id 取单行
async fn get(pool: &SqlitePool, id: i64) -> Result<ReviewRecordRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM review_record WHERE id=?");
    sqlx::query_as::<_, ReviewRecordRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("review_record"))
}

/// 写入一条审查记录（每维一行）；`dimension` / `score` 非法 → VALIDATION
pub async fn insert(
    pool: &SqlitePool,
    chapter_id: i64,
    round: i64,
    dimension: &str,
    score: i64,
    reasons_json: &str,
) -> Result<ReviewRecordRow, IpcError> {
    validate(dimension, score)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO review_record (chapter_id,round,dimension,score,reasons_json) VALUES (?,?,?,?,?) RETURNING id",
    )
    .bind(chapter_id)
    .bind(round)
    .bind(dimension)
    .bind(score)
    .bind(reasons_json)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

/// 按章查询审查历史（**时间倒序**：round DESC, created_at DESC, id DESC）
pub async fn list_by_chapter(
    pool: &SqlitePool,
    chapter_id: i64,
) -> Result<Vec<ReviewRecordRow>, IpcError> {
    let sql = format!(
        "SELECT {COLUMNS} FROM review_record WHERE chapter_id=? ORDER BY round DESC, created_at DESC, id DESC"
    );
    Ok(sqlx::query_as::<_, ReviewRecordRow>(&sql)
        .bind(chapter_id)
        .fetch_all(pool)
        .await?)
}

#[cfg(test)]
mod tests {
    use crate::db::{chapter, novel, review, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    /// 建 novel → volume → chapter，返回 (pool, chapter_id)
    async fn fixture() -> (sqlx::SqlitePool, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        let c = chapter::create(&pool, v.id, "Ch", "<p>hi</p>", "html", 0).await.unwrap();
        (pool, c.id)
    }

    #[tokio::test]
    async fn review_roundtrip_and_order() {
        let (pool, chapter_id) = fixture().await;

        // 第 1 轮（每维一行）
        let a = review::insert(&pool, chapter_id, 1, "plot", 52, r#"["冲突推进乏力"]"#)
            .await
            .unwrap();
        assert_eq!(a.dimension, "plot");
        assert_eq!(a.score, 52);
        assert_eq!(a.reasons_json, r#"["冲突推进乏力"]"#);

        // 第 2 轮（round 更大 → 应排在前面）
        review::insert(&pool, chapter_id, 2, "plot", 78, "[]").await.unwrap();
        review::insert(&pool, chapter_id, 2, "worldview", 80, "[]").await.unwrap();

        let list = review::list_by_chapter(&pool, chapter_id).await.unwrap();
        assert_eq!(list.len(), 3);
        assert_eq!(list[0].round, 2);
        assert_eq!(list[1].round, 2);
        assert_eq!(list[2].round, 1); // 时间倒序：round 降序
        assert_eq!(a.id, list[2].id); // 往返一致
    }

    #[tokio::test]
    async fn review_dimension_validation() {
        let (pool, chapter_id) = fixture().await;
        let bad_dim = review::insert(&pool, chapter_id, 1, "unknown", 80, "[]").await.unwrap_err();
        assert_eq!(bad_dim.code, codes::VALIDATION);
        let bad_score = review::insert(&pool, chapter_id, 1, "plot", 101, "[]").await.unwrap_err();
        assert_eq!(bad_score.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn review_cascade_on_chapter_delete() {
        let (pool, chapter_id) = fixture().await;
        review::insert(&pool, chapter_id, 1, "plot", 60, "[]").await.unwrap();
        chapter::delete(&pool, chapter_id).await.unwrap();
        let list = review::list_by_chapter(&pool, chapter_id).await.unwrap();
        assert!(list.is_empty(), "chapter 删除后 review_record 应级联删除");
    }
}
