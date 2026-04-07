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
use sha2::{Digest, Sha256};

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
    pub current_user_id:     Mutex<Option<i64>>,
    pub current_user_role:   Mutex<Option<String>>,
    pub current_user_branch_id: Mutex<Option<i64>>,
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
    let key: ServiceAccountKey = serde_json::from_str(&json_content)
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
fn check_port_conflict(port: u16) -> Result<bool, AppError> {
    use std::net::UdpSocket;
    match UdpSocket::bind(format!("0.0.0.0:{}", port)) {
        Ok(_) => Ok(false), // Port is free
        Err(_) => Ok(true), // Port is in use
    }
}

async fn start_adms_listener(app: tauri::AppHandle) {
    use tiny_http::{Server, Response};
    let server = Server::http("0.0.0.0:8081").unwrap();
    println!("[ADMS] Cloud Listener started on port 8081");
    
    for request in server.incoming_requests() {
        let _ = app.emit("console-log", format!("[ADMS] Received push from {}", request.remote_addr()));
        // Simplified ADMS logic: acknowledge any push to keep device happy
        let response = Response::from_string("OK");
        let _ = request.respond(response);
        // Note: Real parsing requires handling /iclock/cdata or /iclock/getrequest
    }
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
    ip: String, port: u16, device_id: i32, brand: String,
    app: AppHandle, state: State<'_, AppState>,
) -> Result<String, AppError> {
    let parsed_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };

    let org_name    = state.organization_name.lock().map_err(lock_err)?
                          .clone().unwrap_or_else(|| "HeadOffice".to_string());

    let key_opt     = state.service_account_key.lock().map_err(lock_err)?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(lock_err)?.clone();

    let _ = app.emit("console-log", format!(
        "[{}] Connecting to device #{} at {}:{} ({})",
        chrono::Utc::now().format("%H:%M:%S"), device_id, ip, port, brand
    ));

    // 0. Lookup device configuration from DB
    let (branch_id, gate_id, branch_name, gate_name, comm_key, machine_number) = {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
        conn.query_row(
            "SELECT d.branch_id, d.gate_id, b.name, g.name, d.comm_key, d.machine_number 
             FROM Devices d
             JOIN Branches b ON d.branch_id = b.id
             JOIN Gates g ON d.gate_id = g.id
             WHERE d.id = ?1",
            params![device_id],
            |row| Ok((
                row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, 
                row.get::<_, String>(2)?, row.get::<_, String>(3)?,
                row.get::<_, i32>(4)?, row.get::<_, i32>(5)?
            ))
        ).unwrap_or((1, 1, "Head Office".to_string(), "Main Gate".to_string(), 0, 1))
    };

    // 1a. Step A: Fetch real user info first (Identify Users)
    let user_info_result = crate::hardware::get_all_user_info(&ip, port, comm_key, machine_number, parsed_brand.clone()).await
        .map_err(|e| {
            let _ = app.emit("console-log", format!("[ERROR] Handshake/User pull failed: {}", e));
            e
        })?;

    if user_info_result.is_empty() {
        let err_msg = "Handshake OK but no staff members found on device. Sync aborted.".to_string();
        let _ = app.emit("console-log", format!("[ERROR] {}", err_msg));
        return Err(crate::errors::AppError::HardwareError(err_msg));
    }

    let _ = app.emit("console-log", format!(
        "[{}] STEP A SUCCESS: {} staff found from device {}:{}",
        chrono::Utc::now().format("%H:%M:%S"), user_info_result.len(), ip, port
    ));

    // Update employee records in DB
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            for u in &user_info_result {
                let _ = conn.execute(
                    "INSERT INTO Employees (id, name, branch_id) VALUES (?1, ?2, ?3) \
                     ON CONFLICT(id) DO UPDATE SET name = excluded.name",
                    params![u.employee_id, u.name, branch_id],
                );
            }
        }
    }

    // 1b. Step B: Pull attendance logs ONLY if users were found
    let _ = app.emit("console-log", format!("[{}] STEP B: Pulling logs...", chrono::Utc::now().format("%H:%M:%S")));
    let logs: Vec<crate::models::AttendanceLog> = crate::hardware::sync_device(&ip, port, comm_key, device_id, machine_number, parsed_brand).await
        .map_err(|e| {
            let _ = app.emit("sync-error", format!("Connection to {}:{} failed: {}", ip, port, e));
            e
        })?;

    let _ = app.emit("console-log", format!(
        "[{} UTC] {} attendance logs pulled from {}:{} ({})",
        chrono::Utc::now().format("%H:%M"), logs.len(), ip, port, brand
    ));

    // 2. Persist locally (Store-then-Sync)
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            for log in &logs {
                // INSERT OR IGNORE based on (employee_id, timestamp) to prevent duplicates
                // Note: We no longer create "New Employee" placeholders here.
                // If the employee wasn't in UserInfo pull, this log will fail FK which is desired 
                // for "Real Verified Data Only" mode.
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
                    params![log.employee_id, branch_id, gate_id, device_id, log.timestamp, log.punch_method],
                );
            }
            let _ = app.emit("console-log", format!(
                "[{} UTC] Local storage updated for {} logs.",
                chrono::Utc::now().format("%H:%M"), logs.len()
            ));
        }
    }

    // Refresh UI immediately after local save
    let _ = app.emit("attendance-sync-complete", serde_json::json!({
        "branch_id": branch_id,
        "gate_id": gate_id,
    }));

    // 3. Normalize logs for Cloud
    let normalized: Vec<NormalizedLog> = logs.iter().map(|l| NormalizedLog {
        log_id:         format!("{}_{}", l.device_id, l.timestamp),
        device_id:      l.device_id,
        employee_id:    l.employee_id,
        timestamp_utc:  l.timestamp.clone(),
        branch:         branch_name.clone(),
        gate:           gate_name.clone(),
        organization:   org_name.clone(),
    }).collect();

    // 4. Sync to Drive
    if let (Some(key), Some(root_id)) = (key_opt.clone(), root_id_opt.clone()) {
        let sync_result = crate::cloud::gdrive::sync_logs_to_drive(
            &key, &root_id, &org_name, &branch_name, &gate_name, &normalized
        ).await;

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
                    "[{} UTC] Synced to Drive: Branches/{} > {} > logs.json",
                    chrono::Utc::now().format("%H:%M"), branch_name, gate_name
                ));
            },
            Err(AppError::PermissionDenied(_rid)) => {
                let email = key_opt.clone().map(|k| k.client_email).unwrap_or_else(|| "N/A".into());
                let err_msg = format!("Permission Denied for Google Drive ({})", email);
                let _ = app.emit("console-log", format!("[ERROR] {}", err_msg));
                return Ok(format!("Local storage OK ({} logs). Cloud sync failed: {}", logs.len(), err_msg));
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
async fn test_device_connection(ip: String, port: u16, comm_key: i32, machine_number: i32, brand: String) -> Result<(), AppError> {
    let device_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };
    hardware::test_device(&ip, port, comm_key, machine_number, device_brand).await
}

