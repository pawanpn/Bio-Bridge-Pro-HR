use crate::errors::AppError;
use crate::hardware::{get_all_user_info, sync_device, test_device, push_user_info, pull_user_biometric};
use crate::models::DeviceBrand;
use crate::sync_service;
use crate::AppState;
use rusqlite::{params, OptionalExtension};
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use rand::{rngs::OsRng, RngCore};

fn generate_uuid_v4() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

fn read_json_str<'a>(value: &'a Value, keys: &[&str], default: &'a str) -> String {
    for key in keys {
        if let Some(val) = value.get(*key).and_then(|v| v.as_str()) {
            return val.to_string();
        }
    }
    default.to_string()
}

fn read_json_i64(value: &Value, keys: &[&str], default: i64) -> i64 {
    for key in keys {
        if let Some(val) = value.get(*key).and_then(|v| v.as_i64()) {
            return val;
        }
    }
    default
}

#[tauri::command]
pub async fn list_all_devices(
    branch_id: Option<i64>,
    state: tauri::State<'_, AppState>
) -> Result<Vec<Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT d.id, d.name, d.brand, d.ip_address, d.port, d.comm_key, d.machine_number, d.is_default, d.status,
                b.name as branch_name, g.name as gate_name, d.branch_id, d.gate_id,
                d.device_uuid, d.sync_status, d.last_modified, d.server_id
         FROM Devices d
         LEFT JOIN Branches b ON d.branch_id = b.id
         LEFT JOIN Gates g ON d.gate_id = g.id"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(bid) = branch_id {
        query.push_str(" WHERE d.branch_id = ?1");
        params_vec.push(Box::new(bid));
    }

    let mut stmt = conn.prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let devices: Vec<Value> = stmt
        .query_map(rusqlite::params_from_iter(params_vec), |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "brand": row.get::<_, String>(2)?,
                "ip": row.get::<_, String>(3)?,
                "port": row.get::<_, i32>(4)?,
                "comm_key": row.get::<_, i32>(5)?,
                "machine_number": row.get::<_, i32>(6)?,
                "is_default": row.get::<_, i32>(7)? != 0,
                "status": row.get::<_, String>(8)?,
                "branch_name": row.get::<_, Option<String>>(9)?,
                "gate_name": row.get::<_, Option<String>>(10)?,
                "branch_id": row.get::<_, Option<i64>>(11)?,
                "gate_id": row.get::<_, Option<i64>>(12)?,
                "device_uuid": row.get::<_, Option<String>>(13)?,
                "sync_status": row.get::<_, Option<String>>(14)?,
                "last_modified": row.get::<_, Option<String>>(15)?,
                "server_id": row.get::<_, Option<String>>(16)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(devices)
}

fn sanitize_filename_component(input: &str) -> String {
    input
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '.' | '-' | '_' => c,
            _ => '_',
        })
        .collect()
}

fn employee_documents_root(app_handle: &tauri::AppHandle) -> Result<PathBuf, AppError> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Unknown(format!("Unable to resolve app data directory: {}", e)))?;
    let docs_dir = app_dir.join("Employee_Documents");
    fs::create_dir_all(&docs_dir)
        .map_err(|e| AppError::DatabaseError(format!("Failed to create document folder: {}", e)))?;
    Ok(docs_dir)
}

