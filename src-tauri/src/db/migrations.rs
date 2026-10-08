use tauri_plugin_sql::{Migration, MigrationKind};

/// v1 建表脚本（单一来源；同时供插件运行时与测试迁移使用）
pub const MIGRATION_V1_SQL: &str = include_str!("../../migrations/0001_init.sql");

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init_schema",
        sql: MIGRATION_V1_SQL,
        kind: MigrationKind::Up,
    }]
}

#[cfg(test)]
mod tests {
    use sqlx::Executor;
    use crate::db::test_util::test_pool;

    #[tokio::test]
    async fn migration_creates_schema() {
        let pool = test_pool().await;
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        let rows = pool
            .fetch_all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('novel','volume','chapter','setting_card','character')")
            .await
            .unwrap();
        assert_eq!(rows.len(), 5);
    }

    #[tokio::test]
    async fn migration_is_idempotent() {
        let pool = test_pool().await;
        let migrator = sqlx::migrate!("./migrations");
        migrator.run(&pool).await.unwrap();
        migrator.run(&pool).await.unwrap(); // 第二次应为 no-op
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 1, "_sqlx_migrations 不应重复记录");
    }

    #[tokio::test]
    async fn foreign_keys_enabled() {
        let pool = test_pool().await;
        let on: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&pool).await.unwrap();
        assert_eq!(on, 1);
    }
}