#[derive(serde::Deserialize)]
struct DeviceInput {
    name: String, brand: String, ip: String, port: u16,
    #[serde(rename = "commKey")]
    comm_key: i32, 
    #[serde(rename = "machineNumber")]
    machine_number: i32,
    #[serde(rename = "branchId")]
    branch_id: i64, 
    #[serde(rename = "gateId")]
    gate_id: i64,
    #[serde(rename = "subnetMask")]
    subnet_mask: String,
    gateway: String,
    dns: String,
    dhcp: i32,
    #[serde(rename = "serverMode")]
    server_mode: String,
    #[serde(rename = "serverAddress")]
    server_address: String,
    #[serde(rename = "httpsEnabled")]
    https_enabled: i32,
}

#[tauri::command]
fn add_device(
    device: DeviceInput,
    state: State<'_, AppState>,
) -> Result<i64, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "INSERT INTO Devices (
            branch_id, gate_id, name, brand, ip_address, port, comm_key, machine_number,
            subnet_mask, gateway, dns, dhcp, server_mode, server_address, https_enabled, 
            is_default
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 0)",
        (
            device.branch_id, device.gate_id, &device.name, &device.brand, &device.ip, 
            device.port, device.comm_key, device.machine_number,
            &device.subnet_mask, &device.gateway, &device.dns, device.dhcp,
            &device.server_mode, &device.server_address, device.https_enabled
        ),
    )?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_device(
    id: i64,
    device: DeviceInput,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "UPDATE Devices SET 
            name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, machine_number=?6,
            subnet_mask=?7, gateway=?8, dns=?9, dhcp=?10, server_mode=?11, 
            server_address=?12, https_enabled=?13, branch_id=?14, gate_id=?15
         WHERE id=?16",
        (
            &device.name, &device.brand, &device.ip, device.port, device.comm_key, device.machine_number,
            &device.subnet_mask, &device.gateway, &device.dns, device.dhcp,
            &device.server_mode, &device.server_address, device.https_enabled,
            device.branch_id, device.gate_id, id
        ),
    )?;
    Ok(())
}

#[tauri::command]
fn set_default_device(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    
    // 1. Reset all to non-default
    conn.execute("UPDATE Devices SET is_default = 0", [])?;
    
    // 2. Set the target as default
    conn.execute("UPDATE Devices SET is_default = 1 WHERE id = ?1", [id])?;
    
    Ok(())
}

#[tauri::command]
fn save_device_config(
    id: i64, name: String, brand: String, ip: String, port: u16, comm_key: i32, branch_id: i64, gate_id: i64,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "UPDATE Devices SET name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, branch_id=?6, gate_id=?7 WHERE id=?8",
        (&name, &brand, &ip, port, comm_key, branch_id, gate_id, id),
    )?;
    Ok(())
}

