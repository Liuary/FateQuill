use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use crate::auth::AuthSpec;
use crate::db;
use crate::error::{codes, IpcError};
use crate::stream::{self, SharedStreamRegistry, StreamEvent};

/// 取插件连接池（未就绪 → INTERNAL）
async fn pool(app: &AppHandle) -> Result<sqlx::SqlitePool, IpcError> {
    db::get_pool(app)
        .await
        .ok_or_else(|| IpcError::new(codes::INTERNAL, "database not ready"))
}

// ---------- Novel ----------
#[tauri::command]
pub async fn list_novels(app: AppHandle) -> Result<Vec<db::novel::NovelRow>, IpcError> {
    db::novel::list(&pool(&app).await?).await
}
#[tauri::command]
pub async fn get_novel(app: AppHandle, id: i64) -> Result<db::novel::NovelRow, IpcError> {
    db::novel::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_novel(app: AppHandle, title: String, synopsis: String) -> Result<db::novel::NovelRow, IpcError> {
    db::novel::create(&pool(&app).await?, &title, &synopsis).await
}
#[tauri::command]
pub async fn update_novel(app: AppHandle, id: i64, title: String, synopsis: String) -> Result<db::novel::NovelRow, IpcError> {
    db::novel::update(&pool(&app).await?, id, &title, &synopsis).await
}
#[tauri::command]
pub async fn delete_novel(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::novel::delete(&pool(&app).await?, id).await
}

// ---------- Volume ----------
#[tauri::command]
pub async fn list_volumes(app: AppHandle) -> Result<Vec<db::volume::VolumeRow>, IpcError> {
    db::volume::list(&pool(&app).await?).await
}
#[tauri::command]
pub async fn get_volume(app: AppHandle, id: i64) -> Result<db::volume::VolumeRow, IpcError> {
    db::volume::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_volume(app: AppHandle, novel_id: i64, title: String, order_index: i64) -> Result<db::volume::VolumeRow, IpcError> {
    db::volume::create(&pool(&app).await?, novel_id, &title, order_index).await
}
#[tauri::command]
pub async fn update_volume(app: AppHandle, id: i64, title: String, order_index: i64) -> Result<db::volume::VolumeRow, IpcError> {
    db::volume::update(&pool(&app).await?, id, &title, order_index).await
}
#[tauri::command]
pub async fn delete_volume(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::volume::delete(&pool(&app).await?, id).await
}

// ---------- Chapter ----------
#[tauri::command]
pub async fn list_chapters(app: AppHandle) -> Result<Vec<db::chapter::ChapterRow>, IpcError> {
    db::chapter::list(&pool(&app).await?).await
}
#[tauri::command]
pub async fn get_chapter(app: AppHandle, id: i64) -> Result<db::chapter::ChapterRow, IpcError> {
    db::chapter::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_chapter(
    app: AppHandle,
    volume_id: i64,
    title: String,
    content: String,
    content_format: String,
    order_index: i64,
) -> Result<db::chapter::ChapterRow, IpcError> {
    db::chapter::create(&pool(&app).await?, volume_id, &title, &content, &content_format, order_index).await
}
#[tauri::command]
pub async fn update_chapter(
    app: AppHandle,
    id: i64,
    title: String,
    content: String,
    content_format: String,
    status: String,
    order_index: i64,
) -> Result<db::chapter::ChapterRow, IpcError> {
    db::chapter::update(&pool(&app).await?, id, &title, &content, &content_format, &status, order_index).await
}
#[tauri::command]
pub async fn delete_chapter(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::chapter::delete(&pool(&app).await?, id).await
}

// ---------- SettingCard ----------
#[tauri::command]
pub async fn list_setting_cards(
    app: AppHandle,
    tier: Option<String>,
) -> Result<Vec<db::setting_card::SettingCardRow>, IpcError> {
    db::setting_card::list(&pool(&app).await?, tier.as_deref()).await
}
#[tauri::command]
pub async fn get_setting_card(app: AppHandle, id: i64) -> Result<db::setting_card::SettingCardRow, IpcError> {
    db::setting_card::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_setting_card(
    app: AppHandle,
    novel_id: i64,
    title: String,
    content: String,
    kind: String,
    tier: Option<String>,
) -> Result<db::setting_card::SettingCardRow, IpcError> {
    db::setting_card::create(&pool(&app).await?, novel_id, &title, &content, &kind, tier.as_deref()).await
}
#[tauri::command]
pub async fn update_setting_card(
    app: AppHandle,
    id: i64,
    title: String,
    content: String,
    kind: String,
    tier: Option<String>,
) -> Result<db::setting_card::SettingCardRow, IpcError> {
    db::setting_card::update(&pool(&app).await?, id, &title, &content, &kind, tier.as_deref()).await
}
#[tauri::command]
pub async fn delete_setting_card(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::setting_card::delete(&pool(&app).await?, id).await
}
/// 归档批量落库（stage-11 T2）：**事务内**批创建抽取候选（前端待确认队列确认后调用）
#[tauri::command]
pub async fn save_extracted_settings(
    app: AppHandle,
    novel_id: i64,
    items: Vec<db::setting_card::NewSettingCard>,
) -> Result<Vec<db::setting_card::SettingCardRow>, IpcError> {
    db::setting_card::create_many(&pool(&app).await?, novel_id, &items).await
}

// ---------- ConflictRecord（stage-11 T4） ----------
#[tauri::command]
pub async fn save_conflict_record(
    app: AppHandle,
    novel_id: i64,
    a_id: i64,
    b_id: i64,
    // `type` 为 Rust 关键字：参数名取 `conflict_type`（前端传 `conflictType`）；DB 列名仍为 `type`
    conflict_type: String,
    evidence: String,
    severity: String,
) -> Result<db::conflict::ConflictRecordRow, IpcError> {
    db::conflict::save(&pool(&app).await?, novel_id, a_id, b_id, &conflict_type, &evidence, &severity)
        .await
}
#[tauri::command]
pub async fn list_conflict_records(
    app: AppHandle,
    novel_id: i64,
) -> Result<Vec<db::conflict::ConflictRecordRow>, IpcError> {
    db::conflict::list(&pool(&app).await?, novel_id).await
}
#[tauri::command]
pub async fn get_conflict_record(
    app: AppHandle,
    id: i64,
) -> Result<db::conflict::ConflictRecordRow, IpcError> {
    db::conflict::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn resolve_conflict_record(
    app: AppHandle,
    id: i64,
    action: String,
) -> Result<db::conflict::ConflictRecordRow, IpcError> {
    db::conflict::resolve(&pool(&app).await?, id, &action).await
}
#[tauri::command]
pub async fn delete_conflict_record(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::conflict::delete(&pool(&app).await?, id).await
}

// ---------- Character ----------
#[tauri::command]
pub async fn list_characters(app: AppHandle) -> Result<Vec<db::character::CharacterRow>, IpcError> {
    db::character::list(&pool(&app).await?).await
}
#[tauri::command]
pub async fn get_character(app: AppHandle, id: i64) -> Result<db::character::CharacterRow, IpcError> {
    db::character::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_character(app: AppHandle, novel_id: i64, name: String, profile: String) -> Result<db::character::CharacterRow, IpcError> {
    db::character::create(&pool(&app).await?, novel_id, &name, &profile).await
}
#[tauri::command]
pub async fn update_character(app: AppHandle, id: i64, name: String, profile: String) -> Result<db::character::CharacterRow, IpcError> {
    db::character::update(&pool(&app).await?, id, &name, &profile).await
}
#[tauri::command]
pub async fn delete_character(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::character::delete(&pool(&app).await?, id).await
}

// ---------- Ordering (T5) ----------
#[tauri::command]
pub async fn reorder_volumes(app: AppHandle, novel_id: i64, ordered_ids: Vec<i64>) -> Result<(), IpcError> {
    db::ordering::reorder_volumes(&pool(&app).await?, novel_id, &ordered_ids).await
}
#[tauri::command]
pub async fn reorder_chapters(app: AppHandle, volume_id: i64, ordered_ids: Vec<i64>) -> Result<(), IpcError> {
    db::ordering::reorder_chapters(&pool(&app).await?, volume_id, &ordered_ids).await
}
#[tauri::command]
pub async fn move_chapter(app: AppHandle, chapter_id: i64, to_volume_id: i64, to_index: i64) -> Result<(), IpcError> {
    db::ordering::move_chapter(&pool(&app).await?, chapter_id, to_volume_id, to_index).await
}

// ---------- SSE relay (T2) ----------
#[tauri::command]
pub async fn http_stream(
    registry: State<'_, SharedStreamRegistry>,
    request_id: String,
    url: String,
    headers: Vec<(String, String)>,
    body: String,
    auth: Option<AuthSpec>,
    on_event: Channel<StreamEvent>,
) -> Result<(), IpcError> {
    stream::ensure_https(&url)?; // REV-009①
    // auth 存在时先读密钥链（Key 仅存在于 Rust 内存，不返回前端）
    let composed = match &auth {
        Some(a) => {
            let key = crate::keyring_store::get(&a.key_ref_provider, &a.key_ref_label)?;
            crate::auth::compose_headers(headers, Some((a.clone(), key)))?
        }
        None => crate::auth::compose_headers(headers, None)?,
    };
    let client = stream::client();
    let reg = registry.inner().clone();
    let rid = request_id.clone();
    let reg_task = reg.clone();
    let handle = tokio::spawn(async move {
        stream::relay(&client, &url, composed, body, on_event).await;
        reg_task.handles.lock().await.remove(&rid);
    });
    reg.handles.lock().await.insert(request_id, handle.abort_handle());
    Ok(())
}

#[tauri::command]
pub async fn abort_stream(registry: State<'_, SharedStreamRegistry>, request_id: String) -> Result<bool, IpcError> {
    Ok(registry
        .handles
        .lock()
        .await
        .remove(&request_id)
        .map(|h| {
            h.abort();
            true
        })
        .unwrap_or(false))
}

// ---------- Model config (T4) ----------
#[tauri::command]
pub async fn list_model_configs(app: AppHandle) -> Result<Vec<db::model_config::ModelConfigRow>, IpcError> {
    db::model_config::list(&pool(&app).await?).await
}
#[tauri::command]
pub async fn get_model_config(app: AppHandle, id: i64) -> Result<db::model_config::ModelConfigRow, IpcError> {
    db::model_config::get(&pool(&app).await?, id).await
}
#[tauri::command]
pub async fn create_model_config(
    app: AppHandle,
    provider: String,
    label: String,
    base_url: String,
    model_name: String,
    temperature: f64,
    is_default: bool,
) -> Result<db::model_config::ModelConfigRow, IpcError> {
    db::model_config::create(&pool(&app).await?, &provider, &label, &base_url, &model_name, temperature, is_default).await
}
#[tauri::command]
pub async fn update_model_config(
    app: AppHandle,
    id: i64,
    provider: String,
    label: String,
    base_url: String,
    model_name: String,
    temperature: f64,
    is_default: bool,
) -> Result<db::model_config::ModelConfigRow, IpcError> {
    db::model_config::update(&pool(&app).await?, id, &provider, &label, &base_url, &model_name, temperature, is_default).await
}
#[tauri::command]
pub async fn delete_model_config(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::model_config::delete(&pool(&app).await?, id).await
}

// ---------- Keyring (T4) ----------
#[tauri::command]
pub async fn keyring_set(provider: String, label: String, key: String) -> Result<(), IpcError> {
    crate::keyring_store::set(&provider, &label, &key)
}
#[tauri::command]
pub async fn keyring_delete(provider: String, label: String) -> Result<(), IpcError> {
    crate::keyring_store::delete(&provider, &label)
}
#[tauri::command]
pub async fn keyring_exists(provider: String, label: String) -> Result<bool, IpcError> {
    crate::keyring_store::exists(&provider, &label)
}

// ---------- Review (T6) ----------
/// 保存一条审查记录（每维一行）；`reasons` 前端数组 → Rust 侧序列化为 `reasons_json`
#[tauri::command]
pub async fn save_review_record(
    app: AppHandle,
    chapter_id: i64,
    round: i64,
    dimension: String,
    score: i64,
    reasons: Vec<String>,
) -> Result<db::review::ReviewRecordRow, IpcError> {
    let reasons_json = serde_json::to_string(&reasons)
        .map_err(|e| IpcError::new(codes::INTERNAL, e.to_string()))?;
    db::review::insert(&pool(&app).await?, chapter_id, round, &dimension, score, &reasons_json).await
}

/// 按章查询审查历史（时间倒序）
#[tauri::command]
pub async fn list_review_records(
    app: AppHandle,
    chapter_id: i64,
) -> Result<Vec<db::review::ReviewRecordRow>, IpcError> {
    db::review::list_by_chapter(&pool(&app).await?, chapter_id).await
}

// ---------- Material (T4) ----------
/// 保存素材（入库即 `confirmed`：待确认队列为会话内存，REV-013；`candidate` 预留）
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn save_material(
    app: AppHandle,
    source_type: String,
    source_model: String,
    excerpt: String,
    position_json: String,
    reason: String,
    label: String,
    chapter_id: Option<i64>,
    status: Option<String>,
) -> Result<db::material::MaterialRow, IpcError> {
    let status = status.unwrap_or_else(|| "confirmed".to_string());
    db::material::insert(
        &pool(&app).await?,
        &source_type,
        &source_model,
        &excerpt,
        &position_json,
        &reason,
        &label,
        chapter_id,
        &status,
    )
    .await
}

/// 列出/检索素材（status / source_type 过滤 + query 模糊检索；时间倒序）
#[tauri::command]
pub async fn list_materials(
    app: AppHandle,
    status: Option<String>,
    source_type: Option<String>,
    query: Option<String>,
) -> Result<Vec<db::material::MaterialRow>, IpcError> {
    db::material::list(
        &pool(&app).await?,
        status.as_deref(),
        source_type.as_deref(),
        query.as_deref(),
    )
    .await
}

/// 删除素材；**被 skill 引用则拒绝**（REV-012；detail 携带引用列表）
#[tauri::command]
pub async fn delete_material(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::material::delete(&pool(&app).await?, id).await
}

// ---------- Skill (T5) ----------
/// 保存 skill 条目（`examples`/`source_material_ids` 由 Rust 侧序列化为 JSON）
#[tauri::command]
pub async fn save_skill_entry(
    app: AppHandle,
    version: String,
    title: String,
    rule: String,
    examples: Option<Vec<serde_json::Value>>,
    source_material_ids: Vec<i64>,
) -> Result<db::skill::SkillEntryRow, IpcError> {
    let examples_json = serde_json::to_string(&examples.unwrap_or_default())
        .map_err(|e| IpcError::new(codes::INTERNAL, e.to_string()))?;
    let source_ids_json = serde_json::to_string(&source_material_ids)
        .map_err(|e| IpcError::new(codes::INTERNAL, e.to_string()))?;
    db::skill::insert(
        &pool(&app).await?,
        &version,
        &title,
        &rule,
        &examples_json,
        &source_ids_json,
    )
    .await
}

/// 列出 skill 条目（时间倒序）
#[tauri::command]
pub async fn list_skill_entries(app: AppHandle) -> Result<Vec<db::skill::SkillEntryRow>, IpcError> {
    db::skill::list(&pool(&app).await?).await
}

/// 更新 skill 条目（含版本与来源素材）
#[tauri::command]
pub async fn update_skill_entry(
    app: AppHandle,
    id: i64,
    version: String,
    title: String,
    rule: String,
    examples: Option<Vec<serde_json::Value>>,
    source_material_ids: Vec<i64>,
) -> Result<db::skill::SkillEntryRow, IpcError> {
    let examples_json = serde_json::to_string(&examples.unwrap_or_default())
        .map_err(|e| IpcError::new(codes::INTERNAL, e.to_string()))?;
    let source_ids_json = serde_json::to_string(&source_material_ids)
        .map_err(|e| IpcError::new(codes::INTERNAL, e.to_string()))?;
    db::skill::update(
        &pool(&app).await?,
        id,
        &version,
        &title,
        &rule,
        &examples_json,
        &source_ids_json,
    )
    .await
}

/// 删除 skill 条目
#[tauri::command]
pub async fn delete_skill_entry(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::skill::delete(&pool(&app).await?, id).await
}
