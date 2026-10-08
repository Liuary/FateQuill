use std::time::Instant;
use crate::db::test_util::test_pool_migrated;

/// 基准：seed 50 章 × 3000 字，单次查询 < 100ms（可重复执行）。
/// 写路径（seed INSERT）耗时仅打印观测，不作门禁（REV-012③）。
#[tokio::test]
async fn seed_query_under_100ms() {
    let pool = test_pool_migrated().await; // 共享 helper（REV-012②）
    let t_seed = Instant::now();
    let (_, _ids) = crate::db::seed::seed_novel_chapters(&pool, 50, 3000).await.unwrap();
    println!("seed write (50x3000): {} ms", t_seed.elapsed().as_millis()); // 写路径观测（REV-012③）
    let t = Instant::now();
    let rows: Vec<(i64, i64)> = sqlx::query_as("SELECT id, word_count FROM chapter ORDER BY order_index")
        .fetch_all(&pool)
        .await
        .unwrap();
    let ms = t.elapsed().as_millis();
    assert_eq!(rows.len(), 50);
    assert!(rows.iter().all(|(_, wc)| *wc == 3000));
    println!("single query: {ms} ms");
    assert!(ms < 100, "单次查询应 < 100ms，实际 {ms}ms");
}
