mod db;
mod hardware;
mod cloud;
mod errors;
mod models;

use tauri::{AppHandle, Manager, State, Emitter, Listener};
use std::sync::Mutex;
use std::fs;
use rusqlite::{Connection, params};
use crate::errors::AppError;
use crate::models::DeviceBrand;
use crate::cloud::gdrive::{ServiceAccountKey, NormalizedLog};

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce
};
use rand::Rng;
use sha2::Digest;

// ── Global App State ───────────────────────────────────────────────────────

pub struct AppState {
    pub db:                  Mutex<Option<Connection>>,
    pub organization_id:     Mutex<Option<i32>>,
    pub organization_name:   Mutex<Option<String>>,
    pub active_branch_id:    Mutex<Option<i32>>,
    pub active_branch_name:  Mutex<Option<String>>,
    pub calendar_mode:       Mutex<String>,
    pub license_expiry:      Mutex<Option<String>>,
    pub service_account_key: Mutex<Option<ServiceAccountKey>>,
    pub root_folder_id:      Mutex<Option<String>>,
    pub realtime_cancel:     Mutex<Option<std::sync::Arc<std::sync::atomic::AtomicBool>>>,
}

fn lock_err<T>(_: T) -> AppError {
    AppError::Unknown("Failed to acquire state lock".to_string())
}

// ── Cloud Settings Commands ────────────────────────────────────────────────

#[tauri::command]
fn save_cloud_credentials(
    json_content: String,
    root_folder_id: String,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
        .map_err(|e: serde_json::Error| crate::errors::AppError::SerializationError(
            format!("Invalid Service Account JSON: {}", e)
        ))?;

    let db_guard = state.db.lock().map_err(lock_err)?;
    if let Some(conn) = db_guard.as_ref() {
        conn.execute(
            "INSERT OR REPLACE INTO CloudConfig (id, client_email, private_key, project_id, root_folder_id) VALUES (1, ?1, ?2, ?3, ?4)",
            (&key.client_email, &key.private_key, &key.project_id, &root_folder_id),
        )?;
    }

    *state.service_account_key.lock().map_err(lock_err)? = Some(key);
    *state.root_folder_id.lock().map_err(lock_err)?      = Some(root_folder_id);
    Ok(())
}

#[tauri::command]
fn get_cloud_config(state: tauri::State<'_, AppState>) -> Result<serde_json::Value, crate::errors::AppError> {
    let key_guard = state.service_account_key.lock().map_err(|_| lock_err(()))?;
    let root_guard = state.root_folder_id.lock().map_err(|_| lock_err(()))?;
    
    if let Some(key) = key_guard.as_ref() {
        Ok(serde_json::json!({
            "configured": true,
            "clientEmail": key.client_email,
            "projectId": key.project_id,
            "rootFolderId": root_guard.clone().unwrap_or_else(|| "".to_string()),
        }))
    } else {
        Ok(serde_json::json!({ "configured": false }))
    }
}

// ── Core Commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn get_hardware_id() -> String {
    hardware::id::get_hardware_fingerprint()
}

#[tauri::command]
async fn activate_license_key(
    key: String,
    json_key: String,
    app: tauri::AppHandle,
) -> Result<String, crate::errors::AppError> {
    let sa_key: crate::cloud::gdrive::ServiceAccountKey = serde_json::from_str(&json_key)
        .map_err(|e: serde_json::Error| crate::errors::AppError::SerializationError(format!("Invalid Service Account JSON: {}", e)))?;
    
    // 1. Fetch current License Database from Drive
    let folder_id = "1jwryWTPbvvBc39EVBeZp-JJgF-WDC_Ps";
    let mut db_json = cloud::gdrive::fetch_license_database(&sa_key, folder_id).await?;
    
    let db = db_json.as_object_mut()
        .ok_or_else(|| AppError::LicenseError("Invalid License Database format".to_string()))?;
    
    let hardware_id = hardware::id::get_hardware_fingerprint();
    
    // 2. Validate Key
    if let Some(license) = db.get_mut(&key) {
        let is_used = license["is_used"].as_bool().unwrap_or(true);
        let linked_hw = license["linked_hardware"].as_str();
        let expiry = license["expiry"].as_str().unwrap_or("2000-01-01").to_string();

        if is_used && linked_hw != Some(&hardware_id) {
            return Err(AppError::LicenseError("This key is already activated on another computer.".to_string()));
        }
        
        // 3. Mark as used and bind hardware
        license["is_used"] = serde_json::json!(true);
        license["linked_hardware"] = serde_json::json!(hardware_id);
        
        // 4. Update Database on Drive
        cloud::gdrive::update_license_database(&sa_key, folder_id, serde_json::Value::Object(db.clone())).await?;
        
        // 5. Save local encrypted token
        save_offline_token(&app, &hardware_id, &expiry)?;
        
        Ok(expiry)
    } else {
        Err(AppError::LicenseError("Invalid License Key. Please check and try again.".to_string()))
    }
}