#[tauri::command]
pub async fn import_device_employees(
    device_id: i64,
    branch_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let (ip, port, comm_key, machine_number, brand) = {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        let (ip, port, comm_key, machine_number, brand_str) = conn.query_row(
            "SELECT ip_address, port, comm_key, machine_number, brand FROM Devices WHERE id = ?1",
            params![device_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)? as u16,
                r.get::<_, i32>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, String>(4)?,
            )),
        ).map_err(|e| AppError::DatabaseError(format!("Device not found: {}", e)))?;

        let brand = match brand_str.as_str() {
            "ZKTeco" => DeviceBrand::ZKTeco,
            "Hikvision" => DeviceBrand::Hikvision,
            _ => DeviceBrand::Unknown,
        };

        (ip, port, comm_key, machine_number, brand)
    };

    let users = get_all_user_info(&ip, port, comm_key, machine_number, brand).await?;

    let mut imported = 0i64;
    let mut updated = 0i64;
    let mut skipped = 0i64;
    let mut error_details: Vec<String> = Vec::new();

    {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        for user in users {
            let code = user.employee_id.to_string();
            let existing_id: Option<i64> = conn
                .query_row(
                    "SELECT id FROM Employees WHERE biometric_id = ?1 OR employee_code = ?2",
                    params![user.employee_id, code],
                    |r| r.get(0),
                )
                .ok();

            if let Some(emp_id) = existing_id {
                let mut changed = false;
                if let Err(e) = conn.execute(
                    "UPDATE Employees SET name = CASE WHEN name LIKE 'User %' OR name = '' THEN ?1 ELSE name END,
                     first_name = CASE WHEN first_name IS NULL OR first_name = '' THEN ?1 ELSE first_name END,
                     biometric_id = ?2,
                     branch_id = COALESCE(branch_id, ?3),
                     updated_at = datetime('now')
                     WHERE id = ?4",
                    params![user.name, user.employee_id, branch_id, emp_id],
                ) {
                    error_details.push(format!("Update failed for {}: {}", user.employee_id, e));
                } else {
                    changed = true;
                }

                if changed {
                    updated += 1;
                } else {
                    skipped += 1;
                }
                continue;
            }

            let res = conn.execute(
                "INSERT INTO Employees (name, first_name, employee_code, biometric_id, branch_id, employment_status, status, app_role)
                 VALUES (?1, ?2, ?3, ?4, ?5, 'Active', 'active', 'employee')",
                params![user.name, user.name, code, user.employee_id, branch_id],
            );

            match res {
                Ok(_) => {
                    imported += 1;
                    let new_id = conn.last_insert_rowid();
                    let _ = sync_service::_queue_for_sync(
                        conn,
                        "employees",
                        "INSERT",
                        &new_id.to_string(),
                        &json!({
                            "name": user.name,
                            "employee_code": user.employee_id.to_string(),
                            "biometric_id": user.employee_id,
                            "branch_id": branch_id
                        }),
                        "HIGH",
                    );
                }
                Err(e) => {
                    skipped += 1;
                    error_details.push(format!("Insert failed for {}: {}", user.employee_id, e));
                }
            }
        }
    }

    Ok(json!({
        "success": true,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": error_details.len(),
        "error_details": error_details
    }))
}

#[tauri::command]
pub async fn set_local_sync_target(device_id: Option<i64>, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT OR REPLACE INTO ConfigSettings (key, value) VALUES ('default_device_id', ?1)",
        params![device_id.map(|id| id.to_string())],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to save setting: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn get_local_sync_target(state: tauri::State<'_, AppState>) -> Result<Option<i64>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let res: Result<String, _> = conn.query_row(
        "SELECT value FROM ConfigSettings WHERE key = 'default_device_id'",
        [],
        |r| r.get(0)
    );

    match res {
        Ok(val) => Ok(val.parse::<i64>().ok()),
        Err(_) => Ok(None)
    }
}

#[tauri::command]
pub async fn test_device_connection(
    ip: String,
    port: u16,
    comm_key: i32,
    machine_number: i32,
    brand: String,
) -> Result<(), AppError> {
    let dev_brand = match brand.as_str() {
        "ZKTeco" => DeviceBrand::ZKTeco,
        "Hikvision" => DeviceBrand::Hikvision,
        _ => DeviceBrand::Unknown,
    };

    test_device(&ip, port, comm_key, machine_number, dev_brand).await
}

