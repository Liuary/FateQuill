use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// conflict_record 表行（stage-11 T4）
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConflictRecordRow {
    pub id: i64,
    pub novel_id: i64,
    pub a_id: i64,
    pub b_id: i64,
    /// 冲突类型（SQL 列名 `type`；Rust 侧避开关键字）
    #[sqlx(rename = "type")]
    #[serde(rename = "type")]
    pub type_: String,
    pub evidence: String,
    pub severity: String,
    pub status: String,
    pub action: String,
    pub created_at: String,
    pub resolved_at: Option<String>,
}

/// 合法冲突类型（与前端 `ConflictType` 一致）
const VALID_TYPES: [&str; 4] = ["life-status", "timeline", "numeric", "semantic"];
/// 合法严重度（与迁移 v5 的 `CHECK` 一致）
const VALID_SEVERITY: [&str; 3] = ["high", "medium", "low"];
/// 合法处置动作（与前端 `ConflictDispositionAction` 一致）
const VALID_ACTIONS: [&str; 4] = ["change_tier", "edit", "false_positive", "ignore"];

/// 动作 → 状态：误报 / 忽略 → `ignored`；其余（改分级 / 编辑）→ `resolved`
fn status_for(action: &str) -> &'static str {
    match action {
        "false_positive" | "ignore" => "ignored",
        _ => "resolved",
    }
}

/// 校验类型 / 严重度（写入前）
fn validate(type_: &str, severity: &str) -> Result<(), IpcError> {
    if !VALID_TYPES.contains(&type_) {
        return Err(IpcError::new(codes::VALIDATION, "invalid conflict type"));
    }
    if !VALID_SEVERITY.contains(&severity) {
        return Err(IpcError::new(codes::VALIDATION, "invalid conflict severity"));
    }
    Ok(())
}

const COLUMNS: &str =
    "id,novel_id,a_id,b_id,\"type\",evidence,severity,status,action,created_at,resolved_at";

/// 按 id 取冲突记录
pub async fn get(pool: &SqlitePool, id: i64) -> Result<ConflictRecordRow, IpcError> {
    let sql = format!("SELECT {COLUMNS} FROM conflict_record WHERE id=?");
    sqlx::query_as::<_, ConflictRecordRow>(&sql)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| IpcError::not_found("conflict_record"))
}

/// 落库一条冲突记录（跨会话可查）；`type`/`severity` 非法 → VALIDATION
pub async fn save(
    pool: &SqlitePool,
    novel_id: i64,
    a_id: i64,
    b_id: i64,
    type_: &str,
    evidence: &str,
    severity: &str,
) -> Result<ConflictRecordRow, IpcError> {
    validate(type_, severity)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO conflict_record (novel_id,a_id,b_id,\"type\",evidence,severity) VALUES (?,?,?,?,?,?) RETURNING id",
    )
    .bind(novel_id)
    .bind(a_id)
    .bind(b_id)
    .bind(type_)
    .bind(evidence)
    .bind(severity)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

/// 按作品列出冲突记录（**最新在前**）
pub async fn list(pool: &SqlitePool, novel_id: i64) -> Result<Vec<ConflictRecordRow>, IpcError> {
    let sql = format!(
        "SELECT {COLUMNS} FROM conflict_record WHERE novel_id=? ORDER BY id DESC"
    );
    Ok(sqlx::query_as::<_, ConflictRecordRow>(&sql)
        .bind(novel_id)
        .fetch_all(pool)
        .await?)
}

/// 处置冲突：置 `resolved`/`ignored`（由动作决定）+ `action` + `resolved_at`（留痕）
pub async fn resolve(
    pool: &SqlitePool,
    id: i64,
    action: &str,
) -> Result<ConflictRecordRow, IpcError> {
    if !VALID_ACTIONS.contains(&action) {
        return Err(IpcError::new(codes::VALIDATION, "invalid conflict action"));
    }
    let status = status_for(action);
    let n = sqlx::query(
        "UPDATE conflict_record SET status=?, action=?, resolved_at=datetime('now') WHERE id=?",
    )
    .bind(status)
    .bind(action)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("conflict_record"));
    }
    get(pool, id).await
}

