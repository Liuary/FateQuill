use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// skill_entry 表行结构（规避经验条目）
///
/// `rule` 为**可执行的规避指令**；来源素材以 **id 引用**（`source_material_ids_json`），
/// 避免重复存储（REV-004）。
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SkillEntryRow {
    pub id: i64,
    pub version: String,
    pub title: String,
    pub rule: String,
    pub examples_json: String,
    pub source_material_ids_json: String,
    pub created_at: String,
}

const COLUMNS: &str =
    "id,version,title,rule,examples_json,source_material_ids_json,created_at";

/// 解析 `source_material_ids_json`（非法 JSON → VALIDATION）
fn parse_source_ids(json: &str) -> Result<Vec<i64>, IpcError> {
    serde_json::from_str::<Vec<i64>>(json)
        .map_err(|_| IpcError::new(codes::VALIDATION, "invalid source_material_ids_json"))
}

/// 校验：`title` / `rule` 非空 + **来源素材 id 均存在**（REV-004：以 id 引用）
async fn validate(
    pool: &SqlitePool,
    title: &str,
    rule: &str,
    source_ids: &[i64],
) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    if rule.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "rule must not be empty"));
    }
    for id in source_ids {
        let exists: Option<i64> = sqlx::query_scalar("SELECT id FROM material WHERE id=?")
            .bind(id)
            .fetch_optional(pool)
            .await?;
        if exists.is_none() {
            // 引用不存在的素材：拒绝（避免悬空引用）
            return Err(IpcError::new(
                codes::VALIDATION,
                format!("material {id} not found"),
            ));
        }
    }
    Ok(())
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<SkillEntryRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM skill_entry WHERE id=?");
    sqlx::query_as::<_, SkillEntryRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("skill_entry"))
}

/// 列出 skill 条目（时间倒序）
pub async fn list(pool: &SqlitePool) -> Result<Vec<SkillEntryRow>, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM skill_entry ORDER BY created_at DESC, id DESC");
    Ok(sqlx::query_as::<_, SkillEntryRow>(&sql).fetch_all(pool).await?)
}

pub async fn insert(
    pool: &SqlitePool,
    version: &str,
    title: &str,
    rule: &str,
    examples_json: &str,
    source_material_ids_json: &str,
) -> Result<SkillEntryRow, IpcError> {
    let source_ids = parse_source_ids(source_material_ids_json)?;
    validate(pool, title, rule, &source_ids).await?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO skill_entry (version,title,rule,examples_json,source_material_ids_json) \
         VALUES (?,?,?,?,?) RETURNING id",
    )
    .bind(version)
    .bind(title)
    .bind(rule)
    .bind(examples_json)
    .bind(source_material_ids_json)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

/// 更新 skill 条目（含 `version`/来源素材）；影响行 0 → NOT_FOUND
pub async fn update(
    pool: &SqlitePool,
    id: i64,
    version: &str,
    title: &str,
    rule: &str,
    examples_json: &str,
    source_material_ids_json: &str,
) -> Result<SkillEntryRow, IpcError> {
    let source_ids = parse_source_ids(source_material_ids_json)?;
    validate(pool, title, rule, &source_ids).await?;
    let affected = sqlx::query(
        "UPDATE skill_entry SET version=?,title=?,rule=?,examples_json=?,source_material_ids_json=? WHERE id=?",
    )
    .bind(version)
    .bind(title)
    .bind(rule)
    .bind(examples_json)
    .bind(source_material_ids_json)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(IpcError::not_found("skill_entry"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let affected = sqlx::query("DELETE FROM skill_entry WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(IpcError::not_found("skill_entry"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{material, novel, skill, test_util::test_pool_migrated, volume};
    use crate::error::codes;

    /// 建 novel → volume → chapter + 一条素材，返回 (pool, material_id)
    async fn fixture() -> (sqlx::SqlitePool, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let v = volume::create(&pool, n.id, "V", 0).await.unwrap();
        let c = crate::db::chapter::create(&pool, v.id, "Ch", "<p>hi</p>", "html", 0)
            .await
            .unwrap();
        let m = material::insert(
            &pool, "user_manual", "", "她不禁皱眉", "{}", "套话", "cliche", Some(c.id), "confirmed",
        )
        .await
        .unwrap();
        (pool, m.id)
    }

    #[tokio::test]
    async fn skill_crud_roundtrip_and_version_update() {
        let (pool, material_id) = fixture().await;
        let created = skill::insert(
            &pool,
            "1.0.0",
            "去套话",
            "避免「不禁」等套话",
            r#"[{"bad":"她不禁皱眉","good":"她皱眉"}]"#,
            &format!("[{material_id}]"),
        )
        .await
        .unwrap();
        assert_eq!(created.version, "1.0.0");
        assert_eq!(created.source_material_ids_json, format!("[{material_id}]"));

        let list = skill::list(&pool).await.unwrap();
        assert_eq!(list.len(), 1);

        // 版本管理：可更新
        let updated = skill::update(
            &pool,
            created.id,
            "1.1.0",
            "去套话",
            "避免「不禁」等套话（补充）",
            "[]",
            &format!("[{material_id}]"),
        )
        .await
        .unwrap();
        assert_eq!(updated.version, "1.1.0");
        assert_eq!(updated.rule, "避免「不禁」等套话（补充）");

        skill::delete(&pool, created.id).await.unwrap();
        assert_eq!(skill::get(&pool, created.id).await.unwrap_err().code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn skill_source_material_reference_validated() {
        let (pool, _material_id) = fixture().await;
        // 引用不存在的素材 → VALIDATION
        let err = skill::insert(&pool, "1.0.0", "t", "r", "[]", "[99999]")
            .await
            .unwrap_err();
        assert_eq!(err.code, codes::VALIDATION);

        // 非法 JSON → VALIDATION
        let bad_json = skill::insert(&pool, "1.0.0", "t", "r", "[]", "not json")
            .await
            .unwrap_err();
        assert_eq!(bad_json.code, codes::VALIDATION);

        // 空 title/rule → VALIDATION
        let empty_title = skill::insert(&pool, "1.0.0", " ", "r", "[]", "[]").await.unwrap_err();
        assert_eq!(empty_title.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn skill_referenced_material_cannot_be_deleted() {
        let (pool, material_id) = fixture().await;
        skill::insert(&pool, "1.0.0", "去套话", "避免套话", "[]", &format!("[{material_id}]"))
            .await
            .unwrap();

        // 跨 op 删除防护（REV-012）：被 skill 引用的素材删除被拒，错误 detail 含引用列表
        let err = material::delete(&pool, material_id).await.unwrap_err();
        assert_eq!(err.code, codes::FK_VIOLATION);
        let detail = err.detail.expect("detail 应携带引用列表");
        assert_eq!(detail[0]["title"], "去套话");
        assert!(material::get(&pool, material_id).await.is_ok()); // 未被删除
    }
}