#[tauri::command]
fn delete_device(
    id: i64,
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Devices WHERE id=?1", [id])?;
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
        return Err(AppError::DatabaseError("No default or active device found".into()));
    }

    let ip = device_config["ip"].as_str().unwrap_or("").to_string();
    let port = device_config["port"].as_u64().unwrap_or(4370) as u16;
    let comm_key = device_config["comm_key"].as_i64().unwrap_or(0) as i32;
    let brand_str = device_config["brand"].as_str().unwrap_or("").to_string();
    let brand = match brand_str.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };

    let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    *cancel_guard = Some(cancel.clone());

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_clone.emit("console-log", format!("[INFO] Starting Real-Time Listener on {} ({})...", ip, brand_str));
        if let Err(e) = hardware::listen_device(&ip, port, comm_key, 1, 1, brand, app_clone.clone(), cancel).await {
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
    punch_method: String,
    app: tauri::AppHandle,
) -> Result<(), crate::errors::AppError> {
    let state: tauri::State<AppState> = app.state::<AppState>();
    let org_name    = state.organization_name.lock().map_err(|_| lock_err(()))?.clone().unwrap_or_else(|| "HeadOffice".to_string());
    let key_opt     = state.service_account_key.lock().map_err(|_| lock_err(()))?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(|_| lock_err(()))?.clone();

    // 0. Lookup device's assigned branch and gate
    let (branch_id, gate_id, branch_name, gate_name) = {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
        conn.query_row(
            "SELECT d.branch_id, d.gate_id, b.name, g.name 
             FROM Devices d
             JOIN Branches b ON d.branch_id = b.id
             JOIN Gates g ON d.gate_id = g.id
             WHERE d.id = ?1",
            params![device_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?, row.get::<_, String>(2)?, row.get::<_, String>(3)?))
        ).unwrap_or((1, 1, "Head Office".to_string(), "Main Gate".to_string()))
    };

    // 1. Save locally with is_synced = 0
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            let gate_id: i64 = conn.query_row(
                "SELECT gate_id FROM Devices WHERE id = ?1",
                params![device_id],
                |row| row.get(0)
            ).unwrap_or(1);
            
            // Note: We ONLY allow logs for employees already in the database.
            // Dummy generation (New Employee) removed.
            let _ = conn.execute(
                "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
                params![employee_id, branch_id, gate_id, device_id, timestamp, punch_method],
            );
        }
    }

    // Refresh UI immediately after local save
    let _ = app.emit("attendance-sync-complete", serde_json::json!({
        "branch_id": branch_id,
        "gate_id": gate_id,
    }));
    let _ = app.emit("realtime-pulse", ()); // Pulse UI

    // 2. Immediate Cloud Sync
    if let (Some(key), Some(root_id)) = (key_opt, root_id_opt) {
        let normalized = vec![NormalizedLog {
            log_id: format!("{}_{}", device_id, timestamp),
            device_id,
            employee_id,
            timestamp_utc: timestamp.clone(),
            branch: branch_name.clone(),
            gate: gate_name.clone(),
            organization: org_name.clone(),
        }];

        let result = cloud::gdrive::sync_logs_to_drive(
            &key, &root_id, &org_name, &branch_name, &gate_name,
            &normalized
        ).await;

        if result.is_ok() {
            let db_guard = state.db.lock().map_err(lock_err)?;
            if let Some(conn) = db_guard.as_ref() {
                let _ = conn.execute(
                    "UPDATE AttendanceLogs SET is_synced = 1 WHERE employee_id = ?1 AND timestamp = ?2",
                    params![employee_id, timestamp],
                );
            }
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
    // Return the default device first, otherwise the first created one
    let mut stmt = conn.prepare("
        SELECT id, name, brand, ip_address, port, comm_key, machine_number, is_default 
        FROM Devices 
        ORDER BY is_default DESC, id ASC 
        LIMIT 1
    ")?;
    let device = stmt.query_row([], |row| {
        Ok(serde_json::json!({
            "id":             row.get::<_, i64>(0)?,
            "name":           row.get::<_, String>(1)?,
            "brand":          row.get::<_, String>(2)?,
            "ip":             row.get::<_, String>(3)?,
            "port":           row.get::<_, u16>(4)?,
            "comm_key":       row.get::<_, i32>(5)?,
            "machine_number": row.get::<_, i32>(6)?,
            "is_default":     row.get::<_, i32>(7)? == 1,
        }))
    }).ok();
    Ok(serde_json::json!(device))
}

#[tauri::command]
fn list_all_devices(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("
        SELECT d.id, d.name, d.brand, d.ip_address, d.port, d.comm_key, d.machine_number, 
               b.name as branch_name, g.name as gate_name, d.branch_id, d.gate_id, d.is_default,
               d.subnet_mask, d.gateway, d.dns, d.dhcp, d.server_mode, d.server_address, d.https_enabled
        FROM Devices d
        JOIN Branches b ON d.branch_id = b.id
        JOIN Gates g ON d.gate_id = g.id
        ORDER BY d.is_default DESC, d.id ASC
    ")?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id":             row.get::<_, i64>(0)?,
            "name":           row.get::<_, String>(1)?,
            "brand":          row.get::<_, String>(2)?,
            "ip":             row.get::<_, String>(3)?,
            "port":           row.get::<_, u16>(4)?,
            "comm_key":       row.get::<_, i32>(5)?,
            "machine_number": row.get::<_, i32>(6)?,
            "branch_name":    row.get::<_, String>(7)?,
            "gate_name":      row.get::<_, String>(8)?,
            "branch_id":      row.get::<_, i64>(9)?,
            "gate_id":        row.get::<_, i64>(10)?,
            "is_default":     row.get::<_, i32>(11)? == 1,
            "status":         "offline",
            "subnet_mask":    row.get::<_, Option<String>>(12)?,
            "gateway":        row.get::<_, Option<String>>(13)?,
            "dns":            row.get::<_, Option<String>>(14)?,
            "dhcp":           row.get::<_, i32>(15)? == 1,
            "server_mode":    row.get::<_, Option<String>>(16)?,
            "server_address": row.get::<_, Option<String>>(17)?,
            "https_enabled":  row.get::<_, i32>(18)? == 1,
        }))
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn add_branch(name: String, location: String, state: State<'_, AppState>) -> Result<i64, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Branches (org_id, name, location) VALUES (1, ?1, ?2)", [name, location])?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn add_gate(branch_id: i64, name: String, state: State<'_, AppState>) -> Result<i64, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Gates (branch_id, name) VALUES (?1, ?2)", params![branch_id, name])?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn list_gates(branch_id: i64, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name FROM Gates WHERE branch_id = ?1")?;
    let rows = stmt.query_map([branch_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
        }))
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let today_pattern = format!("{}%", today);

    // RBAC: If ADMIN, restrict to their branch
    let (u_role, u_branch) = {
        let r = state.current_user_role.lock().map_err(lock_err)?.clone();
        let b = state.current_user_branch_id.lock().map_err(lock_err)?.clone();
        (r, b)
    };

    let filter_branch = if u_role == Some("ADMIN".to_string()) && u_branch.is_some() { u_branch } else { None };

    // Present & Late Staff
    let mut present_stmt = if filter_branch.is_some() {
        conn.prepare("SELECT e.id, e.name, MIN(al.timestamp) FROM Employees e JOIN AttendanceLogs al ON e.id = al.employee_id WHERE al.timestamp LIKE ?2 AND e.branch_id = ?1 GROUP BY e.id")?
    } else {
        conn.prepare("SELECT e.id, e.name, MIN(al.timestamp) FROM Employees e JOIN AttendanceLogs al ON e.id = al.employee_id WHERE al.timestamp LIKE ?1 GROUP BY e.id")?
    };

    let mut present_staff = Vec::new();
    let mut late_staff = Vec::new();

    let present_rows: Vec<(i32, String, String)> = if filter_branch.is_some() {
        present_stmt.query_map(params![filter_branch.unwrap(), today_pattern], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)))?.filter_map(|r| r.ok()).collect()
    } else {
        present_stmt.query_map(params![today_pattern], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?)))?.filter_map(|r| r.ok()).collect()
    };

    for (id, name, in_time_full) in present_rows {
        let time_only = if in_time_full.len() >= 16 { &in_time_full[11..16] } else { "" };
        let is_late = time_only > "09:15";
        
        present_staff.push(serde_json::json!({ "id": id, "name": name.clone(), "time": time_only }));
        if is_late {
            late_staff.push(serde_json::json!({ "id": id, "name": name, "time": time_only }));
        }
    }

    // Absent Staff
    let mut absent_stmt = if filter_branch.is_some() {
        conn.prepare("SELECT id, name FROM Employees WHERE branch_id = ?1 AND id NOT IN (SELECT employee_id FROM AttendanceLogs WHERE timestamp LIKE ?2) AND id NOT IN (SELECT employee_id FROM LeaveRequests WHERE ?3 BETWEEN start_date AND end_date AND status != 'rejected')")?
    } else {
        conn.prepare("SELECT id, name FROM Employees WHERE id NOT IN (SELECT employee_id FROM AttendanceLogs WHERE timestamp LIKE ?1) AND id NOT IN (SELECT employee_id FROM LeaveRequests WHERE ?2 BETWEEN start_date AND end_date AND status != 'rejected')")?
    };

    let absent_rows: Vec<(i32, String)> = if filter_branch.is_some() {
        absent_stmt.query_map(params![filter_branch.unwrap(), today_pattern, today], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)))?.filter_map(|r| r.ok()).collect()
    } else {
        absent_stmt.query_map(params![today_pattern, today], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)))?.filter_map(|r| r.ok()).collect()
    };

    let absent_staff: Vec<serde_json::Value> = absent_rows.into_iter().map(|(id, name)| serde_json::json!({ "id": id, "name": name })).collect();

    // On Leave
    let mut leave_stmt = if filter_branch.is_some() {
        conn.prepare("SELECT e.id, e.name FROM LeaveRequests lr JOIN Employees e ON lr.employee_id = e.id WHERE ?2 BETWEEN lr.start_date AND lr.end_date AND lr.status != 'rejected' AND e.branch_id = ?1")?
    } else {
        conn.prepare("SELECT e.id, e.name FROM LeaveRequests lr JOIN Employees e ON lr.employee_id = e.id WHERE ?1 BETWEEN lr.start_date AND lr.end_date AND lr.status != 'rejected'")?
    };

    let leave_rows: Vec<(i32, String)> = if filter_branch.is_some() {
        leave_stmt.query_map(params![filter_branch.unwrap(), today], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)))?.filter_map(|r| r.ok()).collect()
    } else {
        leave_stmt.query_map(params![today], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?)))?.filter_map(|r| r.ok()).collect()
    };

    let leave_staff: Vec<serde_json::Value> = leave_rows.into_iter().map(|(id, name)| serde_json::json!({ "id": id, "name": name })).collect();

    let total_staff = present_staff.len() + absent_staff.len() + leave_staff.len();

    Ok(serde_json::json!({
        "totalStaff": total_staff,
        "presentToday": present_staff.len(),
        "onLeave": leave_staff.len(),
        "absent": absent_staff.len(),
        "lateToday": late_staff.len(),
        "presentStaff": present_staff,
        "absentStaff": absent_staff,
        "lateStaff": late_staff,
        "leaveStaff": leave_staff,
        "lastUpdated": chrono::Local::now().format("%H:%M").to_string(),
    }))
}

