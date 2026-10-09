use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// chapter 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChapterRow {
    pub id: i64,
    pub volume_id: i64,
    pub title: String,
    pub content: String,
    pub content_format: String,
    pub order_index: i64,
    pub status: String,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

const CONTENT_FORMATS: [&str; 3] = ["html", "plaintext", "tiptap-json"];
const STATUSES: [&str; 2] = ["draft", "archived"];

/// 校验：标题非空、content_format 合法、status 合法
fn validate(title: &str, content_format: &str, status: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    if !CONTENT_FORMATS.contains(&content_format) {
        return Err(IpcError::new(codes::VALIDATION, "invalid content_format"));
    }
    if !STATUSES.contains(&status) {
        return Err(IpcError::new(codes::VALIDATION, "invalid status"));
    }
    Ok(())
}

const COLUMNS: &str =
    "id,volume_id,title,content,content_format,order_index,status,word_count,created_at,updated_at";

pub async fn list(pool: &SqlitePool) -> Result<Vec<ChapterRow>, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM chapter ORDER BY order_index");
    Ok(sqlx::query_as::<_, ChapterRow>(&sql).fetch_all(pool).await?)
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<ChapterRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM chapter WHERE id=?");
    sqlx::query_as::<_, ChapterRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("chapter"))
}

pub async fn create(
    pool: &SqlitePool,
    volume_id: i64,
    title: &str,
    content: &str,
    content_format: &str,
    order_index: i64,
) -> Result<ChapterRow, IpcError> {
    // status 由数据库默认 'draft'；word_count 由 Rust 侧计算回填
    validate(title, content_format, "draft")?;
    let wc = crate::db::word_count::count_words(content, content_format);
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO chapter (volume_id,title,content,content_format,order_index,word_count) VALUES (?,?,?,?,?,?) RETURNING id",
    )
    .bind(volume_id)
    .bind(title)
    .bind(content)
    .bind(content_format)
    .bind(order_index)
    .bind(wc)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: &str,
    content: &str,
    content_format: &str,
    status: &str,
    order_index: i64,
) -> Result<ChapterRow, IpcError> {
    validate(title, content_format, status)?;
    let wc = crate::db::word_count::count_words(content, content_format);
    let n = sqlx::query(
        "UPDATE chapter SET title=?, content=?, content_format=?, status=?, order_index=?, word_count=?, updated_at=datetime('now') WHERE id=?",
    )
    .bind(title)
    .bind(content)
    .bind(content_format)
    .bind(status)
    .bind(order_index)
    .bind(wc)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("chapter"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    // 事务内删除并按同卷紧凑化 order_index（保持不变量①）
    let mut tx = crate::db::begin(pool).await?;
    let volume_id: Option<i64> = sqlx::query_scalar("SELECT volume_id FROM chapter WHERE id=?")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    let volume_id = match volume_id {
        Some(v) => v,
        None => return Err(IpcError::not_found("chapter")),
    };
    sqlx::query("DELETE FROM chapter WHERE id=?").bind(id).execute(&mut *tx).await?;
    let ids: Vec<i64> = sqlx::query_scalar("SELECT id FROM chapter WHERE volume_id=? ORDER BY order_index")
        .bind(volume_id)
        .fetch_all(&mut *tx)
        .await?;
    for (i, cid) in ids.iter().enumerate() {
        sqlx::query("UPDATE chapter SET order_index=? WHERE id=?")
            .bind(i as i64)
            .bind(cid)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{chapter, novel, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    async fn fixture() -> (sqlx::SqlitePool, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        (pool, v.id)
    }

    #[tokio::test]
    async fn chapter_crud_roundtrip() {
        let (pool, volume_id) = fixture().await;
        let created = chapter::create(&pool, volume_id, "Ch1", "<p>hi</p>", "html", 0).await.unwrap();
        assert_eq!(created.status, "draft");
        assert_eq!(created.content_format, "html");
        let got = chapter::get(&pool, created.id).await.unwrap();
        assert_eq!(got.content, "<p>hi</p>");
        let updated = chapter::update(&pool, created.id, "Ch1b", "text", "plaintext", "archived", 2).await.unwrap();
        assert_eq!(updated.status, "archived");
        assert_eq!(updated.content_format, "plaintext");
        let list = chapter::list(&pool).await.unwrap();
        assert!(list.iter().any(|c| c.id == created.id));
        chapter::delete(&pool, created.id).await.unwrap();
        let after = chapter::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = chapter::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn chapter_validation_branches() {
        let (pool, volume_id) = fixture().await;
        let empty_title = chapter::create(&pool, volume_id, " ", "", "html", 0).await.unwrap_err();
        assert_eq!(empty_title.code, codes::VALIDATION);
        let bad_format = chapter::create(&pool, volume_id, "T", "", "md", 0).await.unwrap_err();
        assert_eq!(bad_format.code, codes::VALIDATION);
        let ok = chapter::create(&pool, volume_id, "T", "", "html", 0).await.unwrap();
        let bad_status = chapter::update(&pool, ok.id, "T", "", "html", "published", 0).await.unwrap_err();
        assert_eq!(bad_status.code, codes::VALIDATION);
    }

    /// v0.1 收口（T6）数据层往返：update 写入新 HTML → get 一致；`content_format='html'`；`word_count` html 分支回填
    #[tokio::test]
    async fn chapter_roundtrip_html_word_count() {
        let (pool, volume_id) = fixture().await;
        let created = chapter::create(&pool, volume_id, "第一段", "", "html", 0).await.unwrap();

        // 模拟「AI 流式直插后」的正文（HTML 存储）
        let html = "<p>你好，世界</p><p>第二段</p>";
        let updated = chapter::update(&pool, created.id, "第一段", html, "html", "draft", 0)
            .await
            .unwrap();
        assert_eq!(updated.content, html);
        assert_eq!(updated.content_format, "html");
        // 去标签后「你好，世界第二段」= 8 个非空白字符（html 分支回填）
        assert_eq!(updated.word_count, 8);

        // 再 get 往返一致
        let got = chapter::get(&pool, created.id).await.unwrap();
        assert_eq!(got.content, html);
        assert_eq!(got.content_format, "html");
        assert_eq!(got.word_count, 8);
    }
}