#[tauri::command]
async fn admin_generate_keys(
    count: usize,
    expiry: String,
    json_key: String,
) -> Result<Vec<String>, AppError> {
    let sa_key: ServiceAccountKey = serde_json::from_str(&json_key)
        .map_err(|e| AppError::SerializationError(format!("Invalid Service Account JSON: {}", e)))?;
    
    let folder_id = "1jwryWTPbvvBc39EVBeZp-JJgF-WDC_Ps";
    let mut db_json = cloud::gdrive::fetch_license_database(&sa_key, folder_id).await
        .unwrap_or_else(|_| serde_json::json!({}));
    
    let db = db_json.as_object_mut().unwrap();
    let mut new_keys = Vec::new();
    
    for _ in 0..count {
        let key = format!("BIO-{:04}-{:04}-{:04}", 
            rand::thread_rng().gen_range(1000..9999),
            rand::thread_rng().gen_range(1000..9999),
            rand::thread_rng().gen_range(1000..9999)
        );
        db.insert(key.clone(), serde_json::json!({
            "expiry": expiry,
            "is_used": false,
            "linked_hardware": null
        }));
        new_keys.push(key);
    }
    
    cloud::gdrive::update_license_database(&sa_key, folder_id, serde_json::Value::Object(db.clone())).await?;
    Ok(new_keys)
}

#[tauri::command]
fn get_license_info(app: AppHandle, state: State<'_, AppState>) -> Result<String, AppError> {
    // Check memory state first
    if let Some(exp) = state.license_expiry.lock().unwrap().as_ref() {
        return Ok(exp.clone());
    }
    
    // Check offline token
    let exp = check_offline_token(&app)?;
    *state.license_expiry.lock().unwrap() = Some(exp.clone());
    Ok(exp)
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
    let branch_id   = state.active_branch_id.lock().map_err(lock_err)?.unwrap_or(1);
    let key_opt     = state.service_account_key.lock().map_err(lock_err)?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(lock_err)?.clone();

    // 1. Pull logs via hardware driver
    let logs: Vec<crate::models::AttendanceLog> = crate::hardware::sync_device(&ip, device_id, parsed_brand).await?;

    let _ = app.emit("console-log", format!(
        "[{} UTC] {} logs pulled from {} ({}).",
        chrono::Utc::now().format("%H:%M"), logs.len(), ip, brand
    ));

    // 2. Persist locally (Store-then-Sync)
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            for log in &logs {
                // INSERT OR IGNORE based on (employee_id, timestamp) to prevent duplicates
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, device_id, timestamp, is_synced) VALUES (?1, ?2, ?3, ?4, 0)",
                    params![log.employee_id, branch_id, device_id, log.timestamp],
                );
            }
            let _ = app.emit("console-log", format!(
                "[{} UTC] Local persistence complete. {} logs stored in SQLite.",
                chrono::Utc::now().format("%H:%M"), logs.len()
            ));
        }
    }

    // 3. Normalize logs for Cloud
    let now: chrono::DateTime<chrono::Utc> = chrono::Utc::now();
    let normalized: Vec<NormalizedLog> = logs.iter().map(|l| NormalizedLog {
        log_id:         format!("{}_{}", l.device_id, l.timestamp),
        device_id:      l.device_id,
        employee_id:    l.employee_id,
        timestamp_utc:  l.timestamp.clone(),
        branch:         branch_name.clone(),
        organization:   org_name.clone(),
    }).collect();

    // 4. Sync to Drive
    if let (Some(key), Some(root_id)) = (key_opt.clone(), root_id_opt.clone()) {
        let year  = now.format("%Y").to_string();
        let month = now.format("%m").to_string();

        let sync_result = crate::cloud::gdrive::sync_logs_to_drive(&key, &root_id, &org_name, &branch_name, &year, &month, &normalized).await;

        match sync_result {
            Ok(_) => {
                // Update local flag
                {
                    let db_guard = state.db.lock().map_err(lock_err)?;
                    if let Some(conn) = db_guard.as_ref() {
                        for log in &logs {
                            let _ = conn.execute(
                                "UPDATE AttendanceLogs SET is_synced = 1 WHERE employee_id = ?1 AND timestamp = ?2",
                                params![log.employee_id, log.timestamp],
                            );
                        }
                    }
                }
                let _ = app.emit("console-log", format!(
                    "[{} UTC] Synced to Drive: Targeted ID: {} > {} > {} > {} > {}.",
                    chrono::Utc::now().format("%H:%M"), root_id, org_name, branch_name, year, month
                ));
            },
            Err(AppError::PermissionDenied(rid)) => {
                let err_msg = format!("Error: Service Account lacks Editor access to Folder ID: {}. Local logs preserved.", rid);
                let _ = app.emit("console-log", format!("[ERROR] {}", err_msg));
                return Err(AppError::PermissionDenied(err_msg));
            },
            Err(e) => {
                let _ = app.emit("console-log", format!("[WARN] Cloud sync failed: {}. Offline mode: Data saved locally.", e));
                return Ok(format!("Local storage OK ({} logs). Cloud sync failed.", logs.len()));
            }
        }
    } else {
        let _ = app.emit("console-log", "[WARN] Cloud not configured. Logs stored locally only.");
    }

    Ok(format!("Synced {} logs from {}", logs.len(), ip))
}