#[tauri::command]
fn get_daily_reports(
    state: State<'_, AppState>,
    from_date: String,
    to_date: String,
    dept: Option<String>,
    search: Option<String>,
    branch_id: Option<i64>,
    gate_id: Option<i64>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // RBAC check
    let (u_role, u_branch) = {
        let r = state.current_user_role.lock().map_err(lock_err)?.clone();
        let b = state.current_user_branch_id.lock().map_err(lock_err)?.clone();
        (r, b)
    };
    
    // If Admin, force branch_id filter
    let active_branch_id = if u_role == Some("ADMIN".to_string()) || u_role == Some("OPERATOR".to_string()) {
        if u_branch.is_some() { u_branch } else { branch_id }
    } else {
        branch_id
    };

    let mut stmt = conn.prepare("
        SELECT 
            e.id, 
            e.name, 
            e.department, 
            SUBSTR(al.timestamp, 1, 10) as date,
            MIN(al.timestamp) as check_in,
            MAX(al.timestamp) as check_out,
            b.name as branch_name,
            g.name as gate_name
        FROM AttendanceLogs al
        JOIN Employees e ON al.employee_id = e.id
        JOIN Branches b ON al.branch_id = b.id
        JOIN Gates g ON al.gate_id = g.id
        WHERE SUBSTR(al.timestamp, 1, 10) BETWEEN ?1 AND ?2
        AND (?3 = 'All' OR e.department = ?3)
        AND (?4 = '' OR e.name LIKE ?4)
        AND (?5 IS NULL OR al.branch_id = ?5)
        AND (?6 IS NULL OR al.gate_id = ?6)
        GROUP BY e.id, date
        ORDER BY date DESC, e.name ASC
    ")?;

    let dept_param = dept.unwrap_or_else(|| "All".to_string());
    let search_param = if let Some(s) = search { format!("%{}%", s) } else { "".to_string() };

    let rows = stmt.query_map(params![from_date, to_date, dept_param, search_param, active_branch_id, gate_id], |row| {
        let check_in: String = row.get(4)?;
        let check_out: String = row.get(5)?;
        
        let mut late = "No".to_string();
        let mut early = "No".to_string();
        let mut wh = "00:00".to_string();
        
        if check_in != check_out && check_in.len() >= 16 && check_out.len() >= 16 {
            let start = chrono::NaiveDateTime::parse_from_str(&check_in, "%Y-%m-%d %H:%M:%S").ok();
            let end = chrono::NaiveDateTime::parse_from_str(&check_out, "%Y-%m-%d %H:%M:%S").ok();
            
            if let (Some(s), Some(e)) = (start, end) {
                let duration = e.signed_duration_since(s);
                let h = duration.num_hours();
                let m = duration.num_minutes() % 60;
                wh = format!("{:02}:{:02}", h, m);
                
                let in_time = &check_in[11..16];
                let out_time = &check_out[11..16];
                if in_time > "09:15" { late = "Yes".into(); }
                if out_time < "17:30" { early = "Yes".into(); }
            }
        }
        
        let status = if check_in == check_out { "Single" } else { 
            if late == "Yes" { "Late" } else { "On-time" }
        };
        
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, String>(2)?,
            "date": row.get::<_, String>(3)?,
            "check_in": check_in,
            "check_out": check_out,
            "status": status,
            "late_entry": late,
            "early_exit": early,
            "working_hours": wh
        }))
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_raw_logs(
    state: State<'_, AppState>,
    from_date: String,
    to_date: String,
    search: Option<String>,
    branch_id: Option<i64>,
    gate_id: Option<i64>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("
        SELECT 
            al.id, 
            e.name, 
            al.timestamp, 
            al.log_type, 
            d.name as device
        FROM AttendanceLogs al
        JOIN Employees e ON al.employee_id = e.id
        JOIN Devices d ON al.device_id = d.id
        WHERE SUBSTR(al.timestamp, 1, 10) BETWEEN ?1 AND ?2
        AND (?3 = '' OR e.name LIKE ?3)
        AND (?4 IS NULL OR al.branch_id = ?4)
        AND (?5 IS NULL OR al.gate_id = ?5)
        ORDER BY al.timestamp DESC
    ")?;

    let search_param = if let Some(s) = search { format!("%{}%", s) } else { "".to_string() };

    let rows = stmt.query_map(params![from_date, to_date, search_param, branch_id, gate_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "timestamp": row.get::<_, String>(2)?,
            "type": row.get::<_, Option<String>>(3)?,
            "device": row.get::<_, String>(4)?,
        }))
    })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_departments(state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT DISTINCT department FROM Employees WHERE department IS NOT NULL AND department != ''")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    let mut depts: Vec<String> = rows.filter_map(|r| r.ok()).collect();
    depts.insert(0, "All".to_string());
    Ok(depts)
}

