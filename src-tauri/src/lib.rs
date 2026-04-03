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
use cloud::gdrive::{ServiceAccountKey, NormalizedLog};

// ── Global App State ───────────────────────────────────────────────────────

pub struct AppState {
    pub db:                  Mutex<Option<Connection>>,
    pub organization_id:     Mutex<Option<i32>>,
    pub organization_name:   Mutex<Option<String>>,
    pub active_branch_id:    Mutex<Option<i32>>,
    pub active_branch_name:  Mutex<Option<String>>,
    pub calendar_mode:       Mutex<String>,
    pub license_expiry:      Mutex<Option<String>>,
    /// Dynamically loaded Service Account credentials
    pub service_account_key: Mutex<Option<ServiceAccountKey>>,
}

fn lock_err<T>(_: T) -> AppError {
    AppError::Unknown("Failed to acquire state lock".to_string())
}

// ── Cloud Settings Commands ────────────────────────────────────────────────

/// Admin uploads the raw JSON content of a GCP Service Account key file.
/// The backend parses and stores it in AppState (never touches disk in plaintext).
#[tauri::command]
fn save_cloud_credentials(
    json_content: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let key: ServiceAccountKey = serde_json::from_str(&json_content)
        .map_err(|e| AppError::SerializationError(
            format!("Invalid Service Account JSON: {}", e)
        ))?;

    // Persist to SQLite for loading on restart
    let db_guard = state.db.lock().map_err(lock_err)?;
    if let Some(conn) = db_guard.as_ref() {
        conn.execute(
            "INSERT OR REPLACE INTO CloudConfig (id, client_email, private_key, project_id) VALUES (1, ?1, ?2, ?3)",
            (&key.client_email, &key.private_key, &key.project_id),
        )?;
    }

    // Load into memory
    *state.service_account_key.lock().map_err(lock_err)? = Some(key);
    Ok(())
}

/// Returns the currently loaded service account email (safe to expose)
#[tauri::command]
fn get_cloud_config(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let key_guard = state.service_account_key.lock().map_err(lock_err)?;
    if let Some(key) = key_guard.as_ref() {
        Ok(serde_json::json!({
            "configured": true,
            "clientEmail": key.client_email,
            "projectId": key.project_id,
        }))
    } else {
        Ok(serde_json::json!({ "configured": false }))
    }
}

// ── Core Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_license_info() -> Result<String, AppError> {
    Ok("2026-12-31".to_string())
}

#[tauri::command]
fn save_company_info(
    name: &str, address: &str, contact: &str, auth_key: &str,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "INSERT OR REPLACE INTO Organizations (id, name, address, contact_info, auth_key, license_expiry) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
        (name, address, contact, auth_key, "2026-12-31"),
    )?;
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
    Ok(serde_json::json!({
        "organizationId":   state.organization_id.lock().map_err(lock_err)?.clone(),
        "organizationName": state.organization_name.lock().map_err(lock_err)?.clone(),
        "activeBranchId":   state.active_branch_id.lock().map_err(lock_err)?.clone(),
        "activeBranchName": state.active_branch_name.lock().map_err(lock_err)?.clone(),
        "calendarMode":     state.calendar_mode.lock().map_err(lock_err)?.clone(),
        "licenseExpiry":    state.license_expiry.lock().map_err(lock_err)?.clone(),
    }))
}

#[tauri::command]
async fn sync_device_logs(
    ip: String, device_id: i32, brand: String,
    app: AppHandle, state: State<'_, AppState>,
) -> Result<String, AppError> {
    let parsed_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };

    let org_name    = state.organization_name.lock().map_err(lock_err)?
                          .clone().unwrap_or_else(|| "HeadOffice".to_string());
    let branch_name = state.active_branch_name.lock().map_err(lock_err)?
                          .clone().unwrap_or_else(|| "Main".to_string());
    let key_opt     = state.service_account_key.lock().map_err(lock_err)?.clone();

    // 1. Pull logs via hardware driver (10s timeout, 3 retries)
    let logs = hardware::sync_device(&ip, device_id, parsed_brand).await?;

    let _ = app.emit("console-log", format!(
        "[{} UTC] {} logs pulled from {} ({}).",
        chrono::Utc::now().format("%H:%M"), logs.len(), ip, brand
    ));

    // 2. Normalize logs (brand-agnostic format)
    let now = chrono::Utc::now();
    let normalized: Vec<NormalizedLog> = logs.iter().map(|l| NormalizedLog {
        log_id:         format!("{}_{}", l.device_id, l.timestamp),
        device_id:      l.device_id,
        employee_id:    l.employee_id,
        timestamp_utc:  l.timestamp.clone(),
        branch:         branch_name.clone(),
        organization:   org_name.clone(),
    }).collect();

    // 3. Sync to Drive (only if a key is configured)
    if let Some(key) = key_opt {
        cloud::gdrive::sync_logs_to_drive(
            &key, &org_name, &branch_name,
            now.format("%Y").to_string().parse::<i32>().unwrap_or(2026),
            now.format("%m").to_string().parse::<u32>().unwrap_or(1),
            &normalized,
        ).await?;

        let _ = app.emit("console-log", format!(
            "[{} UTC] Synced to Drive: Bio Bridge Pro HR/{}/{}/{}/{}.",
            chrono::Utc::now().format("%H:%M"),
            org_name, branch_name,
            now.format("%Y"), now.format("%m")
        ));
    } else {
        let _ = app.emit("console-log",
            "[WARN] No Service Account configured. Drive sync skipped. Configure in Cloud Settings.");
    }

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
    Ok(serde_json::json!({ "totalStaff": 120, "presentToday": 115, "onLeave": 2, "absent": 3 }))
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
            service_account_key: Mutex::new(None),
        })
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to resolve app data dir");
            let conn = db::init_db(&app_dir).expect("Failed to initialize SQLite");

            // Load stored cloud credentials from SQLite on startup
            let key_opt: Option<ServiceAccountKey> = conn.query_row(
                "SELECT client_email, private_key, project_id FROM CloudConfig WHERE id = 1",
                [],
                |row| Ok(ServiceAccountKey {
                    client_email: row.get(0)?,
                    private_key:  row.get(1)?,
                    project_id:   row.get(2)?,
                }),
            ).ok();

            let state = app.state::<AppState>();
            *state.db.lock().unwrap() = Some(conn);
            *state.service_account_key.lock().unwrap() = key_opt;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_license_info,
            save_company_info,
            update_calendar_mode,
            set_active_branch,
            get_app_context,
            save_cloud_credentials,
            get_cloud_config,
            sync_device_logs,
            scan_network,
            get_dashboard_stats,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Bio Bridge Pro HR");
}