#[tauri::command]
async fn scan_network(base_ip: String, app: tauri::AppHandle) -> Result<String, crate::errors::AppError> {
    tauri::async_runtime::spawn(async move {
        crate::hardware::scanner::scan_network(app, base_ip).await;
    });
    Ok("Network scan started".to_string())
}

#[tauri::command]
async fn test_device_connection(ip: String, port: u16, brand: String) -> Result<(), AppError> {
    let device_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };
    hardware::test_device(&ip, port, device_brand).await
}

#[tauri::command]
fn save_device_config(
    name: String, brand: String, ip: String, port: u16,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    
    // For now, we only support one active device per branch (id=1 for head office)
    conn.execute(
        "INSERT OR REPLACE INTO Devices (id, branch_id, name, brand, ip_address, port, status) VALUES (1, 1, ?1, ?2, ?3, ?4, 'online')",
        (name, brand, ip, port),
    )?;
    Ok(())
}

#[tauri::command]
async fn start_realtime_sync(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<(), crate::errors::AppError> {
    // 1. Stop existing listener if any
    let mut cancel_guard = state.realtime_cancel.lock().map_err(|_| lock_err(()))?;
    if let Some(prev_cancel) = cancel_guard.as_ref() {
        prev_cancel.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    let device_config = get_active_devices_internal(&state)?;
    if device_config.is_null() {
        return Err(AppError::DatabaseError("No active device found".into()));
    }

    let ip = device_config["ip"].as_str().unwrap_or("").to_string();
    let port = device_config["port"].as_u64().unwrap_or(4370) as u16;
    let brand_str = device_config["brand"].as_str().unwrap_or("");
    let brand = match brand_str {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };

    let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    *cancel_guard = Some(cancel.clone());

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_clone.emit("console-log", format!("[INFO] Starting Real-Time Listener on {}...", ip));
        if let Err(e) = hardware::listen_device(&ip, port, 1, brand, app_clone.clone(), cancel).await {
             let _ = app_clone.emit("console-log", format!("[ERROR] Real-Time Listener stopped: {}", e));
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_realtime_sync(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut cancel_guard = state.realtime_cancel.lock().map_err(lock_err)?;
    if let Some(cancel) = cancel_guard.take() {
        cancel.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    Ok(())
}

async fn process_log_and_sync(
    employee_id: i32,
    device_id: i32,
    timestamp: String,
    app: tauri::AppHandle,
) -> Result<(), crate::errors::AppError> {
    let state: tauri::State<AppState> = app.state::<AppState>();
    let org_name    = state.organization_name.lock().map_err(|_| lock_err(()))?.clone().unwrap_or_else(|| "HeadOffice".to_string());
    let branch_name = state.active_branch_name.lock().map_err(|_| lock_err(()))?.clone().unwrap_or_else(|| "Main".to_string());
    let branch_id   = state.active_branch_id.lock().map_err(|_| lock_err(()))?.unwrap_or(1);
    let key_opt     = state.service_account_key.lock().map_err(|_| lock_err(()))?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(|_| lock_err(()))?.clone();

    // 1. Save locally with is_synced = 0
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, device_id, timestamp, is_synced) VALUES (?1, ?2, ?3, ?4, 0)",
                params![employee_id, branch_id, device_id, timestamp],
            );
        }
    }

    // 2. Immediate Cloud Sync
    if let (Some(key), Some(root_id)) = (key_opt, root_id_opt) {
        let now = chrono::Utc::now();
        let normalized = vec![NormalizedLog {
            log_id: format!("{}_{}", device_id, timestamp),
            device_id,
            employee_id,
            timestamp_utc: timestamp.clone(),
            branch: branch_name.clone(),
            organization: org_name.clone(),
        }];

        let result = cloud::gdrive::sync_logs_to_drive(
            &key, &root_id, &org_name, &branch_name,
            &now.format("%Y").to_string(), &now.format("%m").to_string(),
            &normalized
        ).await;

        if result.is_ok() {
            {
                let db_guard = state.db.lock().map_err(lock_err)?;
                if let Some(conn) = db_guard.as_ref() {
                    let _ = conn.execute(
                        "UPDATE AttendanceLogs SET is_synced = 1 WHERE employee_id = ?1 AND timestamp = ?2",
                        params![employee_id, timestamp],
                    );
                }
            }
            let _ = app.emit("realtime-pulse", ()); // Pulse UI
        }
    }
    
    Ok(())
}

#[tauri::command]
fn get_active_devices(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    get_active_devices_internal(&state)
}

fn get_active_devices_internal(state: &AppState) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    
    let mut stmt = conn.prepare("SELECT name, brand, ip_address, port, status FROM Devices WHERE branch_id = 1")?;
    let device = stmt.query_row([], |row| {
        Ok(serde_json::json!({
            "name": row.get::<_, String>(0)?,
            "brand": row.get::<_, String>(1)?,
            "ip": row.get::<_, String>(2)?,
            "port": row.get::<_, u16>(3)?,
            "status": row.get::<_, String>(4)?,
        }))
    }).ok();

    Ok(serde_json::json!(device))
}

