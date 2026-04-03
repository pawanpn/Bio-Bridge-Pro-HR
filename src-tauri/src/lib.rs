mod db;
mod hardware;
mod cloud;
mod errors;
mod models;

use tauri::{AppHandle, Manager, State};
use std::sync::Mutex;
use rusqlite::Connection;
use errors::AppError;
use models::DeviceBrand;

/// Single Source of Truth for the application's runtime context.
/// All fields are wrapped in Mutex for safe concurrent access across Tauri commands.
pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub organization_id: Mutex<Option<i32>>,
    pub organization_name: Mutex<Option<String>>,
    pub active_branch_id: Mutex<Option<i32>>,
    pub active_branch_name: Mutex<Option<String>>,
    pub calendar_mode: Mutex<String>,    // "BS" | "AD"
    pub license_expiry: Mutex<Option<String>>,
}

// ── Helpers ────────────────────────────────────────────────────────────────

fn lock_err<T>(_: T) -> AppError {
    AppError::Unknown("Failed to acquire state lock".to_string())
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

#[tauri::command]
fn get_license_info() -> Result<String, AppError> {
    // Production: verify auth_key against Google Drive lookup.
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
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT OR REPLACE INTO Organizations \
         (id, name, address, contact_info, auth_key, license_expiry) \
         VALUES (1, ?1, ?2, ?3, ?4, ?5)",
        (name, address, contact, auth_key, "2026-12-31"),
    )?;

    // Propagate into global AppState
    *state.organization_id.lock().map_err(lock_err)?   = Some(1);
    *state.organization_name.lock().map_err(lock_err)? = Some(name.to_string());
    *state.license_expiry.lock().map_err(lock_err)?    = Some("2026-12-31".to_string());

    Ok(())
}

#[tauri::command]
fn update_calendar_mode(mode: String, state: State<'_, AppState>) -> Result<(), AppError> {
    *state.calendar_mode.lock().map_err(lock_err)? = mode;
    Ok(())
}

#[tauri::command]
fn set_active_branch(branch_id: i32, branch_name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    *state.active_branch_id.lock().map_err(lock_err)?   = Some(branch_id);
    *state.active_branch_name.lock().map_err(lock_err)? = Some(branch_name);
    Ok(())
}

#[tauri::command]
fn get_app_context(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let org_id       = state.organization_id.lock().map_err(lock_err)?.clone();
    let org_name     = state.organization_name.lock().map_err(lock_err)?.clone();
    let branch_id    = state.active_branch_id.lock().map_err(lock_err)?.clone();
    let branch_name  = state.active_branch_name.lock().map_err(lock_err)?.clone();
    let cal_mode     = state.calendar_mode.lock().map_err(lock_err)?.clone();
    let expiry       = state.license_expiry.lock().map_err(lock_err)?.clone();

    Ok(serde_json::json!({
        "organizationId":   org_id,
        "organizationName": org_name,
        "activeBranchId":   branch_id,
        "activeBranchName": branch_name,
        "calendarMode":     cal_mode,
        "licenseExpiry":    expiry,
    }))
}

#[tauri::command]
async fn sync_device_logs(
    ip: String,
    device_id: i32,
    brand: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    let parsed_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };

    // Resolve active org/branch from global state for Google Drive path
    let org_name    = state.organization_name.lock().map_err(lock_err)?
                          .clone().unwrap_or_else(|| "HeadOffice".to_string());
    let branch_name = state.active_branch_name.lock().map_err(lock_err)?
                          .clone().unwrap_or_else(|| "Main".to_string());

    // 1. Fetch via the driver registry (includes 10s timeout + 3 retries)
    let logs = hardware::sync_device(&ip, device_id, parsed_brand).await?;

    let json_logs = serde_json::to_value(&logs)?;

    // 2. Emit live terminal event
    let _ = app.emit("console-log", format!(
        "[{} UTC] {} logs pulled from {} ({}).",
        chrono::Utc::now().format("%H:%M"), logs.len(), ip, brand
    ));

    // 3. Auto-sync to Google Drive: Org/Branch/Year/Month
    let now = chrono::Utc::now();
    cloud::gdrive::sync_logs_to_drive(
        &org_name, &branch_name,
        now.format("%Y").to_string().parse::<i32>().unwrap_or(2026),
        now.format("%m").to_string().parse::<u32>().unwrap_or(1),
        &json_logs,
    ).await?;

    let _ = app.emit("console-log", format!(
        "[{} UTC] Batch synced to Drive: {}/{}/{}.",
        chrono::Utc::now().format("%H:%M"), org_name, branch_name, now.format("%Y/%m")
    ));

    Ok(format!("Synced {} logs from {}", logs.len(), ip))
}

#[tauri::command]
async fn scan_network(base_ip: String, app: AppHandle) -> Result<String, AppError> {
    tauri::async_runtime::spawn(async move {
        hardware::scanner::scan_network(app, base_ip).await;
    });
    Ok("Network scan started".to_string())
}

#[tauri::command]
fn get_dashboard_stats(_state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({
        "totalStaff":    120,
        "presentToday":  115,
        "onLeave":       2,
        "absent":        3
    }))
}

// ── App Entry ──────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db:                  Mutex::new(None),
            organization_id:     Mutex::new(None),
            organization_name:   Mutex::new(None),
            active_branch_id:    Mutex::new(None),
            active_branch_name:  Mutex::new(None),
            calendar_mode:       Mutex::new("BS".to_string()),
            license_expiry:      Mutex::new(None),
        })
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to resolve app data dir");
            let conn = db::init_db(&app_dir).expect("Failed to initialize SQLite database");
            *app.state::<AppState>().db.lock().unwrap() = Some(conn);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_license_info,
            save_company_info,
            update_calendar_mode,
            set_active_branch,
            get_app_context,
            sync_device_logs,
            scan_network,
            get_dashboard_stats,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Bio Bridge Pro HR");
}
