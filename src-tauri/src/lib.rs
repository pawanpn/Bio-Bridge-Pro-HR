use serde_json::Value;

#[tauri::command]
pub async fn register_new_staff(employee: Value) -> Result<(), String> {
    println!("Staff Sync: {:?}", employee);
    Ok(())
}

#[tauri::command]
pub async fn register_new_device(device: Value) -> Result<(), String> {
    println!("Device Sync: {:?}", device);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            register_new_staff,
            register_new_device
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
