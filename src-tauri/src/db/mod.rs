pub mod migrations;
#[cfg(test)]
pub mod seed;

/// 数据库连接串（Tauri AppData 下的 sqlite 文件）
pub const DB_URL: &str = "sqlite:fatequill.db";

use tauri::Manager;
use tauri_plugin_sql::{DbInstances, DbPool};

/// 从插件管理的连接池取出 SqlitePool（Rust 侧访问入口）
pub async fn get_pool(app: &tauri::AppHandle) -> Option<sqlx::SqlitePool> {
    let instances = app.state::<DbInstances>();
    let map = instances.0.read().await;
    match map.get(DB_URL) {
        Some(DbPool::Sqlite(pool)) => Some(pool.clone()),
        _ => None,
    }
}

/// 测试专用内存库 helper（共享单一定义，op-004/006/007 复用；REV-012②）
#[cfg(test)]
pub mod test_util {
    use std::str::FromStr;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use sqlx::SqlitePool;

    /// 内存库（单连接，未迁移；经 `sqlite::memory:` 打开，不与 AppData 开发库交互）
    pub async fn test_pool() -> SqlitePool {
        let opts = SqliteConnectOptions::from_str("sqlite::memory:").unwrap().foreign_keys(true);
        SqlitePoolOptions::new().max_connections(1).connect_with(opts).await.expect("connect in-memory sqlite")
    }

    /// 内存库 + 已应用迁移
    pub async fn test_pool_migrated() -> SqlitePool {
        let pool = test_pool().await;
        sqlx::migrate!("./migrations").run(&pool).await.expect("run migrations");
        pool
    }
}
