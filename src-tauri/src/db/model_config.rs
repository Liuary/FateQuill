use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// model_config 表行结构（不含 key；Key 仅存于 OS 密钥链）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ModelConfigRow {
    pub id: i64,
    pub provider: String,
    pub label: String,
    pub base_url: String,
    pub model_name: String,
    pub temperature: f64,
    pub is_default: i64,
    pub created_at: String,
    pub updated_at: String,
}

const COLUMNS: &str =
    "id,provider,label,base_url,model_name,temperature,is_default,created_at,updated_at";

fn validate(provider: &str, label: &str, base_url: &str, model_name: &str) -> Result<(), IpcError> {
    if provider.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "provider must not be empty"));
    }
    if label.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "label must not be empty"));
    }
    if base_url.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "base_url must not be empty"));
    }
    if model_name.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "model_name must not be empty"));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<ModelConfigRow>, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM model_config ORDER BY id");
    Ok(sqlx::query_as::<_, ModelConfigRow>(&sql).fetch_all(pool).await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<ModelConfigRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM model_config WHERE id=?");
    sqlx::query_as::<_, ModelConfigRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("model_config"))
}

pub async fn create(
    pool: &SqlitePool,
    provider: &str,
    label: &str,
    base_url: &str,
    model_name: &str,
    temperature: f64,
    is_default: bool,
) -> Result<ModelConfigRow, IpcError> {
    validate(provider, label, base_url, model_name)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO model_config (provider,label,base_url,model_name,temperature,is_default) VALUES (?,?,?,?,?,?) RETURNING id",
    )
    .bind(provider)
    .bind(label)
    .bind(base_url)
    .bind(model_name)
    .bind(temperature)
    .bind(is_default)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

#[allow(clippy::too_many_arguments)]
pub async fn update(
    pool: &SqlitePool,
    id: i64,
    provider: &str,
    label: &str,
    base_url: &str,
    model_name: &str,
    temperature: f64,
    is_default: bool,
) -> Result<ModelConfigRow, IpcError> {
    validate(provider, label, base_url, model_name)?;
    let n = sqlx::query(
        "UPDATE model_config SET provider=?, label=?, base_url=?, model_name=?, temperature=?, is_default=?, updated_at=datetime('now') WHERE id=?",
    )
    .bind(provider)
    .bind(label)
    .bind(base_url)
    .bind(model_name)
    .bind(temperature)
    .bind(is_default)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("model_config"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM model_config WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("model_config"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;
    use crate::db::test_util::test_pool_migrated;

    #[tokio::test]
    async fn model_config_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let created = create(
            &pool,
            "openai-compatible",
            "default",
            "https://api.example.com",
            "gpt-x",
            0.7,
            true,
        )
        .await
        .unwrap();
        assert_eq!(created.provider, "openai-compatible");
        assert_eq!(created.is_default, 1);
        let got = get(&pool, created.id).await.unwrap();
        assert_eq!(got.model_name, "gpt-x");
        let updated = update(
            &pool,
            created.id,
            "anthropic",
            "default",
            "https://api.anthropic.com",
            "claude-x",
            0.3,
            false,
        )
        .await
        .unwrap();
        assert_eq!(updated.provider, "anthropic");
        assert_eq!(updated.is_default, 0);
        assert!(list(&pool).await.unwrap().iter().any(|c| c.id == created.id));
        delete(&pool, created.id).await.unwrap();
        assert_eq!(get(&pool, created.id).await.unwrap_err().code, codes::NOT_FOUND);
        assert_eq!(delete(&pool, created.id).await.unwrap_err().code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn model_config_validation() {
        let pool = test_pool_migrated().await;
        let e = create(&pool, "p", "  ", "https://x", "m", 0.7, false).await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn model_config_not_persist_key() {
        // 表结构无 key / api_key 列
        let pool = test_pool_migrated().await;
        let cols: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info('model_config')")
            .fetch_all(&pool)
            .await
            .unwrap();
        assert!(
            cols.iter().all(|c| c != "key" && c != "api_key"),
            "model_config 不应含 key 列: {cols:?}"
        );

        // 临时文件库：写入配置后，库文件字节不含哨兵 Key
        const SENTINEL: &str = "SENTINEL_SECRET_KEY_12345";
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("fatequill_np_{}_{nanos}.db", std::process::id()));
        let url = format!("sqlite:{}", path.to_string_lossy().replace('\\', "/"));
        let opts = sqlx::sqlite::SqliteConnectOptions::from_str(&url)
            .unwrap()
            .create_if_missing(true);
        let file_pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&file_pool).await.unwrap();
        create(&file_pool, "openai-compatible", "default", "https://api.example.com", "m", 0.7, true)
            .await
            .unwrap();
        file_pool.close().await;
        let text = String::from_utf8_lossy(&std::fs::read(&path).unwrap()).to_string();
        assert!(!text.contains(SENTINEL), "库文件不应含哨兵 Key");
        let _ = std::fs::remove_file(&path);
    }
}
