use tauri::AppHandle;
use crate::db;
use crate::error::{codes, IpcError};

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
pub async fn list_setting_cards(app: AppHandle) -> Result<Vec<db::setting_card::SettingCardRow>, IpcError> {
    db::setting_card::list(&pool(&app).await?).await
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
) -> Result<db::setting_card::SettingCardRow, IpcError> {
    db::setting_card::create(&pool(&app).await?, novel_id, &title, &content, &kind).await
}
#[tauri::command]
pub async fn update_setting_card(
    app: AppHandle,
    id: i64,
    title: String,
    content: String,
    kind: String,
) -> Result<db::setting_card::SettingCardRow, IpcError> {
    db::setting_card::update(&pool(&app).await?, id, &title, &content, &kind).await
}
#[tauri::command]
pub async fn delete_setting_card(app: AppHandle, id: i64) -> Result<(), IpcError> {
    db::setting_card::delete(&pool(&app).await?, id).await
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
