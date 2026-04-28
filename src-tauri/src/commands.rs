use crate::errors::AppError;
use crate::hardware::{sync_device, test_device, push_user_info, pull_user_biometric};
use crate::models::DeviceBrand;
use crate::sync_service;
use crate::AppState;
use rusqlite::params;
use serde_json::{json, Value};

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
                b.name as branch_name, g.name as gate_name, d.branch_id, d.gate_id
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
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(devices)
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

    conn.execute(
        "INSERT INTO Devices (name, brand, ip_address, port, comm_key, machine_number, branch_id, gate_id, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'offline')",
        params![
            device["name"].as_str().unwrap_or("New Device"),
            device["brand"].as_str().unwrap_or("ZKTeco"),
            device["ip"].as_str().unwrap_or(""),
            device["port"].as_i64().unwrap_or(4370) as i32,
            device["comm_key"].as_i64().unwrap_or(0) as i32,
            device["machine_number"].as_i64().unwrap_or(1) as i32,
            device["branch_id"].as_i64(),
            device["gate_id"].as_i64(),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to add device: {}", e)))?;

    Ok(())
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
        "UPDATE Devices SET name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, machine_number=?6, branch_id=?7, gate_id=?8 WHERE id=?9",
        params![
            device["name"].as_str().unwrap_or(""),
            device["brand"].as_str().unwrap_or("ZKTeco"),
            device["ip"].as_str().unwrap_or(""),
            device["port"].as_i64().unwrap_or(4370) as i32,
            device["comm_key"].as_i64().unwrap_or(0) as i32,
            device["machine_number"].as_i64().unwrap_or(1) as i32,
            device["branch_id"].as_i64(),
            device["gate_id"].as_i64(),
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
            let local_id: Option<i64> = conn
                .query_row(
                    "SELECT id FROM Employees WHERE biometric_id = ?1",
                    params![log.employee_id],
                    |r| r.get(0),
                )
                .ok();

            if let Some(eid) = local_id {
                let res = conn.execute(
                    "INSERT OR IGNORE INTO AttendanceLogs (employee_id, timestamp, device_id, branch_id, gate_id, punch_method)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![eid, log.timestamp, log.device_id, target_branch_id, target_gate_id, log.punch_method],
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
                                "employee_id": eid,
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

    let mut stmt =
        conn.prepare("SELECT id, name, department FROM Employees WHERE status != 'deleted'")?;
    let employees: Vec<Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "department": row.get::<_, Option<String>>(2).unwrap_or(Some("N/A".to_string()))
            }))
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(employees)
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

    conn.execute(
        "INSERT INTO AttendanceLogs (employee_id, timestamp, punch_method, branch_id, gate_id, device_id)
         VALUES (?1, ?2, ?3, 1, 1, 999)",
        params![employee_id, timestamp, punch_method],
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
                    let res = conn.execute(
                        "INSERT OR IGNORE INTO AttendanceLogs (employee_id, timestamp, punch_method, branch_id, gate_id, device_id)
                         VALUES (?1, ?2, ?3, 1, 1, 999)",
                        params![id, timestamp, method],
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
    organization_id: i64,
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
        "INSERT INTO Branches (org_id, name, location) VALUES (?1, ?2, ?3)",
        params![organization_id, name, location],
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
