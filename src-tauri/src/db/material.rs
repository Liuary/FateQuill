use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// material 表行结构
///
/// 注（REV-016①）：`excerpt` 为引文**唯一权威**；`position_json` **仅存上下文**
/// `{contextBefore?, contextAfter?}`（不含引文本身）。
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MaterialRow {
    pub id: i64,
    pub source_type: String,
    pub source_model: String,
    pub excerpt: String,
    pub position_json: String,
    pub reason: String,
    pub label: String,
    pub chapter_id: Option<i64>,
    pub status: String,
    pub created_at: String,
}

/// 删除防护（REV-012）返回的引用项
#[derive(Debug, Serialize)]
pub struct SkillRef {
    pub id: i64,
    pub title: String,
}

const SOURCE_TYPES: [&str; 3] = ["multi_model_creation", "multi_model_cross", "user_manual"];
const STATUSES: [&str; 2] = ["candidate", "confirmed"];

/// 校验：`source_type` / `status` 枚举合法
fn validate(source_type: &str, status: &str) -> Result<(), IpcError> {
    if !SOURCE_TYPES.contains(&source_type) {
        return Err(IpcError::new(codes::VALIDATION, "invalid source_type"));
    }
    if !STATUSES.contains(&status) {
        return Err(IpcError::new(codes::VALIDATION, "invalid status"));
    }
    Ok(())
}

const COLUMNS: &str =
    "id,source_type,source_model,excerpt,position_json,reason,label,chapter_id,status,created_at";

pub async fn get(pool: &SqlitePool, id: i64) -> Result<MaterialRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM material WHERE id=?");
    sqlx::query_as::<_, MaterialRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("material"))
}

/// 写入素材；`source_type` / `status` 非法 → VALIDATION
#[allow(clippy::too_many_arguments)]
pub async fn insert(
    pool: &SqlitePool,
    source_type: &str,
    source_model: &str,
    excerpt: &str,
    position_json: &str,
    reason: &str,
    label: &str,
    chapter_id: Option<i64>,
    status: &str,
) -> Result<MaterialRow, IpcError> {
    validate(source_type, status)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO material (source_type,source_model,excerpt,position_json,reason,label,chapter_id,status) \
         VALUES (?,?,?,?,?,?,?,?) RETURNING id",
    )
    .bind(source_type)
    .bind(source_model)
    .bind(excerpt)
    .bind(position_json)
    .bind(reason)
    .bind(label)
    .bind(chapter_id)
    .bind(status)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

/// 列出素材：可选 `status` / `source_type` 过滤 + `query` 模糊检索（`excerpt`/`label`/`reason`），时间倒序
pub async fn list(
    pool: &SqlitePool,
    status: Option<&str>,
    source_type: Option<&str>,
    query: Option<&str>,
) -> Result<Vec<MaterialRow>, IpcError> {
    let mut sql = format!("SELECT {COLUMNS} FROM material WHERE 1=1");
    if status.is_some() {
        sql.push_str(" AND status=?");
    }
    if source_type.is_some() {
        sql.push_str(" AND source_type=?");
    }
    if query.is_some() {
        sql.push_str(" AND (excerpt LIKE ? OR label LIKE ? OR reason LIKE ?)");
    }
    sql.push_str(" ORDER BY created_at DESC, id DESC");

    let mut q = sqlx::query_as::<_, MaterialRow>(&sql);
    if let Some(value) = status {
        q = q.bind(value);
    }
    if let Some(value) = source_type {
        q = q.bind(value);
    }
    if let Some(value) = query {
        let like = format!("%{value}%");
        q = q.bind(like.clone()).bind(like.clone()).bind(like);
    }
    Ok(q.fetch_all(pool).await?)
}

/// 引用该素材的 skill 列表（REV-012 删除防护）：解析 `source_material_ids_json` 精确判定
pub async fn referencing_skills(pool: &SqlitePool, material_id: i64) -> Result<Vec<SkillRef>, IpcError> {
    let rows: Vec<(i64, String, String)> =
        sqlx::query_as("SELECT id,title,source_material_ids_json FROM skill_entry")
            .fetch_all(pool)
            .await?;
    let mut refs = Vec::new();
    for (id, title, json) in rows {
        let ids: Vec<i64> = serde_json::from_str(&json).unwrap_or_default();
        if ids.contains(&material_id) {
            refs.push(SkillRef { id, title });
        }
    }
    Ok(refs)
}

