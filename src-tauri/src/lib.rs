mod commands;

use commands::*; // Re‑export the commands defined in commands.rs

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            register_new_staff,
            register_new_device,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