#[tauri::command]
pub async fn add_device(device: Value, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let device_uuid = read_json_str(&device, &["device_uuid", "deviceUuid"], "");
    let device_uuid = if device_uuid.is_empty() { generate_uuid_v4() } else { device_uuid };
    let last_modified = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO Devices (device_uuid, name, brand, ip_address, port, comm_key, machine_number, branch_id, gate_id, status, sync_status, last_modified)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'offline', 'pending', ?10)",
        params![
            device_uuid,
            read_json_str(&device, &["name"], "New Device"),
            read_json_str(&device, &["brand"], "ZKTeco"),
            read_json_str(&device, &["ip", "ip_address"], ""),
            read_json_i64(&device, &["port"], 4370) as i32,
            read_json_i64(&device, &["comm_key", "commKey"], 0) as i32,
            read_json_i64(&device, &["machine_number", "machineNumber"], 1) as i32,
            read_json_i64(&device, &["branch_id", "branchId"], 1),
            read_json_i64(&device, &["gate_id", "gateId"], 1),
            last_modified,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to add device: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn register_new_device(device: Value, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    add_device(device, state).await
}

#[tauri::command]
pub async fn update_device(
    id: i64,
    device: Value,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Devices SET name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, machine_number=?6, branch_id=?7, gate_id=?8, sync_status='modified', last_modified=?9 WHERE id=?10",
        params![
            read_json_str(&device, &["name"], ""),
            read_json_str(&device, &["brand"], "ZKTeco"),
            read_json_str(&device, &["ip", "ip_address"], ""),
            read_json_i64(&device, &["port"], 4370) as i32,
            read_json_i64(&device, &["comm_key", "commKey"], 0) as i32,
            read_json_i64(&device, &["machine_number", "machineNumber"], 1) as i32,
            read_json_i64(&device, &["branch_id", "branchId"], 1),
            read_json_i64(&device, &["gate_id", "gateId"], 1),
            chrono::Utc::now().to_rfc3339(),
            id
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to update device: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_device(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Cascade: AttendanceLogs -> Devices
    conn.execute("PRAGMA foreign_keys = OFF", [])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE device_id = ?1", params![id])?;
    conn.execute("DELETE FROM Devices WHERE id = ?1", params![id])?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(())
}

#[tauri::command]
pub async fn set_default_device(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("UPDATE Devices SET is_default = 0", [])?;
    conn.execute(
        "UPDATE Devices SET is_default = 1 WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub async fn sync_device_logs(
    ip: String,
    port: u16,
    device_id: i32,
    brand: String,
    target_branch_id: i64,
    target_gate_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let dev_brand = match brand.as_str() {
        "ZKTeco" => DeviceBrand::ZKTeco,
        "Hikvision" => DeviceBrand::Hikvision,
        _ => DeviceBrand::Unknown,
    };

    println!(
        "Backend Preview: Syncing logs from {} ({}) to Branch {}",
        ip, brand, target_branch_id
    );

    let (device_users, logs) = sync_device(&ip, port, 0, device_id, 1, dev_brand, None).await?;

    println!(
        "Backend Preview: Pulled {} users, {} logs",
        device_users.len(),
        logs.len()
    );
    for log in &logs {
        println!("  Log: Employee {} at {}", log.employee_id, log.timestamp);
    }

    // Automatically save to DB
    {
        let db_guard = state
            .db
            .lock()
            .map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard
            .as_ref()
            .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        // 2. FORCE SYNC EMPLOYEES: Ensure every user from device exists in local DB
        for u in &device_users {
            // Check if exists by biometric_id or employee_code
            let existing_id: Option<i64> = conn
                .query_row(
                    "SELECT id FROM Employees WHERE biometric_id = ?1 OR employee_code = ?2",
                    params![u.employee_id, u.employee_id.to_string()],
                    |r| r.get(0),
                )
                .ok();

            if let Some(eid) = existing_id {
                // Update name if it's currently a generic one or empty, and ensure biometric_id is set
                let _ = conn.execute(
                    "UPDATE Employees SET name = ?1, biometric_id = ?3 WHERE id = ?2 AND (name LIKE 'User %' OR name = '')",
                    params![&u.name, eid, u.employee_id]
                );
            } else {
                // Create new employee and assign to branch. Make sure employee_code is robustly inserted.
                let insert_res = conn.execute(
                    "INSERT INTO Employees (name, employee_code, biometric_id, branch_id, status, employment_status) 
                     VALUES (?1, ?2, ?3, ?4, 'active', 'Permanent')",
                    params![&u.name, &u.employee_id.to_string(), u.employee_id, target_branch_id],
                );

                if let Ok(_) = insert_res {
                    // Queue for Supabase Sync
                    let new_id = conn.last_insert_rowid();
                    let _ = crate::sync_service::_queue_for_sync(
                        conn,
                        "Employees",
                        "INSERT",
                        &new_id.to_string(),
                        &serde_json::json!({"name": &u.name, "employee_code": u.employee_id.to_string(), "biometric_id": u.employee_id}),
                        "HIGH",
                    );
                } else {
                    println!("Warning: Failed to insert new employee {} from device. Perhaps employee_code is conflicting?", u.employee_id);
                }
            }
        }

        // 3. CAPTURE LOGS: Link to correct local IDs and queue for cloud
        for log in &logs {
            let display_name = device_users
                .iter()
                .find(|u| u.employee_id == log.employee_id)
                .map(|u| u.name.as_str());
            let employee_row_id = crate::crud::ensure_attendance_employee_exists(
                conn,
                log.employee_id as i64,
                display_name,
                Some(target_branch_id),
            )?;

            let res = conn.execute(
                "INSERT OR IGNORE INTO AttendanceLogs (employee_id, device_user_id, timestamp, device_id, branch_id, gate_id, punch_method)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![employee_row_id, log.employee_id as i64, log.timestamp, log.device_id, target_branch_id, target_gate_id, log.punch_method],
            );

            if let Ok(affected) = res {
                if affected > 0 {
                    let log_id = conn.last_insert_rowid();
                    // Queue for Supabase Sync
                    let _ = crate::sync_service::_queue_for_sync(
                        conn,
                            "AttendanceLogs",
                            "INSERT",
                            &log_id.to_string(),
                            &serde_json::json!({
                                "employee_id": employee_row_id,
                                "device_user_id": log.employee_id,
                                "timestamp": log.timestamp,
                                "device_id": log.device_id,
                                "punch_method": log.punch_method
                            }),
                            "MEDIUM",
                    );
                }
            }
        }
    }

    let mut ui_logs = Vec::new();
    for log in &logs {
        let name = device_users
            .iter()
            .find(|u| u.employee_id == log.employee_id)
            .map(|u| u.name.clone())
            .unwrap_or_else(|| format!("User {}", log.employee_id));

        ui_logs.push(serde_json::json!({
            "employee_id": log.employee_id,
            "employee_name": name,
            "timestamp": log.timestamp.clone(),
            "punch_method": log.punch_method.clone(),
            "device_id": log.device_id
        }));
    }

    // Sort by timestamp DESC (Latest first)
    ui_logs.sort_by(|a, b| {
        let a_ts = a["timestamp"].as_str().unwrap_or("");
        let b_ts = b["timestamp"].as_str().unwrap_or("");
        b_ts.cmp(a_ts)
    });

    Ok(serde_json::json!(ui_logs))
}

#[tauri::command]
pub async fn fetch_attendance_from_device(
    ip: String,
    port: u16,
    device_id: i32,
    brand: String,
    target_branch_id: i64,
    target_gate_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    sync_device_logs(
        ip,
        port,
        device_id,
        brand,
        target_branch_id,
        target_gate_id,
        state,
    )
    .await
}

#[tauri::command]
pub async fn get_unmapped_logs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT e.id, e.device_user_id, e.name, e.employee_code, e.branch_id, b.name as branch_name,
                COUNT(al.id) as log_count, MAX(al.timestamp) as last_seen, e.sync_status
         FROM Employees e
         LEFT JOIN AttendanceLogs al ON al.employee_id = e.id
         LEFT JOIN Branches b ON e.branch_id = b.id
         WHERE e.device_user_id IS NOT NULL
           AND (e.sync_status = 'placeholder' OR e.name LIKE 'Unknown ID %' OR e.name LIKE 'User %')
         GROUP BY e.id, e.device_user_id, e.name, e.employee_code, e.branch_id, b.name, e.sync_status
         ORDER BY last_seen DESC, e.id DESC",
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "device_user_id": row.get::<_, Option<i64>>(1)?,
                "name": row.get::<_, String>(2)?,
                "employee_code": row.get::<_, Option<String>>(3)?,
                "branch_id": row.get::<_, Option<i64>>(4)?,
                "branch_name": row.get::<_, Option<String>>(5)?,
                "log_count": row.get::<_, i64>(6)?,
                "last_seen": row.get::<_, Option<String>>(7)?,
                "sync_status": row.get::<_, Option<String>>(8)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
pub async fn assign_name_to_id(
    device_user_id: i64,
    name: String,
    employee_id: Option<i64>,
    branch_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let clean_name = name.trim().to_string();
    let final_name = if clean_name.is_empty() {
        format!("Employee {}", device_user_id)
    } else {
        clean_name
    };
    let branch = branch_id.unwrap_or(1);

    let placeholder_employee_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM Employees WHERE device_user_id = ?1 AND (sync_status = 'placeholder' OR name LIKE 'Unknown ID %' OR name LIKE 'User %') ORDER BY id DESC LIMIT 1",
            params![device_user_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::DatabaseError(format!("Lookup failed: {}", e)))?;

    let resolved_employee_id = if let Some(target_id) = employee_id {
        conn.execute(
            "UPDATE Employees
             SET device_user_id = ?1,
                 name = CASE WHEN name IS NULL OR TRIM(name) = '' OR name LIKE 'User %' OR name LIKE 'Unknown ID %' THEN ?2 ELSE name END,
                 sync_status = 'active',
                 branch_id = COALESCE(branch_id, ?3),
                 updated_at = datetime('now')
             WHERE id = ?4",
            params![device_user_id, final_name, branch, target_id],
        ).map_err(|e| AppError::DatabaseError(format!("Employee update failed: {}", e)))?;

        if let Some(placeholder_id) = placeholder_employee_id {
            if placeholder_id != target_id {
                conn.execute(
                    "UPDATE AttendanceLogs SET employee_id = ?1 WHERE employee_id = ?2",
                    params![target_id, placeholder_id],
                ).ok();
                conn.execute("DELETE FROM Employees WHERE id = ?1", params![placeholder_id]).ok();
            }
        }
        target_id
    } else if let Some(placeholder_id) = placeholder_employee_id {
        conn.execute(
            "UPDATE Employees
             SET name = ?1,
                 sync_status = 'active',
                 branch_id = COALESCE(branch_id, ?2),
                 updated_at = datetime('now')
             WHERE id = ?3",
            params![final_name, branch, placeholder_id],
        ).map_err(|e| AppError::DatabaseError(format!("Employee rename failed: {}", e)))?;
        placeholder_id
    } else {
        let employee_uuid = generate_uuid_v4();
        conn.execute(
            "INSERT INTO Employees (
                employee_uuid, name, first_name, last_name, employee_code, biometric_id, device_user_id,
                branch_id, employment_status, status, app_role, sync_status, last_modified, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Active', 'active', 'employee', 'active', datetime('now'), datetime('now'), datetime('now'))",
            params![
                employee_uuid,
                final_name.clone(),
                final_name.clone(),
                "",
                device_user_id.to_string(),
                device_user_id,
                device_user_id,
                branch,
            ],
        ).map_err(|e| AppError::DatabaseError(format!("Employee create failed: {}", e)))?;
        conn.last_insert_rowid()
    };

    Ok(json!({
        "success": true,
        "employee_id": resolved_employee_id,
        "device_user_id": device_user_id,
        "name": final_name,
        "branch_id": branch,
    }))
}

#[tauri::command]
pub async fn pull_all_logs(
    ip: String,
    port: u16,
    device_id: i32,
    brand: String,
    target_branch_id: i64,
    target_gate_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    sync_device_logs(
        ip,
        port,
        device_id,
        brand,
        target_branch_id,
        target_gate_id,
        state,
    )
    .await
}

#[tauri::command]
pub async fn list_gates(
    branch_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let (query, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = match branch_id {
        Some(bid) => (
            "SELECT id, name, branch_id FROM Gates WHERE branch_id = ?1".to_string(),
            vec![Box::new(bid)],
        ),
        None => ("SELECT id, name, branch_id FROM Gates".to_string(), vec![]),
    };

    let mut stmt = conn.prepare(&query)?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let gates: Vec<Value> = stmt
        .query_map(&param_refs[..], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "branch_id": row.get::<_, i64>(2)?
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(gates)
}

#[tauri::command]
pub async fn list_employees_for_select(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, employee_code, name, department, first_name, last_name
         FROM Employees
         WHERE status != 'deleted'",
    )?;
    let employees: Vec<Value> = stmt
        .query_map([], |row| {
            let first_name = row.get::<_, Option<String>>(4)?.unwrap_or_default();
            let last_name = row.get::<_, Option<String>>(5)?.unwrap_or_default();
            let display_name = if !first_name.is_empty() || !last_name.is_empty() {
                format!("{} {}", first_name, last_name).trim().to_string()
            } else {
                row.get::<_, String>(2)?
            };
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "employee_code": row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                "name": display_name,
                "department": row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "N/A".to_string())
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(employees)
}

#[tauri::command]
pub async fn list_employee_documents(
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, employee_id, doc_type, doc_name, cloud_file_id, valid_until, email_alert, alert_before_days, upload_date
         FROM EmployeeDocuments
         WHERE employee_id = ?1
         ORDER BY datetime(upload_date) DESC, id DESC",
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let docs: Vec<Value> = stmt
        .query_map(params![employee_id], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "employee_id": row.get::<_, i64>(1)?,
                "type": row.get::<_, Option<String>>(2)?.unwrap_or_else(|| "Document".to_string()),
                "name": row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                "cloudId": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                "valid_until": row.get::<_, Option<String>>(5)?,
                "email_alert": row.get::<_, Option<i32>>(6)?.unwrap_or(0) != 0,
                "alert_before_days": row.get::<_, Option<i32>>(7)?.unwrap_or(0),
                "date": row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(docs)
}

#[tauri::command]
pub async fn upload_employee_document(
    employee_id: i64,
    doc_type: String,
    file_name: String,
    file_bytes: Vec<u8>,
    valid_until: Option<String>,
    email_alert: Option<bool>,
    alert_before_days: Option<i32>,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let employee_exists: Option<i64> = conn
        .query_row(
            "SELECT id FROM Employees WHERE id = ?1 AND (status IS NULL OR status != 'deleted')",
            params![employee_id],
            |r| r.get(0),
        )
        .ok();

    if employee_exists.is_none() {
        return Err(AppError::NotFound("Employee not found".into()));
    }

    let docs_root = employee_documents_root(&app_handle)?;
    let employee_dir = docs_root.join(format!("employee_{}", employee_id));
    fs::create_dir_all(&employee_dir)
        .map_err(|e| AppError::DatabaseError(format!("Failed to create employee document folder: {}", e)))?;

    let stored_name = format!(
        "emp{}_{}_{}",
        employee_id,
        chrono::Utc::now().timestamp_millis(),
        sanitize_filename_component(&file_name)
    );
    let file_path = employee_dir.join(&stored_name);

    fs::write(&file_path, &file_bytes)
        .map_err(|e| AppError::DatabaseError(format!("Failed to save document: {}", e)))?;

    conn.execute(
        "INSERT INTO EmployeeDocuments (employee_id, doc_type, doc_name, cloud_file_id, valid_until, email_alert, alert_before_days, upload_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            employee_id,
            doc_type,
            file_name,
            stored_name,
            valid_until,
            email_alert.unwrap_or(false) as i32,
            alert_before_days.unwrap_or(0),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to record document: {}", e)))?;

    Ok(json!({
        "success": true,
        "message": "Document uploaded successfully"
    }))
}

#[tauri::command]
pub async fn get_document_preview(
    doc_name: String,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<u8>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let doc_row: Option<(i64, String)> = conn
        .query_row(
            "SELECT employee_id, COALESCE(cloud_file_id, doc_name) FROM EmployeeDocuments WHERE cloud_file_id = ?1 OR doc_name = ?1 ORDER BY id DESC LIMIT 1",
            params![doc_name],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    let (employee_id, stored_name) = doc_row.ok_or_else(|| AppError::NotFound("Document not found".into()))?;
    let docs_root = employee_documents_root(&app_handle)?;
    let file_path = docs_root.join(format!("employee_{}", employee_id)).join(stored_name);

    fs::read(&file_path).map_err(|e| AppError::DatabaseError(format!("Failed to read document: {}", e)))
}

#[tauri::command]
pub async fn delete_employee_document(
    document_id: i64,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let doc: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT employee_id, cloud_file_id FROM EmployeeDocuments WHERE id = ?1",
            params![document_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    let (employee_id, stored_name) = doc.ok_or_else(|| AppError::NotFound("Document not found".into()))?;
    let docs_root = employee_documents_root(&app_handle)?;
    if let Some(name) = stored_name {
        let file_path = docs_root.join(format!("employee_{}", employee_id)).join(name);
        let _ = fs::remove_file(file_path);
    }

    conn.execute("DELETE FROM EmployeeDocuments WHERE id = ?1", params![document_id])
        .map_err(|e| AppError::DatabaseError(format!("Failed to delete document: {}", e)))?;

    Ok(json!({
        "success": true,
        "message": "Document deleted successfully"
    }))
}

#[tauri::command]
pub async fn add_manual_attendance(
    employee_id: i64,
    timestamp: String,
    punch_method: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let employee_row_id = crate::crud::ensure_attendance_employee_exists(conn, employee_id, None, Some(1))?;

    conn.execute(
        "INSERT INTO AttendanceLogs (employee_id, device_user_id, timestamp, punch_method, branch_id, gate_id, device_id)
         VALUES (?1, NULL, ?2, ?3, 1, 1, 999)",
        params![employee_row_id, timestamp, punch_method],
    )
    .map_err(|e| AppError::DatabaseError(format!("Failed to add manual log: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn import_csv_attendance(
    csv_content: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut imported = 0;
    let mut skipped = 0;
    let mut errors = Vec::new();

    for line in csv_content.lines() {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 2 {
            let emp_id = parts[0].trim().parse::<i64>();
            let timestamp = parts[1].trim();
            let method = parts.get(2).unwrap_or(&"Manual").trim();

            match emp_id {
                Ok(id) => {
                    let employee_row_id = crate::crud::ensure_attendance_employee_exists(conn, id, None, Some(1))?;
                    let res = conn.execute(
                        "INSERT OR IGNORE INTO AttendanceLogs (employee_id, device_user_id, timestamp, punch_method, branch_id, gate_id, device_id)
                         VALUES (?1, NULL, ?2, ?3, 1, 1, 999)",
                        params![employee_row_id, timestamp, method],
                    );
                    match res {
                        Ok(1) => imported += 1,
                        Ok(_) => skipped += 1,
                        Err(e) => errors.push(format!("Row {}: {}", line, e)),
                    }
                }
                Err(_) => errors.push(format!("Invalid ID: {}", parts[0])),
            }
        }
    }

    Ok(json!({
        "imported": imported,
        "skipped": skipped,
        "errors": errors
    }))
}

#[tauri::command]
pub async fn get_system_configs(
    category: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt =
        conn.prepare("SELECT key, value, category FROM SystemConfigs WHERE category = ?1")?;
    let configs: Vec<Value> = stmt
        .query_map([category], |row| {
            Ok(json!({
                "setting_key": row.get::<_, String>(0)?,
                "setting_value": row.get::<_, Option<String>>(1)?,
                "category": row.get::<_, String>(2)?,
                "setting_type": "string",
                "description": "",
                "is_public": true
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(configs)
}

#[tauri::command]
pub async fn get_all_system_configs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("SELECT key, value, category FROM SystemConfigs")?;
    let configs: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "setting_key": row.get::<_, String>(0)?,
                "setting_value": row.get::<_, Option<String>>(1)?,
                "category": row.get::<_, String>(2)?,
                "setting_type": "string",
                "description": "",
                "is_public": true
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(configs)
}

#[tauri::command]
pub async fn save_system_config(
    category: String,
    key: String,
    value: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO SystemConfigs (category, key, value) VALUES (?1, ?2, ?3)
         ON CONFLICT(category, key) DO UPDATE SET value = excluded.value",
        params![category, key, value],
    )?;

    // Queue for Cloud Sync
    let payload = json!({
        "category": category,
        "setting_key": key,
        "setting_value": value,
        "setting_type": "string"
    });
    let _ =
        sync_service::_queue_for_sync(conn, "system_settings", "UPDATE", &key, &payload, "MEDIUM");

    Ok(())
}

#[tauri::command]
pub async fn delete_system_config(
    category: String,
    key: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "DELETE FROM SystemConfigs WHERE category = ?1 AND key = ?2",
        params![category, key],
    )?;

    Ok(())
}

#[tauri::command]
pub async fn scan_network(_base_ip: String) -> Result<(), AppError> {
    // Placeholder for network scanning logic
    Ok(())
}

#[tauri::command]
pub async fn add_branch(
    name: String,
    location: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Default org_id = 1 for now
    conn.execute(
        "INSERT INTO Branches (org_id, name, location) VALUES (1, ?1, ?2)",
        params![name, location],
    )?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn update_branch(
    id: i64,
    name: String,
    location: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Branches SET name = ?1, location = ?2 WHERE id = ?3",
        params![name, location, id],
    )?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn delete_branch(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Cascade: AttendanceLogs -> Devices -> Gates -> Branch
    conn.execute("PRAGMA foreign_keys = OFF", [])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE branch_id = ?1", params![id])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE device_id IN (SELECT id FROM Devices WHERE branch_id = ?1)", params![id])?;
    conn.execute("DELETE FROM Devices WHERE branch_id = ?1", params![id])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE gate_id IN (SELECT id FROM Gates WHERE branch_id = ?1)", params![id])?;
    conn.execute("DELETE FROM Gates WHERE branch_id = ?1", params![id])?;
    conn.execute("DELETE FROM Branches WHERE id = ?1", params![id])?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(())
}

#[tauri::command]
pub async fn add_gate(
    branch_id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO Gates (branch_id, name) VALUES (?1, ?2)",
        params![branch_id, name],
    )?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn update_gate(
    id: i64,
    branch_id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Gates SET branch_id = ?1, name = ?2 WHERE id = ?3",
        params![branch_id, name, id],
    )?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn delete_gate(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Cascade: AttendanceLogs -> Devices -> Gate
    conn.execute("PRAGMA foreign_keys = OFF", [])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE gate_id = ?1", params![id])?;
    conn.execute("DELETE FROM AttendanceLogs WHERE device_id IN (SELECT id FROM Devices WHERE gate_id = ?1)", params![id])?;
    conn.execute("DELETE FROM Devices WHERE gate_id = ?1", params![id])?;
    conn.execute("DELETE FROM Gates WHERE id = ?1", params![id])?;
    conn.execute("PRAGMA foreign_keys = ON", [])?;
    Ok(())
}
#[tauri::command]
pub async fn push_employee_to_device(
    device_id: i64,
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let (ip, port, comm_key, machine_number, brand, bio_id, full_name, role, card_no) = {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        // 1. Fetch Device Info
        let (ip, port, comm_key, machine_number, brand_str) = conn.query_row(
            "SELECT ip_address, port, comm_key, machine_number, brand FROM Devices WHERE id = ?1",
            params![device_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)? as u16,
                r.get::<_, i32>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, String>(4)?
            ))
        ).map_err(|e| AppError::DatabaseError(format!("Device not found: {}", e)))?;

        let brand = match brand_str.as_str() {
            "ZKTeco" => DeviceBrand::ZKTeco,
            "Hikvision" => DeviceBrand::Hikvision,
            _ => DeviceBrand::Unknown,
        };

        // 2. Fetch Employee Info
        let (biometric_id, first_name, last_name, card_no, privilege) = conn.query_row(
            "SELECT biometric_id, first_name, last_name, card_no, device_privilege FROM Employees WHERE id = ?1",
            params![employee_id],
            |r| Ok((
                r.get::<_, Option<i32>>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, Option<String>>(3)?,
                r.get::<_, Option<String>>(4)?
            ))
        ).map_err(|e| AppError::DatabaseError(format!("Employee not found: {}", e)))?;

        let bio_id = biometric_id.ok_or_else(|| AppError::ValidationError("Employee does not have a Biometric ID assigned".into()))?;
        let full_name = format!("{} {}", first_name, last_name).trim().to_string();
        
        let role = match privilege.as_deref() {
            Some("Normal User") => 0,
            Some("Registrar") => 1,
            Some("Admin") => 2,
            Some("Super Admin") => 3,
            _ => 0
        };

        (ip, port, comm_key, machine_number, brand, bio_id, full_name, role, card_no.unwrap_or_default())
    }; // MutexGuard is dropped here

    // 3. Push to Device
    push_user_info(
        &ip, 
        port, 
        comm_key, 
        machine_number, 
        brand, 
        bio_id, 
        &full_name, 
        role, 
        &card_no
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn pull_employee_biometric(
    device_id: i64,
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let (ip, port, comm_key, machine_number, brand, bio_id) = {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        // 1. Fetch Device Info
        let (ip, port, comm_key, machine_number, brand_str) = conn.query_row(
            "SELECT ip_address, port, comm_key, machine_number, brand FROM Devices WHERE id = ?1",
            params![device_id],
            |r| Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i32>(1)? as u16,
                r.get::<_, i32>(2)?,
                r.get::<_, i32>(3)?,
                r.get::<_, String>(4)?
            ))
        ).map_err(|e| AppError::DatabaseError(format!("Device not found: {}", e)))?;

        let brand = match brand_str.as_str() {
            "ZKTeco" => DeviceBrand::ZKTeco,
            "Hikvision" => DeviceBrand::Hikvision,
            _ => DeviceBrand::Unknown,
        };

        // 2. Fetch Employee Biometric ID
        let biometric_id: Option<i32> = conn.query_row(
            "SELECT biometric_id FROM Employees WHERE id = ?1",
            params![employee_id],
            |r| r.get(0)
        ).map_err(|e| AppError::DatabaseError(format!("Employee not found: {}", e)))?;

        let bio_id = biometric_id.ok_or_else(|| AppError::ValidationError("Employee does not have a Biometric ID assigned".into()))?;
        (ip, port, comm_key, machine_number, brand, bio_id)
    };

    // 3. Pull from Device
    let bio_data = pull_user_biometric(
        &ip, 
        port, 
        comm_key, 
        machine_number, 
        brand, 
        bio_id
    ).await?;

    Ok(bio_data)
}
