//! 测试数据工厂：按参数生成作品/卷/章数据集（不进入生产构建）
use sqlx::SqlitePool;

/// 生成 1 部作品 + 1 卷 + n 章，每章约 chars_per_chapter 个字符，返回 (novel_id, chapter_ids)
pub async fn seed_novel_chapters(
    pool: &SqlitePool,
    chapters: i64,
    chars_per_chapter: usize,
) -> Result<(i64, Vec<i64>), sqlx::Error> {
    let novel_id: i64 = sqlx::query_scalar("INSERT INTO novel (title, synopsis) VALUES ('seed','') RETURNING id")
        .fetch_one(pool).await?;
    let volume_id: i64 = sqlx::query_scalar("INSERT INTO volume (novel_id, title, order_index) VALUES (?, 'Vol', 0) RETURNING id")
        .bind(novel_id).fetch_one(pool).await?;
    let mut ids = Vec::new();
    for i in 0..chapters {
        let content = "字".repeat(chars_per_chapter);
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO chapter (volume_id, title, content, content_format, order_index, word_count) VALUES (?, ?, ?, 'html', ?, ?) RETURNING id",
        )
        .bind(volume_id).bind(format!("Ch{i}")).bind(content).bind(i).bind(chars_per_chapter as i64)
        .fetch_one(pool).await?;
        ids.push(id);
    }
    Ok((novel_id, ids))
}