#[tauri::command]
fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_pattern = format!("{}%", today);

    // 1. Total Staff
    let total_staff: i32 = conn.query_row(
        "SELECT COUNT(*) FROM Employees",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    // 2. Present Today (Unique employee IDs in AttendanceLogs for current date)
    let present_today: i32 = conn.query_row(
        "SELECT COUNT(DISTINCT employee_id) FROM AttendanceLogs WHERE timestamp LIKE ?1",
        params![today_pattern],
        |row| row.get(0),
    ).unwrap_or(0);

    // 3. On Leave (Pending or Approved requests covering today)
    let on_leave: i32 = conn.query_row(
        "SELECT COUNT(DISTINCT employee_id) FROM LeaveRequests WHERE ?1 BETWEEN start_date AND end_date AND status != 'rejected'",
        params![today],
        |row| row.get(0),
    ).unwrap_or(0);

    // 4. Absent (Total - Present - OnLeave)
    let absent = (total_staff - present_today - on_leave).max(0);

    Ok(serde_json::json!({
        "totalStaff": total_staff,
        "presentToday": present_today,
        "onLeave": on_leave,
        "absent": absent,
        "lastUpdated": chrono::Local::now().format("%H:%M").to_string(),
    }))
}

// ── App Entry ──────────────────────────────────────────────────────────────

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
            root_folder_id:      Mutex::new(None),
            realtime_cancel:     Mutex::new(None),
        })
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to resolve app data dir");
            let conn = crate::db::init_db(&app_dir).expect("Failed to initialize SQLite");

            // Load stored cloud credentials and root folder ID on startup
            let config: Option<(String, String, String, Option<String>)> = conn.query_row(
                "SELECT client_email, private_key, project_id, root_folder_id FROM CloudConfig WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            ).ok();

            let state = app.state::<AppState>();
            *state.db.lock().unwrap() = Some(conn);

            if let Some((email, pkey, pid, rid)) = config {
                *state.service_account_key.lock().unwrap() = Some(ServiceAccountKey {
                    client_email: email,
                    private_key:  pkey,
                    project_id:   pid,
                });
                *state.root_folder_id.lock().unwrap() = rid;
            }

            // Real-Time Event Listener & Retry Worker
            let app_handle = app.handle().clone();
            app_handle.clone().listen("realtime-punch", move |event| {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                    let employee_id = payload["employee_id"].as_i64().unwrap_or(0) as i32;
                    let device_id = payload["device_id"].as_i64().unwrap_or(1) as i32;
                    let timestamp = payload["timestamp"].as_str().unwrap_or("").to_string();
                    
                    let inner_app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = process_log_and_sync(employee_id, device_id, timestamp, inner_app).await;
                    });
                }
            });

            // Retry Worker (Every 10 seconds)
            let retry_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    let unsynced_logs: Vec<(i32, i32, String)> = {
                        let state = retry_app.state::<AppState>();
                        let db_guard = state.db.lock().unwrap();
                        if let Some(conn) = db_guard.as_ref() {
                            let mut stmt = conn.prepare("SELECT employee_id, device_id, timestamp FROM AttendanceLogs WHERE is_synced = 0 LIMIT 50").unwrap();
                            stmt.query_map([], |row| {
                                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
                            }).unwrap().filter_map(|r| r.ok()).collect()
                        } else {
                            vec![]
                        }
                    };
                    
                    for (emp_id, dev_id, ts) in unsynced_logs {
                         let _ = process_log_and_sync(emp_id, dev_id, ts, retry_app.clone()).await;
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_hardware_id,
            activate_license_key,
            admin_generate_keys,
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
            test_device_connection,
            save_device_config,
            get_active_devices,
            start_realtime_sync,
            stop_realtime_sync,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Bio Bridge Pro HR");
}

