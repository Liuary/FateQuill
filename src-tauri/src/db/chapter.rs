use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// chapter 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChapterRow {
    pub id: i64,
    pub volume_id: i64,
    pub title: String,
    pub content: String,
    pub content_format: String,
    pub order_index: i64,
    pub status: String,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

const CONTENT_FORMATS: [&str; 3] = ["html", "plaintext", "tiptap-json"];
const STATUSES: [&str; 2] = ["draft", "archived"];

/// 校验：标题非空、content_format 合法、status 合法
fn validate(title: &str, content_format: &str, status: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    if !CONTENT_FORMATS.contains(&content_format) {
        return Err(IpcError::new(codes::VALIDATION, "invalid content_format"));
    }
    if !STATUSES.contains(&status) {
        return Err(IpcError::new(codes::VALIDATION, "invalid status"));
    }
    Ok(())
}

const COLUMNS: &str =
    "id,volume_id,title,content,content_format,order_index,status,word_count,created_at,updated_at";

pub async fn list(pool: &SqlitePool) -> Result<Vec<ChapterRow>, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM chapter ORDER BY order_index");
    Ok(sqlx::query_as::<_, ChapterRow>(&sql).fetch_all(pool).await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<ChapterRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM chapter WHERE id=?");
    sqlx::query_as::<_, ChapterRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("chapter"))
}

pub async fn create(
    pool: &SqlitePool,
    volume_id: i64,
    title: &str,
    content: &str,
    content_format: &str,
    order_index: i64,
) -> Result<ChapterRow, IpcError> {
    // status 由数据库默认 'draft'，word_count 默认 0（op-006 计算）
    validate(title, content_format, "draft")?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO chapter (volume_id,title,content,content_format,order_index) VALUES (?,?,?,?,?) RETURNING id",
    )
    .bind(volume_id)
    .bind(title)
    .bind(content)
    .bind(content_format)
    .bind(order_index)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: &str,
    content: &str,
    content_format: &str,
    status: &str,
    order_index: i64,
) -> Result<ChapterRow, IpcError> {
    validate(title, content_format, status)?;
    let n = sqlx::query(
        "UPDATE chapter SET title=?, content=?, content_format=?, status=?, order_index=?, updated_at=datetime('now') WHERE id=?",
    )
    .bind(title)
    .bind(content)
    .bind(content_format)
    .bind(status)
    .bind(order_index)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("chapter"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM chapter WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("chapter"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{chapter, novel, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    async fn fixture() -> (sqlx::SqlitePool, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        (pool, v.id)
    }

    #[tokio::test]
    async fn chapter_crud_roundtrip() {
        let (pool, volume_id) = fixture().await;
        let created = chapter::create(&pool, volume_id, "Ch1", "<p>hi</p>", "html", 0).await.unwrap();
        assert_eq!(created.status, "draft");
        assert_eq!(created.content_format, "html");
        let got = chapter::get(&pool, created.id).await.unwrap();
        assert_eq!(got.content, "<p>hi</p>");
        let updated = chapter::update(&pool, created.id, "Ch1b", "text", "plaintext", "archived", 2).await.unwrap();
        assert_eq!(updated.status, "archived");
        assert_eq!(updated.content_format, "plaintext");
        let list = chapter::list(&pool).await.unwrap();
        assert!(list.iter().any(|c| c.id == created.id));
        chapter::delete(&pool, created.id).await.unwrap();
        let after = chapter::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = chapter::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn chapter_validation_branches() {
        let (pool, volume_id) = fixture().await;
        let empty_title = chapter::create(&pool, volume_id, " ", "", "html", 0).await.unwrap_err();
        assert_eq!(empty_title.code, codes::VALIDATION);
        let bad_format = chapter::create(&pool, volume_id, "T", "", "md", 0).await.unwrap_err();
        assert_eq!(bad_format.code, codes::VALIDATION);
        let ok = chapter::create(&pool, volume_id, "T", "", "html", 0).await.unwrap();
        let bad_status = chapter::update(&pool, ok.id, "T", "", "html", "published", 0).await.unwrap_err();
        assert_eq!(bad_status.code, codes::VALIDATION);
    }
}
