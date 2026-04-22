use crate::AppState;
use crate::errors::AppError;
use crate::models::{AttendanceLog, DeviceBrand};
use crate::hardware::{test_device, sync_device};
use crate::sync_service;
use rusqlite::params;
use serde_json::{Value, json};

#[tauri::command]
pub async fn list_all_devices(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT d.id, d.name, d.brand, d.ip_address, d.port, d.comm_key, d.machine_number, d.is_default, d.status,
                b.name as branch_name, g.name as gate_name, d.branch_id, d.gate_id
         FROM Devices d
         LEFT JOIN Branches b ON d.branch_id = b.id
         LEFT JOIN Gates g ON d.gate_id = g.id"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let devices: Vec<Value> = stmt.query_map([], |row| {
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
    }).map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(devices)
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
pub async fn add_device(
    device: Value,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO Devices (name, brand, ip_address, port, comm_key, machine_number, branch_id, gate_id, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'offline')",
        params![
            device["name"].as_str().unwrap_or("New Device"),
            device["brand"].as_str().unwrap_or("ZKTeco"),
            device["ip"].as_str().unwrap_or(""),
            device["port"].as_i64().unwrap_or(4370) as i32,
            device["commKey"].as_i64().unwrap_or(0) as i32,
            device["machineNumber"].as_i64().unwrap_or(1) as i32,
            device["branchId"].as_i64(),
            device["gateId"].as_i64(),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to add device: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn save_device_config(
    id: i64,
    name: String,
    brand: String,
    ip: String,
    port: i32,
    comm_key: i32,
    branch_id: i64,
    gate_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Devices SET name=?1, brand=?2, ip_address=?3, port=?4, comm_key=?5, branch_id=?6, gate_id=?7 WHERE id=?8",
        params![name, brand, ip, port, comm_key, branch_id, gate_id, id],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to update device: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_device(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("DELETE FROM Devices WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub async fn set_default_device(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("UPDATE Devices SET is_default = 0", [])?;
    conn.execute("UPDATE Devices SET is_default = 1 WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub async fn sync_device_logs(
    ip: String,
    port: u16,
    device_id: i32,
    brand: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let dev_brand = match brand.as_str() {
        "ZKTeco" => DeviceBrand::ZKTeco,
        "Hikvision" => DeviceBrand::Hikvision,
        _ => DeviceBrand::Unknown,
    };

    println!("Backend Preview: Syncing logs from {} ({})", ip, brand);
    
    let (device_users, logs) = sync_device(&ip, port, 0, device_id, 1, dev_brand, None).await?;
    
    println!("Backend Preview: Pulled {} users, {} logs", device_users.len(), logs.len());
    for log in &logs {
        println!("  Log: Employee {} at {}", log.employee_id, log.timestamp);
    }

    // Automatically save to DB
    {
        let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
        let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

        // First, explicitly auto-register fetched users from device into Employees table
        for u in device_users {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO Employees (
                    name, first_name, employee_code, biometric_id, 
                    department_id, designation_id, branch_id, status, employment_status
                 ) VALUES (?1, ?1, ?2, ?3, NULL, NULL, NULL, 'active', 'Permanent')",
                params![u.name, u.employee_id.to_string(), u.employee_id],
            );
        }

        for log in &logs {
            // Map biometric_id/deviceUserId to local Employee ID
            let local_id: Option<i64> = conn.query_row(
                "SELECT id FROM Employees WHERE biometric_id = ?1 OR employee_code = ?2 OR id = ?1",
                params![log.employee_id, log.employee_id.to_string()],
                |r| r.get(0)
            ).ok();

            if let Some(eid) = local_id {
                let _ = conn.execute(
                    "INSERT OR IGNORE INTO AttendanceLogs (employee_id, timestamp, device_id, branch_id, gate_id, punch_method)
                     VALUES (?1, ?2, ?3, 1, 1, ?4)",
                    params![eid, log.timestamp, log.device_id, log.punch_method],
                );
            } else {
                println!("Warning: No matching employee found for biometric ID {}", log.employee_id);
            }
        }
    }

    let mut ui_logs = Vec::new();
    for log in &logs {
        let name = device_users.iter().find(|u| u.employee_id == log.employee_id)
            .map(|u| u.name.clone())
            .unwrap_or_else(|| format!("User {}", log.employee_id));

        ui_logs.push(serde_json::json!({
            "employee_id": log.employee_id,
            "employee_name": name,
            "timestamp": log.timestamp,
            "punch_method": log.punch_method,
            "device_id": log.device_id
        }));
    }

    Ok(serde_json::json!(ui_logs))
}

#[tauri::command]
pub async fn pull_all_logs(
    ip: String,
    port: u16,
    device_id: i32,
    brand: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    sync_device_logs(ip, port, device_id, brand, state).await
}


#[tauri::command]
pub async fn list_gates(branch_id: i64, state: tauri::State<'_, AppState>) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("SELECT id, name FROM Gates WHERE branch_id = ?1")?;
    let gates: Vec<Value> = stmt.query_map(params![branch_id], |row| {
        Ok(json!({ "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)? }))
    })?.filter_map(|r| r.ok()).collect();

    Ok(gates)
}

#[tauri::command]
pub async fn list_employees_for_select(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("SELECT id, name, department FROM Employees WHERE status != 'deleted'")?;
    let employees: Vec<Value> = stmt.query_map([], |row| {
        Ok(json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, Option<String>>(2).unwrap_or(Some("N/A".to_string()))
        }))
    })?.filter_map(|r| r.ok()).collect();

    Ok(employees)
}

#[tauri::command]
pub async fn add_manual_attendance(
    employee_id: i64,
    timestamp: String,
    punch_method: String,
    state: tauri::State<'_, AppState>,
) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO AttendanceLogs (employee_id, timestamp, punch_method, branch_id, gate_id)
         VALUES (?1, ?2, ?3, 1, 1)",
        params![employee_id, timestamp, punch_method],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to add manual log: {}", e)))?;

    Ok(())
}

#[tauri::command]
pub async fn import_csv_attendance(
    csv_content: String,
    state: tauri::State<'_, AppState>,
) -> Result<Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
                        "INSERT OR IGNORE INTO AttendanceLogs (employee_id, timestamp, punch_method, branch_id, gate_id)
                         VALUES (?1, ?2, ?3, 1, 1)",
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
pub async fn get_system_configs(category: String, state: tauri::State<'_, AppState>) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("SELECT key, value, category FROM SystemConfigs WHERE category = ?1")?;
    let configs: Vec<Value> = stmt.query_map([category], |row| {
        Ok(json!({ 
            "setting_key": row.get::<_, String>(0)?, 
            "setting_value": row.get::<_, Option<String>>(1)?,
            "category": row.get::<_, String>(2)?,
            "setting_type": "string",
            "description": "",
            "is_public": true
        }))
    })?.filter_map(|r| r.ok()).collect();

    Ok(configs)
}

#[tauri::command]
pub async fn get_all_system_configs(state: tauri::State<'_, AppState>) -> Result<Vec<Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare("SELECT key, value, category FROM SystemConfigs")?;
    let configs: Vec<Value> = stmt.query_map([], |row| {
        Ok(json!({ 
            "setting_key": row.get::<_, String>(0)?, 
            "setting_value": row.get::<_, Option<String>>(1)?,
            "category": row.get::<_, String>(2)?,
            "setting_type": "string",
            "description": "",
            "is_public": true
        }))
    })?.filter_map(|r| r.ok()).collect();

    Ok(configs)
}

#[tauri::command]
pub async fn save_system_config(category: String, key: String, value: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let _ = sync_service::_queue_for_sync(conn, "system_settings", "UPDATE", &key, &payload, "MEDIUM");

    Ok(())
}

#[tauri::command]
pub async fn delete_system_config(category: String, key: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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