#[tauri::command]
fn get_monthly_summary(
    state: State<'_, AppState>,
    year_month: String,
    dept: Option<String>,
    search: Option<String>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("
        SELECT id, name, department FROM Employees
        WHERE (?1 = 'All' OR department = ?1)
        AND (?2 = '' OR name LIKE ?2)
    ")?;

    let dept_param = dept.unwrap_or_else(|| "All".to_string());
    let search_param = if let Some(s) = search { format!("%{}%", s) } else { "".to_string() };

    let employees = stmt.query_map(params![dept_param, search_param], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    })?;

    let mut report = Vec::new();
    let month_pattern = format!("{}%", year_month);

    for emp in employees {
        let (id, name, dept) = emp?;
        
        let present: i32 = conn.query_row(
            "SELECT COUNT(DISTINCT SUBSTR(timestamp, 1, 10)) FROM AttendanceLogs 
             WHERE employee_id = ?1 AND timestamp LIKE ?2",
            params![id, month_pattern],
            |row| row.get(0)
        ).unwrap_or(0);

        let leaves: i32 = conn.query_row(
            "SELECT COUNT(*) FROM LeaveRequests 
             WHERE employee_id = ?1 AND (SUBSTR(start_date, 1, 7) = ?2 OR SUBSTR(end_date, 1, 7) = ?2) AND status = 'approved'",
            params![id, year_month],
            |row| row.get(0)
        ).unwrap_or(0);
        
        report.push(serde_json::json!({
            "id": id,
            "name": name,
            "department": dept,
            "present": present,
            "leaves": leaves,
        }));
    }

    Ok(report)
}

