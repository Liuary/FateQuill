use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// character 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CharacterRow {
    pub id: i64,
    pub novel_id: i64,
    pub name: String,
    pub profile: String,
}

fn validate_name(name: &str) -> Result<(), IpcError> {
    if name.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "name must not be empty"));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<CharacterRow>, IpcError> {
    Ok(sqlx::query_as::<_, CharacterRow>("SELECT id,novel_id,name,profile FROM character ORDER BY id")
        .fetch_all(pool)
        .await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<CharacterRow, IpcError> {
    sqlx::query_as::<_, CharacterRow>("SELECT id,novel_id,name,profile FROM character WHERE id=?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("character"))
}

pub async fn create(pool: &SqlitePool, novel_id: i64, name: &str, profile: &str) -> Result<CharacterRow, IpcError> {
    validate_name(name)?;
    let id: i64 = sqlx::query_scalar("INSERT INTO character (novel_id,name,profile) VALUES (?,?,?) RETURNING id")
        .bind(novel_id)
        .bind(name)
        .bind(profile)
        .fetch_one(pool)
        .await?;
    get(pool, id).await
}

pub async fn update(pool: &SqlitePool, id: i64, name: &str, profile: &str) -> Result<CharacterRow, IpcError> {
    validate_name(name)?;
    let n = sqlx::query("UPDATE character SET name=?, profile=? WHERE id=?")
        .bind(name)
        .bind(profile)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("character"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM character WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("character"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{character, novel, test_util::test_pool_migrated};
    use crate::error::codes;

    #[tokio::test]
    async fn character_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let created = character::create(&pool, n.id, "林默", "{\"age\":20}").await.unwrap();
        assert_eq!(created.name, "林默");
        let got = character::get(&pool, created.id).await.unwrap();
        assert_eq!(got.profile, "{\"age\":20}");
        let updated = character::update(&pool, created.id, "林默", "{\"age\":21}").await.unwrap();
        assert_eq!(updated.profile, "{\"age\":21}");
        let list = character::list(&pool).await.unwrap();
        assert!(list.iter().any(|c| c.id == created.id));
        character::delete(&pool, created.id).await.unwrap();
        let after = character::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = character::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn character_validation_empty_name() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let e = character::create(&pool, n.id, "  ", "{}").await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }
}