/// 删除冲突记录
pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM conflict_record WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("conflict_record"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{conflict, novel, setting_card, test_util::test_pool_migrated};
    use crate::error::codes;

    /// 建作品 + 两张设定卡（冲突记录的 a_id/b_id 外键）
    async fn fixture() -> (sqlx::SqlitePool, i64, i64, i64) {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let a = setting_card::create(&pool, n.id, "渡鸦", "渡鸦已死", "世界观", Some("main"))
            .await
            .unwrap();
        let b = setting_card::create(&pool, n.id, "渡鸦", "渡鸦尚在人间", "世界观", Some("main"))
            .await
            .unwrap();
        (pool, n.id, a.id, b.id)
    }

    #[tokio::test]
    async fn conflict_save_list_get_roundtrip() {
        let (pool, novel_id, a_id, b_id) = fixture().await;
        let saved = conflict::save(
            &pool,
            novel_id,
            a_id,
            b_id,
            "life-status",
            "渡鸦已死 ｜ 渡鸦尚在人间",
            "high",
        )
        .await
        .unwrap();
        assert_eq!(saved.type_, "life-status");
        assert_eq!(saved.status, "open");
        assert_eq!(saved.action, "");
        assert!(saved.resolved_at.is_none());

        let got = conflict::get(&pool, saved.id).await.unwrap();
        assert_eq!(got.evidence, "渡鸦已死 ｜ 渡鸦尚在人间");

        let list = conflict::list(&pool, novel_id).await.unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].id, saved.id);

        // 其它作品查不到（跨作品隔离）
        let other = novel::create(&pool, "N2", "").await.unwrap();
        assert!(conflict::list(&pool, other.id).await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn conflict_resolve_sets_status_action_and_time() {
        let (pool, novel_id, a_id, b_id) = fixture().await;
        let open = conflict::save(&pool, novel_id, a_id, b_id, "numeric", "36人 ｜ 12人", "low")
            .await
            .unwrap();

        // 改分级 / 编辑 → resolved（留痕 action）
        let resolved = conflict::resolve(&pool, open.id, "change_tier").await.unwrap();
        assert_eq!(resolved.status, "resolved");
        assert_eq!(resolved.action, "change_tier");
        assert!(resolved.resolved_at.is_some());

        // 误报 / 忽略 → ignored
        let false_positive = conflict::resolve(&pool, open.id, "false_positive").await.unwrap();
        assert_eq!(false_positive.status, "ignored");
        assert_eq!(false_positive.action, "false_positive");

        let ignored = conflict::resolve(&pool, open.id, "ignore").await.unwrap();
        assert_eq!(ignored.status, "ignored");
        assert_eq!(ignored.action, "ignore");

        // 非法动作 → VALIDATION；不存在 → NOT_FOUND
        let bad = conflict::resolve(&pool, open.id, "bogus").await.unwrap_err();
        assert_eq!(bad.code, codes::VALIDATION);
        let missing = conflict::resolve(&pool, 9999, "ignore").await.unwrap_err();
        assert_eq!(missing.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn conflict_validation_and_delete() {
        let (pool, novel_id, a_id, b_id) = fixture().await;
        let bad_type = conflict::save(&pool, novel_id, a_id, b_id, "bogus", "", "low")
            .await
            .unwrap_err();
        assert_eq!(bad_type.code, codes::VALIDATION);
        let bad_severity = conflict::save(&pool, novel_id, a_id, b_id, "numeric", "", "urgent")
            .await
            .unwrap_err();
        assert_eq!(bad_severity.code, codes::VALIDATION);

        let saved = conflict::save(&pool, novel_id, a_id, b_id, "semantic", "理由", "medium")
            .await
            .unwrap();
        conflict::delete(&pool, saved.id).await.unwrap();
        let after = conflict::get(&pool, saved.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = conflict::delete(&pool, saved.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn conflict_cascade_on_novel_delete() {
        let (pool, novel_id, a_id, b_id) = fixture().await;
        conflict::save(&pool, novel_id, a_id, b_id, "timeline", "729年 ｜ 803年", "medium")
            .await
            .unwrap();
        novel::delete(&pool, novel_id).await.unwrap();
        assert!(
            conflict::list(&pool, novel_id).await.unwrap().is_empty(),
            "novel 删除后 conflict_record 应级联删除"
        );
    }
}
