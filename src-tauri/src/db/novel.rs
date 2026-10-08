use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// novel 表行结构（snake_case 列 → 前端 camelCase 由 ipc 层映射）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NovelRow {
    pub id: i64,
    pub title: String,
    pub synopsis: String,
    pub created_at: String,
    pub updated_at: String,
}

/// 标题校验：非空（去空格）
fn validate_title(title: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<NovelRow>, IpcError> {
    Ok(sqlx::query_as::<_, NovelRow>(
        "SELECT id,title,synopsis,created_at,updated_at FROM novel ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<NovelRow, IpcError> {
    sqlx::query_as::<_, NovelRow>("SELECT id,title,synopsis,created_at,updated_at FROM novel WHERE id=?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("novel"))
}

pub async fn create(pool: &SqlitePool, title: &str, synopsis: &str) -> Result<NovelRow, IpcError> {
    validate_title(title)?;
    let id: i64 = sqlx::query_scalar("INSERT INTO novel (title,synopsis) VALUES (?,?) RETURNING id")
        .bind(title)
        .bind(synopsis)
        .fetch_one(pool)
        .await?;
    get(pool, id).await
}

pub async fn update(pool: &SqlitePool, id: i64, title: &str, synopsis: &str) -> Result<NovelRow, IpcError> {
    validate_title(title)?;
    let n = sqlx::query("UPDATE novel SET title=?, synopsis=?, updated_at=datetime('now') WHERE id=?")
        .bind(title)
        .bind(synopsis)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("novel"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM novel WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("novel"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{novel, test_util::test_pool_migrated};
    use crate::error::codes;

    #[tokio::test]
    async fn novel_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let created = novel::create(&pool, "我的小说", "简介").await.unwrap();
        assert_eq!(created.title, "我的小说");
        let got = novel::get(&pool, created.id).await.unwrap();
        assert_eq!(got.synopsis, "简介");
        let updated = novel::update(&pool, created.id, "新标题", "新简介").await.unwrap();
        assert_eq!(updated.title, "新标题");
        let list = novel::list(&pool).await.unwrap();
        assert!(list.iter().any(|n| n.id == created.id));
        novel::delete(&pool, created.id).await.unwrap();
        let after = novel::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = novel::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn novel_not_found() {
        let pool = test_pool_migrated().await;
        let e = novel::get(&pool, 999).await.unwrap_err();
        assert_eq!(e.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn novel_validation_empty_title() {
        let pool = test_pool_migrated().await;
        let e = novel::create(&pool, "   ", "").await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }
}
