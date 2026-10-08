mod db;

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
        .invoke_handler(tauri::generate_handler![ping])
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
