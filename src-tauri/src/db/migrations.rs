use tauri_plugin_sql::{Migration, MigrationKind};

/// v1 建表脚本（单一来源；同时供插件运行时与测试迁移使用）
pub const MIGRATION_V1_SQL: &str = include_str!("../../migrations/0001_init.sql");

/// v2 模型配置表（单一来源；不含 key 字段）
pub const MIGRATION_V2_SQL: &str = include_str!("../../migrations/0002_model_config.sql");

/// v3 审查结果表（每维一行：round/dimension/score/reasons_json）
pub const MIGRATION_V3_SQL: &str = include_str!("../../migrations/0003_review.sql");

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init_schema",
            sql: MIGRATION_V1_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "model_config",
            sql: MIGRATION_V2_SQL,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "review",
            sql: MIGRATION_V3_SQL,
            kind: MigrationKind::Up,
        },
    ]
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
            .fetch_all("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('novel','volume','chapter','setting_card','character','model_config','review_record')")
            .await
            .unwrap();
        assert_eq!(rows.len(), 7);
    }

    #[tokio::test]
    async fn migration_is_idempotent() {
        let pool = test_pool().await;
        let migrator = sqlx::migrate!("./migrations");
        migrator.run(&pool).await.unwrap();
        migrator.run(&pool).await.unwrap(); // 第二次应为 no-op
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 3, "_sqlx_migrations 应有 v1/v2/v3 三条，且不重复记录");
    }

    #[tokio::test]
    async fn foreign_keys_enabled() {
        let pool = test_pool().await;
        let on: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&pool).await.unwrap();
        assert_eq!(on, 1);
    }
}
