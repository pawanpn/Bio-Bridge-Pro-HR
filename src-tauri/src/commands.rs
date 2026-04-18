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
