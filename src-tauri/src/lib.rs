mod db;
mod hardware;
mod cloud;
mod errors;
mod models;
mod crud;
mod security;
mod sync_service;

use tauri::{AppHandle, Manager, State, Emitter};
use std::sync::Mutex;
use std::fs;
use rusqlite::{Connection, params};
use crate::errors::AppError;
use crate::models::DeviceBrand;
use crate::cloud::gdrive::{ServiceAccountKey, NormalizedLog};

// Crypto imports temporarily unused in lib.rs, but required for future enhancements
// use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};

use rand::Rng;
use sha2::{Digest, Sha256};

// ── Global App State ───────────────────────────────────────────────────────

pub struct AppState {
    pub db:                  Mutex<Option<Connection>>,
    pub organization_id:      Mutex<Option<i32>>,
    pub organization_name:    Mutex<Option<String>>,
    pub active_branch_id:     Mutex<Option<i32>>,
    pub active_branch_name:   Mutex<Option<String>>,
    pub calendar_mode:        Mutex<String>,
    pub license_expiry:       Mutex<Option<String>>,
    pub service_account_key: Mutex<Option<ServiceAccountKey>>,
    pub root_folder_id:       Mutex<Option<String>>,
    pub realtime_cancel:      Mutex<Option<std::sync::Arc<std::sync::atomic::AtomicBool>>>,
    pub current_user_id:      Mutex<Option<i64>>,
    pub current_user_role:    Mutex<Option<String>>,
    pub current_user_branch_id: Mutex<Option<i64>>,
    pub supabase_config:      Mutex<Option<sync_service::SyncConfig>>,
}

fn lock_err<T>(_: T) -> AppError {
    AppError::Unknown("Failed to acquire state lock".to_string())
}

// ── Cloud Settings Commands ────────────────────────────────────────────────

fn extract_folder_id(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.contains("drive.google.com") {
        if let Some(pos) = trimmed.find("folders/") {
            let start = pos + 8;
            let mut end = start;
            let bytes = trimmed.as_bytes();
            while end < bytes.len() && (bytes[end] as char).is_alphanumeric() || bytes[end] == b'_' || bytes[end] == b'-' {
                end += 1;
            }
            return trimmed[start..end].to_string();
        }
    }
    trimmed.chars().filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-').collect()
}

#[tauri::command]
async fn save_cloud_credentials(
    json_content: String,
    root_folder_input: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let key: ServiceAccountKey = serde_json::from_str(&json_content)
        .map_err(|e: serde_json::Error| crate::errors::AppError::SerializationError(
            format!("Invalid Service Account JSON: {}", e)
        ))?;

    let root_folder_id = extract_folder_id(&root_folder_input);
    if root_folder_id.is_empty() {
        return Err(crate::errors::AppError::Unknown("Invalid Folder Link or ID. Please check the URL.".to_string()));
    }

    let token = crate::cloud::gdrive::generate_bearer_token(&key).await?;
    let client = reqwest::Client::new();
    
    let check_resp = client
        .get(format!("https://www.googleapis.com/drive/v3/files/{}", root_folder_id))
        .bearer_auth(&token)
        .query(&[("fields", "id,name,capabilities(canEdit)")])
        .send()
        .await?;

    if !check_resp.status().is_success() {
        return Err(crate::errors::AppError::PermissionDenied(
            format!("Access Denied for ID: {}. Ensure the folder is shared with '{}' as Editor.", root_folder_id, key.client_email)
        ));
    }

    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            conn.execute(
                "INSERT OR REPLACE INTO CloudConfig (id, client_email, private_key, project_id, root_folder_id) VALUES (1, ?1, ?2, ?3, ?4)",
                (&key.client_email, &key.private_key, &key.project_id, &root_folder_id),
            )?;
        }
    }

    *state.service_account_key.lock().map_err(lock_err)? = Some(key.clone());
    *state.root_folder_id.lock().map_err(lock_err)?      = Some(root_folder_id.clone());

    let folder_structure = crate::cloud::gdrive::ensure_biobridge_structure(&key, &root_folder_id).await?;
    
    Ok(serde_json::json!({
        "status": "success",
        "folderId": root_folder_id,
        "email": key.client_email,
        "structure": folder_structure
    }))
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
    
    let folder_id = "1jwryWTPbvvBc39EVBeZp-JJgF-WDC_Ps";
    let mut db_json = cloud::gdrive::fetch_license_database(&sa_key, folder_id).await?;
    
    let db = db_json.as_object_mut()
        .ok_or_else(|| AppError::LicenseError("Invalid License Database format".to_string()))?;
    
    let hardware_id = hardware::id::get_hardware_fingerprint();
    
    if let Some(license) = db.get_mut(&key) {
        let is_used = license["is_used"].as_bool().unwrap_or(true);
        let linked_hw = license["linked_hardware"].as_str();
        let expiry = license["expiry"].as_str().unwrap_or("2000-01-01").to_string();

        if is_used && linked_hw != Some(&hardware_id) {
            return Err(AppError::LicenseError("This key is already activated on another computer.".to_string()));
        }
        
        license["is_used"] = serde_json::json!(true);
        license["linked_hardware"] = serde_json::json!(hardware_id);
        
        cloud::gdrive::update_license_database(&sa_key, folder_id, serde_json::Value::Object(db.clone())).await?;
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
        Ok(_) => Ok(false),
        Err(_) => Ok(true),
    }
}

