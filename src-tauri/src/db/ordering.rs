use sqlx::SqlitePool;
use crate::error::IpcError;

/// 按给定顺序重写某作品下卷的 order_index（0..n-1），保证连续唯一。
/// 两阶段（先置负值再落定）以避免 UNIQUE(novel_id, order_index) 中途冲突。
pub async fn reorder_volumes(pool: &SqlitePool, novel_id: i64, ordered_ids: &[i64]) -> Result<(), IpcError> {
    let mut tx = crate::db::begin(pool).await?;
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE volume SET order_index=? WHERE id=? AND novel_id=?")
            .bind(-1 - (i as i64))
            .bind(id)
            .bind(novel_id)
            .execute(&mut *tx)
            .await?;
    }
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE volume SET order_index=? WHERE id=? AND novel_id=?")
            .bind(i as i64)
            .bind(id)
            .bind(novel_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// 按给定顺序重写某卷下章的 order_index（0..n-1），保证连续唯一。
pub async fn reorder_chapters(pool: &SqlitePool, volume_id: i64, ordered_ids: &[i64]) -> Result<(), IpcError> {
    let mut tx = crate::db::begin(pool).await?;
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE chapter SET order_index=? WHERE id=? AND volume_id=?")
            .bind(-1 - (i as i64))
            .bind(id)
            .bind(volume_id)
            .execute(&mut *tx)
            .await?;
    }
    for (i, id) in ordered_ids.iter().enumerate() {
        sqlx::query("UPDATE chapter SET order_index=? WHERE id=? AND volume_id=?")
            .bind(i as i64)
            .bind(id)
            .bind(volume_id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// 将章移动到目标卷的目标位置（事务内：更新 volume_id → 重排源卷与目标卷为连续）。
pub async fn move_chapter(pool: &SqlitePool, chapter_id: i64, to_volume_id: i64, to_index: i64) -> Result<(), IpcError> {
    let mut tx = crate::db::begin(pool).await?;
    let src_volume: Option<i64> = sqlx::query_scalar("SELECT volume_id FROM chapter WHERE id=?")
        .bind(chapter_id)
        .fetch_optional(&mut *tx)
        .await?;
    let src_volume = src_volume.ok_or_else(|| IpcError::not_found("chapter"))?;

    // 暂置唯一负值，避免 UNIQUE(volume_id, order_index) 冲突
    sqlx::query("UPDATE chapter SET volume_id=?, order_index=? WHERE id=?")
        .bind(to_volume_id)
        .bind(-1 - chapter_id)
        .bind(chapter_id)
        .execute(&mut *tx)
        .await?;

    // 源卷（跨卷移动时）紧凑化
    if src_volume != to_volume_id {
        let src_ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(src_volume)
            .fetch_all(&mut *tx)
            .await?;
        for (i, id) in src_ids.iter().enumerate() {
            sqlx::query("UPDATE chapter SET order_index=? WHERE id=?")
                .bind(i as i64)
                .bind(id)
                .execute(&mut *tx)
                .await?;
        }
    }

    // 目标卷：插入到 to_index（clamp 到合法范围）
    let mut tgt_ids: Vec<i64> = sqlx::query_scalar(
        "SELECT id FROM chapter WHERE volume_id=? AND id<>? ORDER BY order_index",
    )
    .bind(to_volume_id)
    .bind(chapter_id)
    .fetch_all(&mut *tx)
    .await?;
    let idx = to_index.clamp(0, tgt_ids.len() as i64) as usize;
    tgt_ids.insert(idx, chapter_id);
    for (i, id) in tgt_ids.iter().enumerate() {
        sqlx::query("UPDATE chapter SET order_index=? WHERE id=?")
            .bind(i as i64)
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{chapter, novel, ordering, test_util::test_pool_migrated, volume};

    #[tokio::test]
    async fn ordering_reorder_volumes_contiguous() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v0 = volume::create(&pool, n.id, "v0", 0).await.unwrap();
        let v1 = volume::create(&pool, n.id, "v1", 1).await.unwrap();
        let v2 = volume::create(&pool, n.id, "v2", 2).await.unwrap();
        ordering::reorder_volumes(&pool, n.id, &[v2.id, v0.id, v1.id]).await.unwrap();
        let rows: Vec<(i64, i64)> = sqlx::query_as("SELECT id, order_index FROM volume WHERE novel_id=? ORDER BY order_index")
            .bind(n.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(rows.iter().map(|(_, o)| *o).collect::<Vec<_>>(), vec![0, 1, 2]);
        assert_eq!(rows.iter().map(|(id, _)| *id).collect::<Vec<_>>(), vec![v2.id, v0.id, v1.id]);
    }

    #[tokio::test]
    async fn ordering_reorder_chapters_contiguous() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        let c0 = chapter::create(&pool, v.id, "c0", "", "html", 0).await.unwrap();
        let c1 = chapter::create(&pool, v.id, "c1", "", "html", 1).await.unwrap();
        let c2 = chapter::create(&pool, v.id, "c2", "", "html", 2).await.unwrap();
        ordering::reorder_chapters(&pool, v.id, &[c2.id, c0.id, c1.id]).await.unwrap();
        let rows: Vec<(i64, i64)> = sqlx::query_as("SELECT id, order_index FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(v.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(rows.iter().map(|(_, o)| *o).collect::<Vec<_>>(), vec![0, 1, 2]);
        assert_eq!(rows.iter().map(|(id, _)| *id).collect::<Vec<_>>(), vec![c2.id, c0.id, c1.id]);
    }

    #[tokio::test]
    async fn ordering_move_chapter_cross_volume() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let a = volume::create(&pool, n.id, "A", 0).await.unwrap();
        let b = volume::create(&pool, n.id, "B", 1).await.unwrap();
        let c0 = chapter::create(&pool, a.id, "c0", "", "html", 0).await.unwrap();
        let c1 = chapter::create(&pool, a.id, "c1", "", "html", 1).await.unwrap();
        let c2 = chapter::create(&pool, a.id, "c2", "", "html", 2).await.unwrap();
        ordering::move_chapter(&pool, c2.id, b.id, 0).await.unwrap();
        let a_ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(a.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        let a_orders: Vec<i64> = sqlx::query_scalar("SELECT order_index FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(a.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        let b_ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(b.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(a_ids, vec![c0.id, c1.id]);
        assert_eq!(a_orders, vec![0, 1]);
        assert_eq!(b_ids, vec![c2.id]);
    }

    #[tokio::test]
    async fn ordering_delete_chapter_compacts() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        let c0 = chapter::create(&pool, v.id, "c0", "", "html", 0).await.unwrap();
        let c1 = chapter::create(&pool, v.id, "c1", "", "html", 1).await.unwrap();
        let c2 = chapter::create(&pool, v.id, "c2", "", "html", 2).await.unwrap();
        chapter::delete(&pool, c1.id).await.unwrap();
        let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(v.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        let orders: Vec<i64> = sqlx::query_scalar("SELECT order_index FROM chapter WHERE volume_id=? ORDER BY order_index")
            .bind(v.id)
            .fetch_all(&pool)
            .await
            .unwrap();
        assert_eq!(ids, vec![c0.id, c2.id]);
        assert_eq!(orders, vec![0, 1]);
    }
}
