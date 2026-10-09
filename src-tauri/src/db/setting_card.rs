use serde::Serialize;
use sqlx::SqlitePool;
use crate::error::{codes, IpcError};

/// 设定卡分级（四级，与 `kind` **正交**）
pub const SETTING_CARD_TIERS: [&str; 4] = ["main", "dark", "short", "temp"];

/// 缺省分级（短线保守默认）
pub const DEFAULT_TIER: &str = "short";

/// setting_card 表行结构
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SettingCardRow {
    pub id: i64,
    pub novel_id: i64,
    pub title: String,
    pub content: String,
    pub kind: String,
    pub tier: String,
    pub created_at: String,
}

fn validate_title(title: &str) -> Result<(), IpcError> {
    if title.trim().is_empty() {
        return Err(IpcError::new(codes::VALIDATION, "title must not be empty"));
    }
    Ok(())
}

/// 分级校验（DB 层 CHECK 兜底 + 应用层显式报错）
fn validate_tier(tier: &str) -> Result<(), IpcError> {
    if !SETTING_CARD_TIERS.contains(&tier) {
        return Err(IpcError::new(codes::VALIDATION, "invalid tier"));
    }
    Ok(())
}

/// 列出设定卡；`tier` 为可选过滤（**SQL 层**参数化过滤）
pub async fn list(pool: &SqlitePool, tier: Option<&str>) -> Result<Vec<SettingCardRow>, IpcError> {
    match tier {
        Some(tier) => {
            validate_tier(tier)?;
            Ok(sqlx::query_as::<_, SettingCardRow>(
                "SELECT id,novel_id,title,content,kind,tier,created_at FROM setting_card WHERE tier=? ORDER BY id",
            )
            .bind(tier)
            .fetch_all(pool)
            .await?)
        }
        None => Ok(sqlx::query_as::<_, SettingCardRow>(
            "SELECT id,novel_id,title,content,kind,tier,created_at FROM setting_card ORDER BY id",
        )
        .fetch_all(pool)
        .await?),
    }
}

pub async fn get(pool: &SqlitePool, id: i64) -> Result<SettingCardRow, IpcError> {
    sqlx::query_as::<_, SettingCardRow>(
        "SELECT id,novel_id,title,content,kind,tier,created_at FROM setting_card WHERE id=?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| IpcError::not_found("setting_card"))
}

/// 新建设定卡；`tier` 缺省 → `'short'`（短线保守默认）
pub async fn create(
    pool: &SqlitePool,
    novel_id: i64,
    title: &str,
    content: &str,
    kind: &str,
    tier: Option<&str>,
) -> Result<SettingCardRow, IpcError> {
    validate_title(title)?;
    let tier = tier.unwrap_or(DEFAULT_TIER);
    validate_tier(tier)?;
    let id: i64 = sqlx::query_scalar(
        "INSERT INTO setting_card (novel_id,title,content,kind,tier) VALUES (?,?,?,?,?) RETURNING id",
    )
    .bind(novel_id)
    .bind(title)
    .bind(content)
    .bind(kind)
    .bind(tier)
    .fetch_one(pool)
    .await?;
    get(pool, id).await
}

/// 更新设定卡；`tier` 为 `None` → **保留既有分级**（部分更新不静默降级）
pub async fn update(
    pool: &SqlitePool,
    id: i64,
    title: &str,
    content: &str,
    kind: &str,
    tier: Option<&str>,
) -> Result<SettingCardRow, IpcError> {
    validate_title(title)?;
    if let Some(tier) = tier {
        validate_tier(tier)?;
    }
    let n = sqlx::query("UPDATE setting_card SET title=?, content=?, kind=?, tier=COALESCE(?, tier) WHERE id=?")
        .bind(title)
        .bind(content)
        .bind(kind)
        .bind(tier)
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("setting_card"));
    }
    get(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> Result<(), IpcError> {
    let n = sqlx::query("DELETE FROM setting_card WHERE id=?")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(IpcError::not_found("setting_card"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db::{novel, setting_card, test_util::test_pool_migrated};
    use crate::error::codes;

    #[tokio::test]
    async fn setting_card_crud_roundtrip() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let created = setting_card::create(&pool, n.id, "魔法体系", "以元素为本", "general", None).await.unwrap();
        assert_eq!(created.kind, "general");
        assert_eq!(created.tier, "short"); // 缺省分级
        let got = setting_card::get(&pool, created.id).await.unwrap();
        assert_eq!(got.content, "以元素为本");
        let updated = setting_card::update(&pool, created.id, "改名", "改内容", "lore", None).await.unwrap();
        assert_eq!(updated.kind, "lore");
        let list = setting_card::list(&pool, None).await.unwrap();
        assert!(list.iter().any(|s| s.id == created.id));
        setting_card::delete(&pool, created.id).await.unwrap();
        let after = setting_card::get(&pool, created.id).await.unwrap_err();
        assert_eq!(after.code, codes::NOT_FOUND);
        let again = setting_card::delete(&pool, created.id).await.unwrap_err();
        assert_eq!(again.code, codes::NOT_FOUND);
    }

    #[tokio::test]
    async fn setting_card_validation_empty_title() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let e = setting_card::create(&pool, n.id, " ", "", "general", None).await.unwrap_err();
        assert_eq!(e.code, codes::VALIDATION);
    }

    #[tokio::test]
    async fn setting_card_tier_create_filter_and_update() {
        let pool = test_pool_migrated().await;
        let n = novel::create(&pool, "N", "").await.unwrap();
        let main = setting_card::create(&pool, n.id, "核心", "铁律", "general", Some("main")).await.unwrap();
        let dark = setting_card::create(&pool, n.id, "暗线", "身份未揭示", "general", Some("dark")).await.unwrap();
        let short = setting_card::create(&pool, n.id, "近期", "本卷有效", "general", None).await.unwrap();

        assert_eq!(main.tier, "main");
        assert_eq!(dark.tier, "dark");
        assert_eq!(short.tier, "short");

        // SQL 层过滤（单分级）
        let only_dark = setting_card::list(&pool, Some("dark")).await.unwrap();
        assert_eq!(only_dark.len(), 1);
        assert_eq!(only_dark[0].id, dark.id);

        // 部分更新不传 tier → **保留既有分级**（不静默降级为 short）
        let renamed = setting_card::update(&pool, main.id, "核心改名", "铁律", "general", None).await.unwrap();
        assert_eq!(renamed.tier, "main");

        // 显式传 tier → 生效
        let promoted = setting_card::update(&pool, short.id, "近期", "本卷有效", "general", Some("main")).await.unwrap();
        assert_eq!(promoted.tier, "main");

        // 非法分级 → VALIDATION
        let bad = setting_card::create(&pool, n.id, "非法", "", "general", Some("bogus")).await.unwrap_err();
        assert_eq!(bad.code, codes::VALIDATION);
    }
}