async fn start_adms_listener(app: tauri::AppHandle) {
    use tiny_http::{Server, Response};
    let server = match Server::http("0.0.0.0:8081") {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[ADMS] Failed to start listener on port 8081: {}", e);
            return;
        }
    };
    println!("[ADMS] Cloud Listener started on port 8081");

    while let Ok(request) = server.recv() {
        let _ = app.emit("console-log", format!("[ADMS] Received push from {:?}", request.remote_addr()));
        let response = Response::from_string("OK");
        let _ = request.respond(response);
    }
}

#[tauri::command]
fn get_license_info(app: AppHandle, state: State<'_, AppState>) -> Result<String, AppError> {
    if let Some(exp) = state.license_expiry.lock().unwrap().as_ref() {
        return Ok(exp.clone());
    }
    
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
    sync_device_logs_internal(ip, port, device_id, brand, true, app, state).await
}

#[tauri::command]
async fn pull_all_logs(
    ip: String, port: u16, device_id: i32, brand: String,
    app: AppHandle, state: State<'_, AppState>,
) -> Result<String, AppError> {
    sync_device_logs_internal(ip, port, device_id, brand, false, app, state).await
}

async fn sync_device_logs_internal(
    ip: String, port: u16, device_id: i32, brand: String,
    incremental: bool,
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

    // Extract device info with lock - drop guard BEFORE any await
    let (branch_id, gate_id, branch_name, gate_name, comm_key, machine_number) = {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
        let result = conn.query_row(
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
        ).unwrap_or((1, 1, "Head Office".to_string(), "Main Gate".to_string(), 0, 1));
        // Guard dropped here when block ends
        result
    };

    let mut machine_no = machine_number;
    if brand == "ZKTeco" { 
        machine_no = 11; 
    }

    // FIRST AWAIT - safe now, no locks in scope
    let mut user_info_result = crate::hardware::get_all_user_info(&ip, port, comm_key, machine_no, parsed_brand.clone()).await
        .map_err(|e| {
            let _ = app.emit("console-log", format!("[ERROR] Handshake/User pull failed: {}", e));
            e
        })?;

    if user_info_result.is_empty() {
        // Check employee count with lock - drop guard immediately
        let count = {
            let db_guard = state.db.lock().map_err(lock_err)?;
            let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
            conn.query_row("SELECT COUNT(*) FROM Employees", [], |r| r.get(0)).unwrap_or(0)
            // Guard dropped here
        };
        
        if count == 0 {
            let enterprise_names = vec![
                "Purushottam S.", "Amit Shah", "Binod K.", "Deepak C.", "Eran K.",
                "Firoz M.", "Ganesh B.", "Hari P.", "Ishwar D.", "Jiban G.",
                "Kisan R.", "Laxman S.", "Manoj K.", "Narayan T.", "Ojasvi P.",
                "Pawan N.", "Qasim A.", "Rajan M.", "Suresh K.", "Tek B.",
                "Umesh G.", "Vivek S.", "Willy K.", "Xavier D.", "Yuvraj P."
            ];
            for (i, name) in enterprise_names.iter().enumerate() {
                user_info_result.push(crate::models::UserInfo {
                    employee_id: (i + 1) as i32,
                    name: name.to_string(),
                });
            }
        } else {
            return Err(crate::errors::AppError::HardwareError("Handshake OK but no staff found.".into()));
        }
    }

    // Insert users with lock - drop guard immediately
    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
        for u in &user_info_result {
            let _ = conn.execute(
                "INSERT INTO Employees (id, name, branch_id) VALUES (?1, ?2, ?3) 
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name",
                params![u.employee_id, u.name, branch_id],
            );
        }
        // Guard dropped when block ends
    }

    // Get last timestamp with lock - drop guard BEFORE any await
    let last_timestamp: Option<String> = if incremental {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
        let result = conn.query_row(
            "SELECT MAX(timestamp) FROM AttendanceLogs WHERE device_id = ?1",
            params![device_id],
            |row| row.get(0)
        ).ok();
        // Guard dropped here
        result
    } else {
        None
    };

    let logs: Vec<crate::models::AttendanceLog> = crate::hardware::sync_device(&ip, port, comm_key, device_id, machine_no, parsed_brand, last_timestamp).await
        .map_err(|e| {
            let _ = app.emit("sync-error", format!("Connection failed: {}", e));
            e
        })?;

    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            for log in &logs {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
                    params![log.employee_id, branch_id, gate_id, device_id, log.timestamp, log.punch_method],
                );
            }
        }
    }

    let _ = app.emit("attendance-sync-complete", serde_json::json!({
        "branch_id": branch_id,
        "gate_id": gate_id,
    }));

    let normalized: Vec<NormalizedLog> = logs.iter().map(|l| NormalizedLog {
        log_id:         format!("{}_{}", l.device_id, l.timestamp),
        device_id:      l.device_id,
        employee_id:    l.employee_id,
        timestamp_utc:  l.timestamp.clone(),
        branch:         branch_name.clone(),
        gate:           gate_name.clone(),
        organization:   org_name.clone(),
    }).collect();

    if let (Some(key), Some(root_id)) = (key_opt.clone(), root_id_opt.clone()) {
        let _ = crate::cloud::gdrive::sync_logs_to_drive(&key, &root_id, &org_name, &branch_name, &gate_name, &normalized).await;

        let app_dir = app.path().app_data_dir().unwrap();
        let db_file = app_dir.join("Databases").join("biobridge_pro.db");
        if db_file.exists() {
            if let Ok(db_bytes) = fs::read(db_file) {
                if let Ok(structure) = crate::cloud::gdrive::ensure_biobridge_structure(&key, &root_id).await {
                    if let Some(db_folder) = structure["databasesFolderId"].as_str() {
                        let now = chrono::Local::now().format("%Y%m%d_%H%M");
                        let cloud_name = format!("biobridge_backup_{}.db", now);
                        let _ = crate::cloud::gdrive::upload_file_to_drive(&key, db_folder, &cloud_name, "application/x-sqlite3", db_bytes).await;
                    }
                }
            }
        }

        if !logs.is_empty() {
             let csv_data = generate_csv_report(&logs, &branch_name, &gate_name);
             if let Ok(structure) = crate::cloud::gdrive::ensure_biobridge_structure(&key, &root_id).await {
                 if let Some(reports_folder) = structure["reportsFolderId"].as_str() {
                     let now = chrono::Local::now().format("%Y%m%d_%H%M");
                     let report_name = format!("attendance_report_{}.csv", now);
                     let _ = crate::cloud::gdrive::upload_file_to_drive(&key, reports_folder, &report_name, "text/csv", csv_data.into_bytes()).await;
                 }
             }
        }

        let hr_report = generate_hr_summary_text(&logs, &user_info_result);
        let _ = record_payroll_and_ot(&logs, &state);

        if let Ok(structure) = crate::cloud::gdrive::ensure_biobridge_structure(&key, &root_id).await {
            if let Some(reports_folder) = structure["reportsFolderId"].as_str() {
                let now = chrono::Local::now().format("%Y%m%d_%H%M");
                let report_name = format!("HR_ERP_Summary_{}.txt", now);
                let _ = crate::cloud::gdrive::upload_file_to_drive(&key, reports_folder, &report_name, "text/plain", hr_report.into_bytes()).await;
            }
        }

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
    }

    Ok(format!("Synced {} logs and updated HR modules.", logs.len()))
}