#[tauri::command]
fn get_monthly_ledger(
    state: State<'_, AppState>,
    year_month: String,
    branch_id: Option<i64>,
    gate_id: Option<i64>,
    dept: Option<String>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut emp_stmt = conn.prepare("
        SELECT id, name FROM Employees 
        WHERE (?1 IS NULL OR branch_id = ?1)
        AND (?2 = 'All' OR department = ?2)
    ")?;
    let employees = emp_stmt.query_map(params![branch_id, dept.unwrap_or_else(|| "All".to_string())], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?.filter_map(|r| r.ok()).collect::<Vec<_>>();

    let mut ledger = Vec::new();
    let month_pattern = format!("{}%", year_month);

    for (id, name) in employees {
        let mut days = serde_json::Map::new();
        let mut att_stmt = conn.prepare("
            SELECT DISTINCT SUBSTR(timestamp, 1, 10) FROM AttendanceLogs 
            WHERE employee_id = ?1 AND timestamp LIKE ?2
            AND (?3 IS NULL OR branch_id = ?3)
            AND (?4 IS NULL OR gate_id = ?4)
        ")?;
        let att_dates = att_stmt.query_map(params![id, month_pattern, branch_id, gate_id], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok()).collect::<Vec<_>>();

        for date in att_dates {
            days.insert(date[8..].to_string(), serde_json::json!("P"));
        }
        
        ledger.push(serde_json::json!({
            "id": id,
            "name": name,
            "attendance": days
        }));
    }

    Ok(serde_json::json!(ledger))
}

#[tauri::command]
fn get_salary_sheet(
    state: State<'_, AppState>,
    year_month: String,
    branch_id: Option<i64>,
    gate_id: Option<i64>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut emp_stmt = conn.prepare("SELECT id, name, department FROM Employees WHERE (?1 IS NULL OR branch_id = ?1)")?;
    let employees = emp_stmt.query_map(params![branch_id], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    })?.filter_map(|r| r.ok()).collect::<Vec<_>>();

    let mut report = Vec::new();
    let month_pattern = format!("{}%", year_month);

    for (id, name, dept) in employees {
        let present: i32 = conn.query_row(
            "SELECT COUNT(DISTINCT SUBSTR(timestamp, 1, 10)) FROM AttendanceLogs 
             WHERE employee_id = ?1 AND timestamp LIKE ?2
             AND (?3 IS NULL OR branch_id = ?3)
             AND (?4 IS NULL OR gate_id = ?4)",
            params![id, month_pattern, branch_id, gate_id],
            |row| row.get(0)
        ).unwrap_or(0);

        let leaves: i32 = conn.query_row(
            "SELECT COUNT(*) FROM LeaveRequests 
             WHERE employee_id = ?1 AND (SUBSTR(start_date, 1, 7) = ?2 OR SUBSTR(end_date, 1, 7) = ?2) AND status = 'approved'",
            params![id, year_month],
            |row| row.get(0)
        ).unwrap_or(0);

        report.push(serde_json::json!({
            "id": id,
            "name": name,
            "department": dept,
            "present_days": present,
            "paid_leaves": leaves,
            "payable_days": present + leaves
        }));
    }

    Ok(report)
}

#[tauri::command]
fn list_branches(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name FROM Branches")?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
        }))
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
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
            current_user_id:     Mutex::new(None),
            current_user_role:   Mutex::new(None),
            current_user_branch_id: Mutex::new(None),
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

            // Seed default Master PIN ("admin123") on first run if not set
            let pin_path = app_dir.join("master.pin");
            if !pin_path.exists() {
                let default_hash = {
                    let mut h = sha2::Sha256::new();
                    sha2::Digest::update(&mut h, b"BioBridgeMasterPIN::admin123");
                    format!("{:x}", sha2::Digest::finalize(h))
                };
                let _ = fs::write(&pin_path, default_hash);
            }

            // AUTO-RESTART ENGINE FIX: Ensure User's specific device is set as Default
            // Based on PHOTO update: IP is now 192.168.192.200
            let _ = conn.execute(
                "UPDATE Devices SET machine_number = 11, is_default = 1 WHERE ip_address = '192.168.192.200'",
                []
            );

            // Start ADMS Listener
            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_adms_listener(h).await;
            });

            // Real-Time Event Listener & Retry Worker
            let app_handle = app.handle().clone();
            app_handle.clone().listen("realtime-punch", move |event| {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                    let employee_id = payload["employee_id"].as_i64().unwrap_or(0) as i32;
                    let device_id = payload["device_id"].as_i64().unwrap_or(1) as i32;
                    let timestamp = payload["timestamp"].as_str().unwrap_or("").to_string();
                    let punch_method = payload["punch_method"].as_str().unwrap_or("Finger/Face").to_string();
                    
                    let inner_app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = process_log_and_sync(employee_id, device_id, timestamp, punch_method, inner_app).await;
                    });
                }
            });

            // Retry Worker (Every 10 seconds)
            let retry_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                    let unsynced_logs: Vec<(i32, i32, String, String)> = {
                        let state = retry_app.state::<AppState>();
                        let db_guard = state.db.lock().unwrap();
                        if let Some(conn) = db_guard.as_ref() {
                            let mut stmt = conn.prepare("SELECT employee_id, device_id, timestamp, IFNULL(punch_method, 'Finger/Face') FROM AttendanceLogs WHERE is_synced = 0 LIMIT 50").unwrap();
                            stmt.query_map([], |row| {
                                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                            }).unwrap().filter_map(|r| r.ok()).collect()
                        } else {
                            vec![]
                        }
                    };
                    
                    for (emp_id, dev_id, ts, pm) in unsynced_logs {
                         let _ = process_log_and_sync(emp_id, dev_id, ts, pm, retry_app.clone()).await;
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
            get_device_users,
            scan_network,
            get_dashboard_stats,
            test_device_connection,
            add_device,
            save_device_config,
            delete_device,
            get_active_devices,
            list_all_devices,
            start_realtime_sync,
            stop_realtime_sync,
            set_master_pin,
            verify_master_pin,
            is_master_pin_set,
            get_daily_reports,
            get_raw_logs,
            get_departments,
            get_monthly_summary,
            get_monthly_ledger,
            get_salary_sheet,
            add_branch,
            list_branches,
            add_gate,
            list_gates,
            login,
            logout,
            list_users,
            add_user,
            delete_user,
            change_password,
            list_employees,
            update_employee,
            delete_employee,
            set_default_device,
            check_port_conflict,
            import_hardware_files,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Bio Bridge Pro HR");
}

