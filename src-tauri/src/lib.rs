mod db;
mod error;
mod commands;
mod stream;
mod keyring_store;
mod auth;

use std::sync::Arc;
use tauri_plugin_sql::Builder as SqlBuilder;

// 命令通道示例：前端 invoke("ping") 返回 "pong"
#[tauri::command]
fn ping() -> String {
    "pong".to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = db::migrations::migrations();
    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations(db::DB_URL, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            ping,
            commands::list_novels, commands::get_novel, commands::create_novel, commands::update_novel, commands::delete_novel,
            commands::list_volumes, commands::get_volume, commands::create_volume, commands::update_volume, commands::delete_volume,
            commands::list_chapters, commands::get_chapter, commands::create_chapter, commands::update_chapter, commands::delete_chapter,
            commands::list_setting_cards, commands::get_setting_card, commands::create_setting_card, commands::update_setting_card, commands::delete_setting_card,
            commands::list_characters, commands::get_character, commands::create_character, commands::update_character, commands::delete_character,
            commands::reorder_volumes, commands::reorder_chapters, commands::move_chapter,
            commands::http_stream, commands::abort_stream,
            commands::list_model_configs, commands::get_model_config, commands::create_model_config, commands::update_model_config, commands::delete_model_config,
            commands::keyring_set, commands::keyring_delete, commands::keyring_exists,
            commands::save_review_record, commands::list_review_records,
            commands::save_material, commands::list_materials, commands::delete_material,
            commands::save_skill_entry, commands::list_skill_entries, commands::update_skill_entry, commands::delete_skill_entry,
            commands::save_extracted_settings,
            commands::save_conflict_record, commands::list_conflict_records, commands::get_conflict_record,
            commands::resolve_conflict_record, commands::delete_conflict_record,
            commands::save_autopilot_run, commands::get_autopilot_run, commands::list_autopilot_runs,
            commands::save_autopilot_chapter, commands::list_autopilot_chapters,
        ])
        .manage(Arc::new(stream::StreamRegistry::default()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_pong() {
        assert_eq!(ping(), "pong");
    }
}
