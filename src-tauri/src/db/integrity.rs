use sqlx::SqlitePool;
use crate::db::test_util::test_pool_migrated;

/// 已迁移内存库（复用共享 helper，REV-012②）
async fn pool() -> SqlitePool {
    test_pool_migrated().await
}

async fn count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn pragma_foreign_keys_is_on() {
    let p = pool().await;
    let on: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&p).await.unwrap();
    assert_eq!(on, 1);
}

#[tokio::test]
async fn deleting_novel_cascades() {
    let p = pool().await;
    let (novel_id, _) = crate::db::seed::seed_novel_chapters(&p, 3, 10).await.unwrap();
    let before: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM chapter WHERE volume_id IN (SELECT id FROM volume WHERE novel_id=?)",
    )
    .bind(novel_id)
    .fetch_one(&p)
    .await
    .unwrap();
    assert_eq!(before, 3);
    sqlx::query("DELETE FROM novel WHERE id=?").bind(novel_id).execute(&p).await.unwrap();
    assert_eq!(count(&p, "volume").await, 0);
    assert_eq!(count(&p, "chapter").await, 0);
}

#[tokio::test]
async fn transaction_rollback_leaves_no_residue() {
    let p = pool().await;
    {
        let mut tx = p.begin().await.unwrap();
        sqlx::query("INSERT INTO novel (title, synopsis) VALUES ('tx','')")
            .execute(&mut *tx)
            .await
            .unwrap();
        // 不 commit，drop tx → 回滚
    }
    assert_eq!(count(&p, "novel").await, 0, "回滚后不应残留数据");
}

#[tokio::test]
async fn fk_violation_rejected() {
    let p = pool().await;
    // volume 引用不存在的 novel → FK 拒绝
    let err = sqlx::query("INSERT INTO volume (novel_id, title, order_index) VALUES (999, 'v', 0)")
        .execute(&p)
        .await;
    assert!(err.is_err(), "应触发 FK 约束");
}