// ── Get Device Users (live staff count from hardware) ─────────────────────

#[tauri::command]
async fn get_device_users(
    ip: String, port: u16, comm_key: i32, machine_number: i32, brand: String,
) -> Result<serde_json::Value, AppError> {
    let parsed_brand = match brand.as_str() {
        "Hikvision" => DeviceBrand::Hikvision,
        "ZKTeco"    => DeviceBrand::ZKTeco,
        _           => DeviceBrand::Unknown,
    };
    let users = crate::hardware::get_all_user_info(&ip, port, comm_key, machine_number, parsed_brand).await
        .map_err(|e| AppError::ConnectionError(format!("Cannot reach {}:{} — {}", ip, port, e)))?;
    Ok(serde_json::json!({
        "count": users.len(),
        "users": users,
    }))
}

#[tauri::command]
fn list_employees(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    // RBAC: If ADMIN/OPERATOR, filter by branch
    let u_role = state.current_user_role.lock().map_err(lock_err)?.clone();
    let u_branch = state.current_user_branch_id.lock().map_err(lock_err)?.clone();
    
    let mut stmt = if u_role == Some("SUPER_ADMIN".to_string()) {
        conn.prepare("SELECT id, name, department, branch_id, status FROM Employees")?
    } else {
        conn.prepare("SELECT id, name, department, branch_id, status FROM Employees WHERE branch_id = ?1")?
    };

    let employees: Vec<serde_json::Value> = if u_role == Some("SUPER_ADMIN".to_string()) {
        stmt.query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i32>(0)?,
                "name": row.get::<_, String>(1)?,
                "department": row.get::<_, Option<String>>(2)?,
                "branch_id": row.get::<_, Option<i64>>(3)?,
                "status": row.get::<_, String>(4)?
            }))
        })?.filter_map(|r| r.ok()).collect()
    } else {
        stmt.query_map([u_branch], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i32>(0)?,
                "name": row.get::<_, String>(1)?,
                "department": row.get::<_, Option<String>>(2)?,
                "branch_id": row.get::<_, Option<i64>>(3)?,
                "status": row.get::<_, String>(4)?
            }))
        })?.filter_map(|r| r.ok()).collect()
    };
    
    Ok(serde_json::to_value(employees).unwrap())
}

#[tauri::command]
fn update_employee(id: i32, name: String, department: String, branch_id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    conn.execute(
        "UPDATE Employees SET name = ?1, department = ?2, branch_id = ?3 WHERE id = ?4",
        params![name, department, branch_id, id],
    )?;
    Ok(())
}