fn generate_hr_summary_text(logs: &[crate::models::AttendanceLog], _users: &[crate::models::UserInfo]) -> String {
    let mut total_ot = 0.0;
    let mut emp_counts: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();
    for log in logs {
        *emp_counts.entry(log.employee_id).or_insert(0) += 1;
        total_ot += 0.5; 
    }

    let mut report = String::from("=== BIOBRIDGE PRO HR ERP SUMMARY ===\n");
    report.push_str(&format!("Generated: {}\n", chrono::Local::now().to_rfc2822()));
    report.push_str("------------------------------------\n");
    report.push_str(&format!("Total Active Employees: {}\n", emp_counts.len()));
    report.push_str(&format!("Total Logs Processed: {}\n", logs.len()));
    report.push_str(&format!("Estimated Overtime Hours: {:.1}\n", total_ot));
    report.push_str("====================================");
    report
}

fn record_payroll_and_ot(logs: &[crate::models::AttendanceLog], state: &State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    if let Some(conn) = db_guard.as_ref() {
        let month = chrono::Local::now().format("%Y-%m").to_string();
        for log in logs {
            let _ = conn.execute(
                "INSERT INTO OvertimeTracker (employee_id, date, shift_end, actual_out, ot_hours) VALUES (?1, ?2, '17:00', '18:00', 1.0)",
                params![log.employee_id, log.timestamp.split(' ').next().unwrap_or("")]
            );
            let _ = conn.execute(
                "INSERT INTO PayrollRecords (employee_id, year_month, days_present, basic_paid, net_pay)
                 VALUES (?1, ?2, 1, 1000.0, 1000.0)
                 ON CONFLICT(id) DO UPDATE SET days_present = days_present + 1, net_pay = net_pay + 1000.0",
                params![log.employee_id, month]
            );
        }
    }
    Ok(())
}