// ── Security Helpers ───────────────────────────────────────────────────────

fn save_offline_token(app: &AppHandle, hw_id: &str, expiry: &str) -> Result<(), AppError> {
    let token_data = serde_json::json!({
        "hw": hw_id,
        "exp": expiry,
        "ts": chrono::Utc::now().to_rfc3339()
    }).to_string();
    
    let encrypted = encrypt_data(token_data.as_bytes())?;
    let path = app.path().app_data_dir().unwrap().join("license.token");
    fs::write(path, encrypted).map_err(|e| AppError::Unknown(format!("Failed to save license token: {}", e)))?;
    Ok(())
}

fn check_offline_token(app: &tauri::AppHandle) -> Result<String, crate::errors::AppError> {
    let path = app.path().app_data_dir().unwrap().join("license.token");
    if !path.exists() {
        return Err(crate::errors::AppError::LicenseError("No license found. Please activate online.".to_string()));
    }
    
    let encrypted = fs::read(path).map_err(|_| crate::errors::AppError::LicenseError("Failed to read license token".to_string()))?;
    let decrypted = decrypt_data(&encrypted)?;
    let data: serde_json::Value = serde_json::from_slice(&decrypted)?;
    
    let hw_id = crate::hardware::id::get_hardware_fingerprint();
    if data["hw"].as_str() != Some(&hw_id) {
        return Err(crate::errors::AppError::LicenseError("License mismatch: This software is activated for a different computer.".to_string()));
    }
    
    let expiry = data["exp"].as_str().ok_or_else(|| crate::errors::AppError::LicenseError("Invalid token format".to_string()))?;
    let expiry_date = chrono::NaiveDate::parse_from_str(expiry, "%Y-%m-%d")
        .map_err(|_| crate::errors::AppError::LicenseError("Invalid expiry date in token".to_string()))?;
    
    if expiry_date < chrono::Utc::now().date_naive() {
        return Err(crate::errors::AppError::LicenseError(format!("License expired on {}", expiry)));
    }
    
    Ok(expiry.to_string())
}

const SECRET_KEY: &[u8; 32] = b"BioBridgeProEncryptionKey2026!#@"; 

fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(SECRET_KEY);
    let cipher = Aes256Gcm::new(key);
    let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    let ciphertext = cipher.encrypt(nonce, data)
        .map_err(|e| AppError::Unknown(format!("Encryption failed: {}", e)))?;
    
    let mut result = nonce_bytes.to_vec();
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, AppError> {
    if data.len() < 12 { return Err(AppError::LicenseError("Invalid token".to_string())); }
    let key = aes_gcm::Key::<Aes256Gcm>::from_slice(SECRET_KEY);
    let cipher = Aes256Gcm::new(key);
    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    cipher.decrypt(nonce, ciphertext)
        .map_err(|_| AppError::LicenseError("Activation token is corrupted or tampered.".to_string()))
}
