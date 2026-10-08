use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// setting_card 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SettingCardRow {
    pub id: i64,
    pub novel_id: i64,
    pub title: String,
    pub content: String,
    pub kind: String,
    pub created_at: String,
}

fn validate_title(title: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<SettingCardRow>, IpcError> {
    Ok(sqlx::query_as::<_, SettingCardRow>(
        "SELECT id,novel_id,title,content,kind,created_at FROM setting_card ORDER BY id",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<SettingCardRow, IpcError> {
    sqlx::query_as::<_, SettingCardRow>(
        "SELECT id,novel_id,title,content,kind,created_at FROM setting_card WHERE id=?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| IpcError::not_found("setting_card"))
}

pub async fn create(
    pool: &SqlitePool,
    novel_id: i64,
    title: &str,
    content: &str,
    kind: &str,
) -> Result<SettingCardRow, IpcError> {
    validate_title(title)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO setting_card (novel_id,title,content,kind) VALUES (?,?,?,?) RETURNING id",
    )
    .bind(novel_id)
    .bind(title)
    .bind(content)
    .bind(kind)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: &str,
    content: &str,
    kind: &str,
) -> Result<SettingCardRow, IpcError> {
    validate_title(title)?;
    let n = sqlx::query("UPDATE setting_card SET title=?, content=?, kind=? WHERE id=?")
        .bind(title)
        .bind(content)
        .bind(kind)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("setting_card"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM setting_card WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("setting_card"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{novel, setting_card, test_util::test_pool_migrated};
    use crate::error::codes;

    #[tokio::test]
    async fn setting_card_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let created = setting_card::create(&pool, n.id, "魔法体系", "以元素为本", "general").await.unwrap();
        assert_eq!(created.kind, "general");
        let got = setting_card::get(&pool, created.id).await.unwrap();
        assert_eq!(got.content, "以元素为本");
        let updated = setting_card::update(&pool, created.id, "改名", "改内容", "lore").await.unwrap();
        assert_eq!(updated.kind, "lore");
        let list = setting_card::list(&pool).await.unwrap();
        assert!(list.iter().any(|s| s.id == created.id));
        setting_card::delete(&pool, created.id).await.unwrap();
        let after = setting_card::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = setting_card::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn setting_card_validation_empty_title() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let e = setting_card::create(&pool, n.id, " ", "", "general").await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }
}