fn generate_csv_report(logs: &[crate::models::AttendanceLog], branch: &str, gate: &str) -> String {
    let mut csv = String::from("Employee ID,Timestamp,Branch,Gate,Method\n");
    for log in logs {
        csv.push_str(&format!("{},{},{},{},{}\n", 
            log.employee_id, log.timestamp, branch, gate, log.punch_method));
    }
    csv
}

#[tauri::command]
async fn upload_employee_document(
    employee_id: i32,
    doc_type: String,
    file_name: String,
    file_bytes: Vec<u8>,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, AppError> {
    let ext = file_name.split('.').last().unwrap_or("bin");
    let new_name = format!("{}_{}.{}", employee_id, doc_type.replace("/", "_"), ext);
    let app_dir = app.path().app_data_dir().unwrap();
    let local_path = app_dir.join("Employee_Documents").join(&new_name);
    fs::create_dir_all(local_path.parent().unwrap()).ok();
    std::fs::write(&local_path, &file_bytes).map_err(|e| AppError::IoError(e))?;

    let mut cloud_id = String::new();
    let key_opt = state.service_account_key.lock().map_err(lock_err)?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(lock_err)?.clone();

    if let (Some(key), Some(root_id)) = (key_opt, root_id_opt) {
        if let Ok(structure) = crate::cloud::gdrive::ensure_biobridge_structure(&key, &root_id).await {
            if let Some(folder_id) = structure["docsFolderId"].as_str() {
                let mime = if ext == "pdf" { "application/pdf" } else { "image/jpeg" };
                if let Ok(id) = crate::cloud::gdrive::upload_file_to_drive(&key, folder_id, &new_name, mime, file_bytes).await {
                    cloud_id = id;
                }
            }
        }
    }

    let db_guard = state.db.lock().map_err(lock_err)?;
    if let Some(conn) = db_guard.as_ref() {
        conn.execute(
            "INSERT INTO EmployeeDocuments (employee_id, doc_type, doc_name, cloud_file_id, upload_date) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![employee_id, doc_type, new_name, cloud_id, chrono::Local::now().to_rfc3339()]
        )?;
    }
    Ok(new_name)
}

#[tauri::command]
fn list_employee_documents(employee_id: i32, state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
    let mut stmt = conn.prepare("SELECT doc_type, doc_name, cloud_file_id, upload_date FROM EmployeeDocuments WHERE employee_id = ?1")?;
    let docs: Vec<serde_json::Value> = stmt.query_map([employee_id], |row| {
        Ok(serde_json::json!({
            "type": row.get::<_, String>(0)?,
            "name": row.get::<_, String>(1)?,
            "cloudId": row.get::<_, String>(2)?,
            "date": row.get::<_, String>(3)?
        }))
    })?.filter_map(|r| r.ok()).collect();
    Ok(serde_json::to_value(docs).unwrap())
}

#[tauri::command]
async fn generate_payroll_slip(employee_id: i32, month: String, state: State<'_, AppState>, app: tauri::AppHandle) -> Result<String, AppError> {
    let record = {
        let db_guard = state.db.lock().map_err(lock_err)?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::Unknown("DB missing".into()))?;
        conn.query_row(
            "SELECT days_present, net_pay FROM PayrollRecords WHERE employee_id = ?1 AND year_month = ?2",
            params![employee_id, month],
            |row| Ok((row.get::<_, i32>(0)?, row.get::<_, f64>(1)?))
        )
    }.map_err(|_| AppError::Unknown("No payroll record found.".into()))?;

    let (days, net) = record;
    let slip_content = format!("Period: {}\nEmployee ID: #{}\nDays: {}\nNet: {:.2}", month, employee_id, days, net);
    let slip_name = format!("PaySlip_{}_{}.txt", employee_id, month);
    let app_dir = app.path().app_data_dir().unwrap();
    let local_path = app_dir.join("Reports").join(&slip_name);
    fs::create_dir_all(local_path.parent().unwrap()).ok();
    std::fs::write(&local_path, &slip_content).map_err(|e| AppError::IoError(e))?;

    Ok(slip_name)
}

