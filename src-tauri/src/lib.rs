mod db;
mod hardware;
mod cloud;
mod errors;
mod models;

use tauri::{AppHandle, Manager, State};
use std::sync::Mutex;
use rusqlite::Connection;
use errors::AppError;

struct AppState {
    db: Mutex<Option<Connection>>,
    organization_id: Mutex<Option<i32>>,
    active_branch_id: Mutex<Option<i32>>,
    calendar_mode: Mutex<String>,
}

#[tauri::command]
fn get_license_info() -> Result<String, AppError> {
    Ok("2026-12-31".to_string())
}

#[tauri::command]
fn save_company_info(
    name: &str,
    address: &str,
    contact: &str,
    auth_key: &str,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_opt = state.db.lock().map_err(|_| AppError::DatabaseError("Failed to lock DB".to_string()))?;
    if let Some(conn) = db_opt.as_ref() {
        conn.execute(
            "INSERT OR REPLACE INTO Organizations (id, name, address, contact_info, auth_key, license_expiry) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
            (name, address, contact, auth_key, "2026-12-31"),
        )?;
        
        // Update Global State context
        if let Ok(mut org) = state.organization_id.lock() {
            *org = Some(1);
        }
        
        Ok(())
    } else {
        Err(AppError::DatabaseError("Database not initialized".to_string()))
    }
}

#[tauri::command]
fn update_calendar_mode(mode: String, state: State<'_, AppState>) -> Result<(), AppError> {
    if let Ok(mut cal) = state.calendar_mode.lock() {
        *cal = mode;
    }
    Ok(())
}

#[tauri::command]
async fn sync_device_logs(ip: String, device_id: i32, brand: String, app: AppHandle) -> Result<String, AppError> {
    // Parse brand dynamically
    let parsed_brand = match brand.as_str() {
        "Hikvision" => models::DeviceBrand::Hikvision,
        "ZKTeco" => models::DeviceBrand::ZKTeco,
        _ => models::DeviceBrand::Unknown,
    };

    // 1. Fetch logs universally via adapter block
    let logs = hardware::sync_device(&ip, device_id, parsed_brand).await?;
    
    // 2. Wrap them into the JSON payload requirement
    let json_logs = serde_json::to_value(&logs)?;
    
    // 3. Emit log to frontend attendance console
    let _ = app.emit("console-log", format!("[{} UTC] Syncing {:?} Device: {} ({}) logs pulled.", chrono::Utc::now().format("%H:%M"), brand, ip, logs.len()));

    // 4. Send background sync to Google Drive
    cloud::gdrive::sync_logs_to_drive("HeadOffice", "Kathmandu", 2026, 4, &json_logs).await?;
    
    let _ = app.emit("console-log", format!("[{} UTC] Successfully synchronized batch to Google Drive.", chrono::Utc::now().format("%H:%M")));

    Ok(format!("Synced {} logs", logs.len()))
}

#[tauri::command]
async fn scan_network(base_ip: String, app: AppHandle) -> Result<String, AppError> {
    // Spawns the tokio loop scanning the 254 subnet hosts
    tauri::async_runtime::spawn(async move {
        hardware::scanner::scan_network(app, base_ip).await;
    });
    Ok("Scanner started in background".to_string())
}

#[tauri::command]
fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    // Stub implementation returning Analytical Cards data
    Ok(serde_json::json!({
        "totalStaff": 120,
        "presentToday": 115,
        "onLeave": 2,
        "absent": 3
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState { 
            db: Mutex::new(None),
            organization_id: Mutex::new(None),
            active_branch_id: Mutex::new(None),
            calendar_mode: Mutex::new("BS".to_string())
        })
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app_data_dir");
            let conn = db::init_db(&app_dir).expect("Failed to init database");
            
            let state = app.state::<AppState>();
            if let Ok(mut db_lock) = state.db.lock() {
                *db_lock = Some(conn);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_license_info,
            save_company_info,
            update_calendar_mode,
            sync_device_logs,
            get_dashboard_stats,
            scan_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