/// 删除素材：**被 skill 引用则拒绝**（REV-012；detail 携带引用列表）；影响行 0 → NOT_FOUND
pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let refs = referencing_skills(pool, id).await?;
    if !refs.is_empty() {
        // 被 skill 引用：拒绝删除（避免悬空引用）
        let mut error = IpcError::new(codes::FK_VIOLATION, "material is referenced by skill_entry");
        error.detail = serde_json::to_value(&refs).ok();
        return Err(error);
    }
    let affected = sqlx::query("DELETE FROM material WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(IpcError::not_found("material"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{chapter, material, novel, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    /// 建 novel → volume → chapter，返回 (pool, chapter_id)
    async fn fixture() -> (sqlx::SqlitePool, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        let c = chapter::create(&pool, v.id, "Ch", "<p>hi</p>", "html", 0).await.unwrap();
        (pool, c.id)
    }

    #[tokio::test]
    async fn material_crud_and_search() {
        let (pool, chapter_id) = fixture().await;

        let a = material::insert(
            &pool,
            "multi_model_creation",
            "modelA",
            "她不禁皱眉",
            r#"{"contextBefore":"前文","contextAfter":"后文"}"#,
            "套话",
            "套话",
            Some(chapter_id),
            "confirmed",
        )
        .await
        .unwrap();
        assert_eq!(a.source_type, "multi_model_creation");
        assert_eq!(a.excerpt, "她不禁皱眉"); // excerpt 唯一权威
        assert_eq!(a.chapter_id, Some(chapter_id));

        material::insert(&pool, "user_manual", "", "仿佛静止", "{}", "句式单调", "句式", None, "confirmed")
            .await
            .unwrap();

        let all = material::list(&pool, None, None, None).await.unwrap();
        assert_eq!(all.len(), 2);

        let by_type = material::list(&pool, None, Some("user_manual"), None).await.unwrap();
        assert_eq!(by_type.len(), 1);
        assert_eq!(by_type[0].excerpt, "仿佛静止");

        let by_query = material::list(&pool, None, None, Some("皱眉")).await.unwrap();
        assert_eq!(by_query.len(), 1);
        assert_eq!(by_query[0].id, a.id);

        material::delete(&pool, a.id).await.unwrap();
        assert_eq!(material::get(&pool, a.id).await.unwrap_err().code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn material_enum_validation() {
        let (pool, _chapter) = fixture().await;
        let bad_type = material::insert(&pool, "unknown", "", "x", "{}", "", "", None, "confirmed")
            .await
            .unwrap_err();
        assert_eq!(bad_type.code, codes::VALIDATION);
        let bad_status = material::insert(&pool, "user_manual", "", "x", "{}", "", "", None, "draft")
            .await
            .unwrap_err();
        assert_eq!(bad_status.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn material_delete_rejected_when_referenced() {
        let (pool, _chapter) = fixture().await;
        let m = material::insert(&pool, "user_manual", "", "原句", "{}", "r", "l", None, "confirmed")
            .await
            .unwrap();

        // 构造 skill 引用该素材
        sqlx::query(
            "INSERT INTO skill_entry (version,title,rule,examples_json,source_material_ids_json) VALUES (?,?,?,?,?)",
        )
        .bind("1.0.0")
        .bind("去套话")
        .bind("避免「不禁」等套话")
        .bind("[]")
        .bind(format!("[{}]", m.id))
        .execute(&pool)
        .await
        .unwrap();

        let err = material::delete(&pool, m.id).await.unwrap_err();
        assert_eq!(err.code, codes::FK_VIOLATION); // 被引用 → 拒绝
        let detail = err.detail.expect("detail 应携带引用列表");
        assert_eq!(detail[0]["title"], "去套话");
        assert!(material::get(&pool, m.id).await.is_ok()); // 未被删除
    }

    #[tokio::test]
    async fn material_chapter_id_set_null_on_chapter_delete() {
        let (pool, chapter_id) = fixture().await;
        let m = material::insert(&pool, "user_manual", "", "片段", "{}", "", "", Some(chapter_id), "confirmed")
            .await
            .unwrap();
        assert_eq!(m.chapter_id, Some(chapter_id));

        chapter::delete(&pool, chapter_id).await.unwrap();
        let after = material::get(&pool, m.id).await.unwrap();
        assert_eq!(after.chapter_id, None); // ON DELETE SET NULL
    }
}