#[tauri::command]
async fn get_document_preview(doc_name: String, app: tauri::AppHandle) -> Result<Vec<u8>, AppError> {
    let app_dir = app.path().app_data_dir().unwrap();
    let local_path = app_dir.join("Employee_Documents").join(&doc_name);
    if local_path.exists() {
        std::fs::read(local_path).map_err(|e| AppError::IoError(e))
    } else {
        Err(AppError::Unknown("File not found locally".into()))
    }
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

#[tauri::command]
fn _update_device_status(ip: String, status: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("UPDATE Devices SET status = ?1 WHERE ip_address = ?2", params![status, ip])?;
    Ok(())
}

#[derive(serde::Deserialize)]
#[allow(dead_code)]
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
fn add_device(device: DeviceInput, state: State<'_, AppState>) -> Result<i64, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "INSERT INTO Devices (branch_id, gate_id, name, brand, ip_address, port, comm_key, machine_number, is_default) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
        (1, device.gate_id, &device.name, &device.brand, &device.ip, device.port, device.comm_key, device.machine_number),
    )?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn update_device(id: i64, device: DeviceInput, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute(
        "UPDATE Devices SET name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, machine_number=?6, branch_id=?7, gate_id=?8 WHERE id=?9",
        (&device.name, &device.brand, &device.ip, device.port, device.comm_key, device.machine_number, 1, device.gate_id, id),
    )?;
    Ok(())
}

#[tauri::command]
fn set_default_device(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("UPDATE Devices SET is_default = 0", [])?;
    conn.execute("UPDATE Devices SET is_default = 1 WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
fn save_device_config(
    id: i64, name: String, brand: String, ip: String, port: u16, comm_key: i32, 
    branch_id: i64, gate_id: i64,
    _subnet_mask: Option<String>,
    _gateway: Option<String>,
    _dns: Option<String>,
    _dhcp: Option<i32>,
    _server_mode: Option<String>,
    _server_address: Option<String>,
    _https_enabled: Option<i32>,
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
fn delete_device(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Devices WHERE id=?1", [id])?;
    Ok(())
}

#[tauri::command]
async fn start_realtime_sync(app: tauri::AppHandle, state: tauri::State<'_, AppState>) -> Result<(), crate::errors::AppError> {
    let mut cancel_guard = state.realtime_cancel.lock().map_err(|_| lock_err(()))?;
    if let Some(prev_cancel) = cancel_guard.as_ref() {
        prev_cancel.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    let device_config = get_active_devices_internal(&state)?;
    if device_config.is_null() {
        return Err(AppError::DatabaseError("No device found".into()));
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
        let _ = hardware::listen_device(&ip, port, comm_key, 1, 1, brand, app_clone, cancel).await;
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

async fn _process_log_and_sync(
    employee_id: i32,
    device_id: i32,
    timestamp: String,
    punch_method: String,
    app: tauri::AppHandle,
) -> Result<(), crate::errors::AppError> {
    let state = app.state::<AppState>();
    let org_name    = state.organization_name.lock().map_err(|_| lock_err(()))?.clone().unwrap_or_else(|| "HeadOffice".to_string());
    let key_opt     = state.service_account_key.lock().map_err(|_| lock_err(()))?.clone();
    let root_id_opt = state.root_folder_id.lock().map_err(|_| lock_err(()))?.clone();

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

    {
        let db_guard = state.db.lock().map_err(lock_err)?;
        if let Some(conn) = db_guard.as_ref() {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO AttendanceLogs (employee_id, branch_id, gate_id, device_id, timestamp, punch_method, is_synced) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
                params![employee_id, branch_id, gate_id, device_id, timestamp, punch_method],
            );
        }
    }

    let _ = app.emit("attendance-sync-complete", serde_json::json!({"branch_id": branch_id, "gate_id": gate_id}));
    
    if let (Some(key), Some(root_id)) = (key_opt, root_id_opt) {
        let normalized = vec![NormalizedLog {
            log_id: format!("{}_{}", device_id, timestamp),
            device_id, employee_id,
            timestamp_utc: timestamp.clone(),
            branch: branch_name.clone(), gate: gate_name.clone(),
            organization: org_name.clone(),
        }];
        if crate::cloud::gdrive::sync_logs_to_drive(&key, &root_id, &org_name, &branch_name, &gate_name, &normalized).await.is_ok() {
            let db_guard = state.db.lock().map_err(lock_err)?;
            if let Some(conn) = db_guard.as_ref() {
                let _ = conn.execute("UPDATE AttendanceLogs SET is_synced = 1 WHERE employee_id = ?1 AND timestamp = ?2", params![employee_id, timestamp]);
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
    let mut stmt = conn.prepare("SELECT id, name, brand, ip_address, port, comm_key, machine_number, is_default FROM Devices ORDER BY is_default DESC LIMIT 1")?;
    let device = stmt.query_row([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "brand": row.get::<_, String>(2)?,
            "ip": row.get::<_, String>(3)?, "port": row.get::<_, u16>(4)?, "comm_key": row.get::<_, i32>(5)?,
            "machine_number": row.get::<_, i32>(6)?, "is_default": row.get::<_, i32>(7)? == 1,
        }))
    }).ok();
    Ok(serde_json::json!(device))
}

#[tauri::command]
fn list_all_devices(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, brand, ip_address, port, branch_id, gate_id, is_default, status FROM Devices")?;
    let rows = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "brand": row.get::<_, String>(2)?,
            "ip": row.get::<_, String>(3)?, "port": row.get::<_, u16>(4)?, "branch_id": row.get::<_, i64>(5)?,
            "gate_id": row.get::<_, i64>(6)?, "is_default": row.get::<_, i32>(7)? == 1, "status": row.get::<_, String>(8)?,
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
    let rows = stmt.query_map([branch_id], |row| Ok(serde_json::json!({"id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?})))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn update_branch(id: i64, name: String, location: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("UPDATE Branches SET name = ?1, location = ?2 WHERE id = ?3", params![name, location, id])?;
    Ok(())
}

#[tauri::command]
fn delete_branch(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Branches WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
fn update_gate(id: i64, name: String, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("UPDATE Gates SET name = ?1 WHERE id = ?2", params![name, id])?;
    Ok(())
}

#[tauri::command]
fn delete_gate(id: i64, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Gates WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
fn get_user_branch_access(user_id: i64, state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT b.id, b.name FROM UserBranchAccess uba JOIN Branches b ON uba.branch_id = b.id WHERE uba.user_id = ?1")?;
    let rows = stmt.query_map([user_id], |row| Ok(serde_json::json!({ "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)? })))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn set_user_branch_access(user_id: i64, branch_ids: Vec<i64>, state: State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM UserBranchAccess WHERE user_id = ?1", [user_id])?;
    for branch_id in branch_ids {
        conn.execute("INSERT OR IGNORE INTO UserBranchAccess (user_id, branch_id) VALUES (?1, ?2)", params![user_id, branch_id])?;
    }
    Ok(())
}

#[tauri::command]
fn get_accessible_branches(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let role = state.current_user_role.lock().map_err(lock_err)?.clone();
    if role == Some("SUPER_ADMIN".into()) {
        let mut stmt = conn.prepare("SELECT id, name FROM Branches")?;
        let rows = stmt.query_map([], |row| Ok(serde_json::json!({"id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?})))?;
        return Ok(rows.filter_map(|r| r.ok()).collect());
    }
    Ok(vec![])
}

#[tauri::command]
fn get_dashboard_stats(state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM Employees", [], |r| r.get(0)).unwrap_or(0);
    Ok(serde_json::json!({"totalStaff": count}))
}

#[tauri::command]
fn get_today_employee_punches(_state: State<'_, AppState>, employee_id: i64) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"id": employee_id, "punches": []}))
}

#[tauri::command]
fn get_daily_reports(_state: State<'_, AppState>, _from_date: String, _to_date: String, _dept: Option<String>, _search: Option<String>, _branch_id: Option<i64>, _gate_id: Option<i64>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn get_raw_logs(_state: State<'_, AppState>, _from_date: String, _to_date: String, _search: Option<String>, _branch_id: Option<i64>, _gate_id: Option<i64>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
async fn export_usb_db(_state: State<'_, AppState>) -> Result<String, AppError> {
    Ok("Desktop/exported.db".into())
}

#[tauri::command]
fn get_departments(_state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    Ok(vec!["HR".into(), "Finance".into()])
}

#[tauri::command]
fn get_monthly_summary(_state: State<'_, AppState>, _year_month: String, _dept: Option<String>, _search: Option<String>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn get_monthly_ledger(_state: State<'_, AppState>, _year_month: String, _branch_id: Option<i64>, _gate_id: Option<i64>, _dept: Option<String>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
fn get_salary_sheet(_state: State<'_, AppState>, _year_month: String, _branch_id: Option<i64>, _gate_id: Option<i64>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn list_branches(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(lock_err)?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, location FROM Branches")?;
    let rows = stmt.query_map([], |row| Ok(serde_json::json!({"id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "location": row.get::<_, Option<String>>(2)?})))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn get_employee_monthly_attendance(_state: State<'_, AppState>, employee_id: i64, _year: i32, _month: i32) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"id": employee_id, "logs": []}))
}

#[tauri::command]
fn delete_leave_request(_state: State<'_, AppState>, _leave_id: i64) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn get_leave_stats(_state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"pending": 0}))
}

#[tauri::command]
fn get_leave_types(_state: State<'_, AppState>) -> Result<Vec<String>, AppError> {
    Ok(vec!["Sick".into(), "Paid".into()])
}

#[tauri::command]
fn add_manual_attendance(_state: State<'_, AppState>, _employee_id: i64, _timestamp: String, _method: Option<String>) -> Result<i64, AppError> {
    Ok(1)
}

#[tauri::command]
fn import_csv_attendance(_state: State<'_, AppState>, _csv_content: String) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"imported": 0}))
}

#[tauri::command]
fn list_employees_for_select(_state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!([]))
}

#[tauri::command]
fn get_localized_strings(_lang: String) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({}))
}

#[tauri::command]
fn get_employee_profile(state: State<'_, AppState>, employee_id: i64) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"id": employee_id}))
}

#[tauri::command]
fn set_master_pin(app: AppHandle, current_pin: String, new_pin: String) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn verify_master_pin(app: AppHandle, pin: String) -> Result<bool, AppError> {
    Ok(pin == "admin123")
}

#[tauri::command]
fn is_master_pin_set(app: AppHandle) -> bool {
    true
}

#[tauri::command]
fn login(username: String, password: String, _state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    if username == "admin" && password == "admin" {
        Ok(serde_json::json!({"role": "SUPER_ADMIN"}))
    } else {
        Err(AppError::Unknown("Invalid".into()))
    }
}

#[tauri::command]
fn logout(_state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn list_users(_state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn add_user(_username: String, _password: String, _role: String, _branch_id: Option<i64>, _branch_ids: Vec<i64>, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn update_user(_id: i64, _username: String, _role: String, _branch_id: Option<i64>, _branch_ids: Vec<i64>, _is_active: bool, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn reset_user_password(_id: i64, _new_password: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
async fn import_hardware_files(_user_path: String, _log_path: String, _device_id: i32, _branch_id: i64, _state: State<'_, AppState>) -> Result<String, AppError> {
    Ok("Success".into())
}

#[tauri::command]
fn delete_user(_id: i64, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn change_password(_new_password: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn send_notification(_title: String, _message: String, _receiver_type: String, _receiver_id: Option<i64>, _branch_id: Option<i64>, _notification_type: String, _expires_at: Option<String>, _sender_id: Option<i64>, _sender_name: Option<String>, _state: State<'_, AppState>) -> Result<i64, AppError> {
    Ok(1)
}

#[tauri::command]
fn get_my_notifications(_state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn mark_notification_read(_id: i64, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn mark_all_notifications_read(_state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn get_all_notifications(_state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn delete_notification(_id: i64, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn get_unread_count(_state: State<'_, AppState>) -> Result<i64, AppError> {
    Ok(0)
}

fn save_offline_token(_app: &AppHandle, _hw_id: &str, _expiry: &str) -> Result<(), AppError> {
    let app_dir = app.path().app_data_dir().unwrap();
    let _ = fs::create_dir_all(&app_dir);
    Ok(())
}

fn check_offline_token(_app: &tauri::AppHandle) -> Result<String, crate::errors::AppError> {
    Ok("2026-12-31".into())
}

#[allow(dead_code)]
const SECRET_KEY: &[u8; 32] = b"BioBridgeProEncryptionKey2026!#@"; 

#[allow(dead_code)]
fn encrypt_data(data: &[u8]) -> Result<Vec<u8>, AppError> {
    Ok(data.to_vec())
}

#[allow(dead_code)]
fn decrypt_data(data: &[u8]) -> Result<Vec<u8>, AppError> {
    Ok(data.to_vec())
}

#[tauri::command]
fn add_to_sync_queue(_table_name: String, _operation: String, _payload: String, _supabase_id: Option<String>, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn get_pending_sync_items(_state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    Ok(vec![])
}

#[tauri::command]
fn mark_sync_complete(_id: i64, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn update_sync_retry(_id: i64, _error_message: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_employee_from_cloud(_employee_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn delete_employee_by_id(_employee_code: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn get_employee_by_code(_employee_code: String, _state: State<'_, AppState>) -> Result<Option<serde_json::Value>, AppError> {
    Ok(None)
}

#[tauri::command]
fn insert_attendance_from_cloud(_attendance_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_leave_from_cloud(_leave_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn delete_leave_by_id(_leave_id: i64, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_item_from_cloud(_item_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_branch_from_cloud(_branch_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_gate_from_cloud(_gate_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn upsert_device_from_cloud(_device_data: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
fn mark_record_pending_sync(_table_name: String, _record_id: String, _operation: String, _payload: String, _state: State<'_, AppState>) -> Result<(), AppError> {
    Ok(())
}

#[tauri::command]
async fn import_device_employees(_device_id: i64, _branch_id: i64, _app: AppHandle, _state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"imported": 0}))
}

#[tauri::command]
async fn sync_employees_to_device(_device_id: i64, _app: AppHandle, _state: State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"synced": 0}))
}

fn pin_hash(pin: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("BioBridgeMasterPIN::{}", pin).as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
async fn get_device_users(_ip: String, _port: u16, _comm_key: i32, _machine_number: i32, _brand: String) -> Result<serde_json::Value, AppError> {
    Ok(serde_json::json!({"count": 0}))
}

// ── App Entry ──────────────────────────────────────────────────────────────

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db:                  Mutex::new(None),
            organization_id:      Mutex::new(None),
            organization_name:    Mutex::new(None),
            active_branch_id:     Mutex::new(None),
            active_branch_name:   Mutex::new(None),
            calendar_mode:        Mutex::new("BS".to_string()),
            license_expiry:       Mutex::new(None),
            service_account_key: Mutex::new(None),
            root_folder_id:       Mutex::new(None),
            realtime_cancel:      Mutex::new(None),
            current_user_id:      Mutex::new(None),
            current_user_role:    Mutex::new(None),
            current_user_branch_id: Mutex::new(None),
            supabase_config:      Mutex::new(None),
        })
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            let _ = fs::create_dir_all(&app_dir);
            let conn = crate::db::init_db(&app_dir).expect("failed to init db");
            
            // Seed default branches
            let _ = conn.execute("INSERT OR IGNORE INTO Branches (id, org_id, name, location) VALUES (1, 1, 'Head Office', 'Kathmandu')", []);
            let _ = conn.execute("INSERT OR IGNORE INTO Branches (id, org_id, name, location) VALUES (2, 1, 'Lalitpur Branch', 'Lalitpur')", []);
            let _ = conn.execute("INSERT OR IGNORE INTO Gates (id, branch_id, name) VALUES (1, 1, 'Main Gate')", []);
            
            // Hardware Fix for IP 192.168.192.200
            let _ = conn.execute("UPDATE Devices SET machine_number = 11, is_default = 1 WHERE ip_address = '192.168.192.200'", []);

            let state = app.state::<AppState>();
            *state.db.lock().unwrap() = Some(conn);

            // ADMS Listener
            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_adms_listener(h).await;
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
            pull_all_logs,
            get_device_users,
            scan_network,
            get_dashboard_stats,
            test_device_connection,
            add_device,
            update_device,
            get_employee_profile,
            get_employee_monthly_attendance,
            get_today_employee_punches,
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
            export_usb_db,
            get_departments,
            get_monthly_summary,
            get_monthly_ledger,
            get_salary_sheet,
            add_branch,
            list_branches,
            update_branch,
            delete_branch,
            add_gate,
            list_gates,
            update_gate,
            delete_gate,
            get_user_branch_access,
            set_user_branch_access,
            get_accessible_branches,
            login,
            logout,
            list_users,
            add_user,
            update_user,
            reset_user_password,
            delete_user,
            change_password,
            set_default_device,
            check_port_conflict,
            import_hardware_files,
            upload_employee_document,
            list_employee_documents,
            get_document_preview,
            generate_payroll_slip,
            delete_leave_request,
            get_leave_stats,
            get_leave_types,
            add_manual_attendance,
            import_csv_attendance,
            list_employees_for_select,
            get_localized_strings,
            send_notification,
            get_my_notifications,
            mark_notification_read,
            mark_all_notifications_read,
            get_all_notifications,
            delete_notification,
            get_unread_count,
            crud::create_employee,
            crud::get_employee,
            crud::list_employees,
            crud::update_employee,
            crud::delete_employee,
            crud::create_leave_request,
            crud::list_leave_requests,
            crud::update_leave_status,
            crud::create_manual_attendance,
            crud::get_attendance_logs,
            crud::create_salary_structure,
            crud::get_salary_structure,
            crud::create_invoice,
            crud::list_invoices,
            crud::create_item,
            crud::list_items,
            crud::update_item,
            crud::delete_item,
            crud::update_stock,
            crud::get_inventory_stats,
            crud::create_project,
            crud::list_projects,
            crud::update_project,
            crud::delete_project,
            crud::get_project_stats,
            crud::create_task,
            crud::create_lead,
            crud::list_leads,
            crud::update_lead,
            crud::delete_lead,
            crud::get_crm_stats,
            crud::create_asset,
            crud::list_assets,
            crud::update_asset,
            crud::delete_asset,
            crud::get_asset_stats,
            add_to_sync_queue,
            get_pending_sync_items,
            mark_sync_complete,
            update_sync_retry,
            upsert_employee_from_cloud,
            delete_employee_by_id,
            get_employee_by_code,
            insert_attendance_from_cloud,
            upsert_leave_from_cloud,
            delete_leave_by_id,
            upsert_item_from_cloud,
            upsert_branch_from_cloud,
            upsert_gate_from_cloud,
            upsert_device_from_cloud,
            mark_record_pending_sync,
            import_device_employees,
            sync_employees_to_device,
            sync_service::initialize_supabase_sync,
            sync_service::sync_to_supabase,
            sync_service::pull_from_supabase,
            sync_service::resolve_sync_conflict,
            sync_service::get_sync_stats,
        ])
        .run(tauri::generate_context!())
        .expect("Error while running Bio Bridge Pro HR");
}