#[tauri::command]
fn delete_employee(id: i32, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    conn.execute("DELETE FROM Employees WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
fn login(username: String, password: String, state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    let user_res: Result<(i64, String, String, Option<i64>, i32), _> = conn.query_row(
        "SELECT id, password_hash, role, branch_id, must_change_password FROM Users WHERE username = ?1 AND is_active = 1",
        [username],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    );

    match user_res {
        Ok((id, hash, role, branch_id, must_change)) => {
            if bcrypt::verify(&password, &hash).unwrap_or(false) {
                *state.current_user_id.lock().map_err(lock_err)? = Some(id);
                *state.current_user_role.lock().map_err(lock_err)? = Some(role.clone());
                *state.current_user_branch_id.lock().map_err(lock_err)? = branch_id;
                
                Ok(serde_json::json!({
                    "id": id,
                    "role": role,
                    "branchId": branch_id,
                    "mustChangePassword": must_change == 1
                }))
            } else {
                Err(AppError::Unknown("Invalid username or password".into()))
            }
        },
        Err(_) => Err(AppError::Unknown("Invalid username or password".into()))
    }
}

#[tauri::command]
fn logout(state: State<'_, AppState>) -> Result<(), AppError> {
    *state.current_user_id.lock().map_err(lock_err)? = None;
    *state.current_user_role.lock().map_err(lock_err)? = None;
    *state.current_user_branch_id.lock().map_err(lock_err)? = None;
    Ok(())
}

#[tauri::command]
fn list_users(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    // Only Super Admin can list users
    if state.current_user_role.lock().map_err(lock_err)?.as_deref() != Some("SUPER_ADMIN") {
        return Err(AppError::Unknown("Unauthorized".into()));
    }
    
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    let mut stmt = conn.prepare("
        SELECT id, username, role, branch_id, is_active FROM Users
    ")?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "username": row.get::<_, String>(1)?,
            "role": row.get::<_, String>(2)?,
            "branchId": row.get::<_, Option<i64>>(3)?,
            "isActive": row.get::<_, i32>(4)? == 1
        }))
    })?;
    
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn add_user(username: String, password: String, role: String, branch_id: Option<i64>, state: State<'_, AppState>) -> Result<(), AppError> {
    if state.current_user_role.lock().map_err(lock_err)?.as_deref() != Some("SUPER_ADMIN") {
        return Err(AppError::Unknown("Unauthorized".into()));
    }
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    let hash = hash_password(&password);
    conn.execute(
        "INSERT INTO Users (username, password_hash, role, branch_id) VALUES (?1, ?2, ?3, ?4)",
        params![username, hash, role, branch_id],
    )?;
    Ok(())
}

#[tauri::command]
async fn import_hardware_files(
    user_path: String,
    log_path: String,
    device_id: i32,
    branch_id: i64,
    state: State<'_, AppState>,
) -> Result<String, AppError> {
    // 1. Parse Users
    let users = crate::hardware::dat_parser::parse_user_dat(&user_path)
        .map_err(|e| AppError::HardwareError(format!("Failed to parse user.dat: {}", e)))?;
    
    // 2. Parse Logs
    let logs = crate::hardware::dat_parser::parse_attlog_dat(&log_path, device_id)
        .map_err(|e| AppError::HardwareError(format!("Failed to parse attlog.dat: {}", e)))?;

    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // 3. Update Employees
    for u in &users {
        let _ = conn.execute(
            "INSERT INTO Employees (id, name, branch_id) VALUES (?1, ?2, ?3) \
             ON CONFLICT(id) DO UPDATE SET name = excluded.name",
            params![u.employee_id, u.name, branch_id],
        );
    }

    // 4. Update Logs
    for log in &logs {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced) VALUES (?1, ?2, 1, ?3, ?4, ?5, 0)",
            params![log.employee_id, branch_id, device_id, log.timestamp, log.punch_method],
        );
    }

    Ok(format!("Parsed {} users and {} logs from data files.", users.len(), logs.len()))
}

#[tauri::command]
fn delete_user(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    if state.current_user_role.lock().map_err(lock_err)?.as_deref() != Some("SUPER_ADMIN") {
        return Err(AppError::Unknown("Unauthorized".into()));
    }
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    conn.execute("DELETE FROM Users WHERE id = ?1", [id])?;
    Ok(())
}

// ── Master PIN Commands ────────────────────────────────────────────────────

fn pin_hash(pin: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("BioBridgeMasterPIN::{}", pin).as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_password(pass: &str) -> String {
    bcrypt::hash(pass, bcrypt::DEFAULT_COST).unwrap_or_default()
}

#[tauri::command]
fn change_password(new_password: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let user_id = state.current_user_id.lock().map_err(lock_err)?.ok_or_else(|| AppError::Unknown("Not logged in".into()))?;
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    
    let hash = hash_password(&new_password);
    conn.execute(
        "UPDATE Users SET password_hash = ?1, must_change_password = 0 WHERE id = ?2",
        params![hash, user_id],
    )?;
    Ok(())
}

#[tauri::command]
fn set_master_pin(app: AppHandle, current_pin: String, new_pin: String) -> Result<(), AppError> {
    let pin_path = app.path().app_data_dir().unwrap().join("master.pin");
    if pin_path.exists() {
        // Validate current PIN before changing
        let stored = fs::read_to_string(&pin_path)
            .map_err(|e| AppError::Unknown(format!("Failed to read PIN: {}", e)))?.trim().to_string();
        if stored != pin_hash(&current_pin) {
            return Err(AppError::Unknown("Current PIN is incorrect.".to_string()));
        }
    }
    fs::write(&pin_path, pin_hash(&new_pin))
        .map_err(|e| AppError::Unknown(format!("Failed to save PIN: {}", e)))?;
    Ok(())
}

#[tauri::command]
fn verify_master_pin(app: AppHandle, pin: String) -> Result<bool, AppError> {
    let pin_path = app.path().app_data_dir().unwrap().join("master.pin");
    if !pin_path.exists() { return Ok(false); }
    let stored = fs::read_to_string(&pin_path)
        .map_err(|e| AppError::Unknown(format!("Failed to read PIN: {}", e)))?.trim().to_string();
    Ok(stored == pin_hash(&pin))
}

#[tauri::command]
fn is_master_pin_set(app: AppHandle) -> bool {
    app.path().app_data_dir().unwrap().join("master.pin").exists()
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
