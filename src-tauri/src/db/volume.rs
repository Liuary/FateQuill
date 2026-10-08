use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// volume 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct VolumeRow {
    pub id: i64,
    pub novel_id: i64,
    pub title: String,
    pub order_index: i64,
}

fn validate_title(title: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<VolumeRow>, IpcError> {
    Ok(sqlx::query_as::<_, VolumeRow>("SELECT id,novel_id,title,order_index FROM volume ORDER BY order_index")
        .fetch_all(pool)
        .await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<VolumeRow, IpcError> {
    sqlx::query_as::<_, VolumeRow>("SELECT id,novel_id,title,order_index FROM volume WHERE id=?")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("volume"))
}

pub async fn create(pool: &SqlitePool, novel_id: i64, title: &str, order_index: i64) -> Result<VolumeRow, IpcError> {
    validate_title(title)?;
    let id: i64 = sqlx::query_scalar("INSERT INTO volume (novel_id,title,order_index) VALUES (?,?,?) RETURNING id")
        .bind(novel_id)
        .bind(title)
        .bind(order_index)
        .fetch_one(pool)
        .await?;
    get(pool, id).await
}

pub async fn update(pool: &SqlitePool, id: i64, title: &str, order_index: i64) -> Result<VolumeRow, IpcError> {
    validate_title(title)?;
    let n = sqlx::query("UPDATE volume SET title=?, order_index=? WHERE id=?")
        .bind(title)
        .bind(order_index)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("volume"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    // 事务内删除并按同作品紧凑化剩余卷的 order_index
    let mut tx = pool.begin().await?;
    let novel_id: Option<i64> = sqlx::query_scalar("SELECT novel_id FROM volume WHERE id=?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    let novel_id = match novel_id {
        Some(n) => n,
        None => return Err(IpcError::not_found("volume")),
    };
    sqlx::query("DELETE FROM volume WHERE id=?").bind(id).execute(&mut *tx).await?;
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM volume WHERE novel_id=? ORDER BY order_index")
        .bind(novel_id)
        .fetch_all(&mut *tx)
        .await?;
    for (i, vid) in ids.iter().enumerate() {
        sqlx::query("UPDATE volume SET order_index=? WHERE id=?")
            .bind(i as i64)
            .bind(vid)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{novel, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    #[tokio::test]
    async fn volume_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let created = volume::create(&pool, n.id, "第一卷", 0).await.unwrap();
        assert_eq!(created.novel_id, n.id);
        let got = volume::get(&pool, created.id).await.unwrap();
        assert_eq!(got.title, "第一卷");
        let updated = volume::update(&pool, created.id, "改名", 1).await.unwrap();
        assert_eq!(updated.order_index, 1);
        let list = volume::list(&pool).await.unwrap();
        assert!(list.iter().any(|v| v.id == created.id));
        volume::delete(&pool, created.id).await.unwrap();
        let after = volume::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = volume::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn volume_fk_violation() {
        let pool = test_pool_migrated().await;
        let e = volume::create(&pool, 9999, "孤儿卷", 0).await.unwrap_err();
        assert_eq!(e.code, codes::FK_VIOLATION);
    }

    #[tokio::test]
    async fn volume_validation_empty_title() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let e = volume::create(&pool, n.id, "  ", 0).await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }
}
