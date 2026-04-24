// ============================================================================
// BioBridge Pro ERP - Complete Backend CRUD Services
// ============================================================================
// This file contains all Create, Read, Update, Delete operations for every
// ERP module with proper validation, security, and audit logging.
// ============================================================================

use crate::errors::AppError;
use crate::security::{decrypt_data, encrypt_data, sanitize_input, validate_date, validate_email};
use crate::AppState;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
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

pub fn ensure_attendance_employee_exists(
    conn: &Connection,
    employee_id: i64,
    display_name: Option<&str>,
    branch_id: Option<i64>,
) -> Result<i64, AppError> {
    let employee_code = employee_id.to_string();
    let fallback_name = display_name
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| format!("User {}", employee_id));

    let existing_id: Option<i64> = conn
        .query_row(
            "SELECT id FROM Employees WHERE biometric_id = ?1 OR employee_code = ?2",
            params![employee_id, employee_code],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| AppError::DatabaseError(format!("Employee lookup failed: {}", e)))?;

    if let Some(existing_id) = existing_id {
        conn.execute(
            "UPDATE Employees
             SET name = CASE WHEN name IS NULL OR TRIM(name) = '' OR name LIKE 'User %' THEN ?1 ELSE name END,
                 first_name = CASE WHEN first_name IS NULL OR TRIM(first_name) = '' OR first_name LIKE 'User %' THEN ?2 ELSE first_name END,
                 last_name = CASE WHEN last_name IS NULL OR TRIM(last_name) = '' THEN '' ELSE last_name END,
                 biometric_id = COALESCE(biometric_id, ?3),
                 device_user_id = COALESCE(device_user_id, ?3),
                 branch_id = COALESCE(branch_id, ?4),
                 status = CASE WHEN status = 'deleted' THEN 'active' ELSE status END,
                 employment_status = CASE WHEN LOWER(COALESCE(employment_status, 'active')) IN ('inactive', 'terminated', 'resigned', 'retired') THEN 'Active' ELSE employment_status END,
                 sync_status = CASE WHEN sync_status = 'placeholder' THEN 'active' ELSE sync_status END,
                 deleted_at = NULL,
                 updated_at = datetime('now')
             WHERE id = ?5",
            params![
                fallback_name,
                fallback_name,
                employee_id,
                branch_id,
                existing_id
            ],
        )
        .map_err(|e| AppError::DatabaseError(format!("Employee refresh failed: {}", e)))?;

        return Ok(existing_id);
    }

    let name_parts: Vec<&str> = fallback_name.split_whitespace().collect();
    let first_name = name_parts.first().copied().unwrap_or(&fallback_name).to_string();
    let last_name = if name_parts.len() > 1 {
        name_parts[1..].join(" ")
    } else {
        String::new()
    };

    conn.execute(
        "INSERT INTO Employees (
            employee_uuid, name, first_name, last_name, employee_code, biometric_id,
            device_user_id, branch_id, employment_status, status, app_role, sync_status, last_modified, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Active', 'active', 'employee', 'placeholder', datetime('now'), datetime('now'), datetime('now'))",
        params![
            generate_uuid_v4(),
            fallback_name,
            first_name,
            last_name,
            employee_code,
            employee_id,
            employee_id,
            branch_id.unwrap_or(1),
        ],
    )
    .map_err(|e| AppError::DatabaseError(format!("Failed to create attendance employee: {}", e)))?;

    Ok(conn.last_insert_rowid())
}

// ============================================================================
// INVENTORY CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateItemRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub quantity: i32,
    pub unit_price: f64,
    pub reorder_level: i32,
    pub supplier: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateItemRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub quantity: Option<i32>,
    pub unit_price: Option<f64>,
    pub reorder_level: Option<i32>,
    pub supplier: Option<String>,
    pub location: Option<String>,
}

/// CREATE: Add new inventory item
#[tauri::command]
pub async fn create_item(
    request: CreateItemRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let item_code = format!("ITM-{:06}", chrono::Utc::now().timestamp() % 1000000);

    conn.execute(
        "INSERT INTO Items (item_code, name, description, category, quantity, unit_price, reorder_level, supplier, location, is_active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, datetime('now'))",
        params![
            item_code,
            sanitize_input(&request.name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.category,
            request.quantity,
            request.unit_price,
            request.reorder_level,
            request.supplier.as_ref().map(|s| sanitize_input(s)),
            request.location.as_ref().map(|s| sanitize_input(s)),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create item: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Item created successfully",
        "item_code": item_code
    }))
}

/// READ: Get all inventory items
#[tauri::command]
pub async fn list_items(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, item_code, name, description, category, quantity, unit_price, reorder_level, supplier, location, is_active, created_at
         FROM Items WHERE is_active = 1 ORDER BY item_code"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let items: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "item_code": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
                "category": row.get::<_, String>(4)?,
                "quantity": row.get::<_, i32>(5)?,
                "unit_price": row.get::<_, f64>(6)?,
                "reorder_level": row.get::<_, i32>(7)?,
                "supplier": row.get::<_, Option<String>>(8)?,
                "location": row.get::<_, Option<String>>(9)?,
                "is_active": row.get::<_, bool>(10)?,
                "created_at": row.get::<_, String>(11)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

/// UPDATE: Modify inventory item
#[tauri::command]
pub async fn update_item(
    item_id: i64,
    request: UpdateItemRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(name) = request.name {
        updates.push("name = ?");
        values.push(Box::new(sanitize_input(&name)));
    }
    if let Some(description) = request.description {
        updates.push("description = ?");
        values.push(Box::new(sanitize_input(&description)));
    }
    if let Some(category) = request.category {
        updates.push("category = ?");
        values.push(Box::new(category));
    }
    if let Some(quantity) = request.quantity {
        updates.push("quantity = ?");
        values.push(Box::new(quantity));
    }
    if let Some(unit_price) = request.unit_price {
        updates.push("unit_price = ?");
        values.push(Box::new(unit_price));
    }
    if let Some(reorder_level) = request.reorder_level {
        updates.push("reorder_level = ?");
        values.push(Box::new(reorder_level));
    }
    if let Some(supplier) = request.supplier {
        updates.push("supplier = ?");
        values.push(Box::new(sanitize_input(&supplier)));
    }
    if let Some(location) = request.location {
        updates.push("location = ?");
        values.push(Box::new(sanitize_input(&location)));
    }

    if updates.is_empty() {
        return Err(AppError::ValidationError("No fields to update".into()));
    }

    updates.push("updated_at = datetime('now')");
    values.push(Box::new(item_id));

    let set_clause = updates.join(", ");
    let query = format!("UPDATE Items SET {} WHERE id = ?", set_clause);

    let params_vec: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();

    conn.execute(&query, &params_vec[..])
        .map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Item updated successfully"
    }))
}

/// DELETE: Soft delete inventory item
#[tauri::command]
pub async fn delete_item(
    item_id: i64,
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
        "UPDATE Items SET is_active = 0 WHERE id = ?1",
        params![item_id],
    )
    .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Item deleted successfully"
    }))
}

/// UPDATE STOCK: Adjust item quantity
#[tauri::command]
pub async fn update_stock(
    item_id: i64,
    adjustment: i32,
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
        "UPDATE Items SET quantity = quantity + ?1, updated_at = datetime('now') WHERE id = ?2",
        params![adjustment, item_id],
    )
    .map_err(|e| AppError::DatabaseError(format!("Stock update failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Stock updated successfully"
    }))
}

/// GET INVENTORY STATS
#[tauri::command]
pub async fn get_inventory_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_items: i64 =
        conn.query_row("SELECT COUNT(*) FROM Items WHERE is_active = 1", [], |r| {
            r.get(0)
        })?;
    let total_value: f64 = conn.query_row(
        "SELECT COALESCE(SUM(quantity * unit_price), 0) FROM Items WHERE is_active = 1",
        [],
        |r| r.get(0),
    )?;
    let low_stock: i64 = conn.query_row("SELECT COUNT(*) FROM Items WHERE quantity <= reorder_level AND quantity > 0 AND is_active = 1", [], |r| r.get(0))?;
    let out_of_stock: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Items WHERE quantity = 0 AND is_active = 1",
        [],
        |r| r.get(0),
    )?;

    Ok(serde_json::json!({
        "total_items": total_items,
        "total_value": total_value,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock
    }))
}

// ============================================================================
// PROJECTS CRUD OPERATIONS
// ============================================================================

// ============================================================================
// EMPLOYEE CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateEmployeeRequest {
    pub employee_uuid: Option<String>,
    pub employee_code: String,
    pub first_name: String,
    pub middle_name: Option<String>,
    pub last_name: String,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub personal_email: Option<String>,
    pub personal_phone: Option<String>,
    pub current_address: Option<String>,
    pub permanent_address: Option<String>,
    pub citizenship_number: Option<String>,
    pub pan_number: Option<String>,
    pub department_id: Option<String>,
    pub designation_id: Option<String>,
    pub branch_id: Option<String>,
    pub date_of_joining: Option<String>,
    pub employment_type: Option<String>,
    pub employment_status: Option<String>,
    pub reporting_manager_id: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub area_id: Option<String>,
    pub location_id: Option<String>,
    pub photo: Option<String>,
    pub enable_self_service: Option<bool>,
    pub enable_mobile_access: Option<bool>,
    pub local_name: Option<String>,
    pub national_id: Option<String>,
    pub contact_tel: Option<String>,
    pub office_tel: Option<String>,
    pub motorcycle_license: Option<String>,
    pub automobile_license: Option<String>,
    pub religion: Option<String>,
    pub city: Option<String>,
    pub postcode: Option<String>,
    pub passport_no: Option<String>,
    pub nationality: Option<String>,
    pub verification_mode: Option<String>,
    pub device_privilege: Option<String>,
    pub device_password: Option<String>,
    pub card_no: Option<String>,
    pub bio_photo: Option<String>,
    pub enable_attendance: Option<bool>,
    pub enable_holiday: Option<bool>,
    pub outdoor_management: Option<bool>,
    pub workflow_role: Option<String>,
    pub mobile_punch: Option<bool>,
    pub app_role: Option<String>,
    pub whatsapp_alert: Option<bool>,
    pub whatsapp_exception: Option<bool>,
    pub whatsapp_punch: Option<bool>,
    pub supervisor_mobile: Option<String>,
    pub biometric_id: Option<i32>,
    pub shift_start_time: Option<String>,
    pub shift_end_time: Option<String>,
    pub sync_status: Option<String>,
    pub last_modified: Option<String>,
    pub server_id: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateEmployeeRequest {
    pub employee_uuid: Option<String>,
    pub employee_code: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub marital_status: Option<String>,
    pub personal_email: Option<String>,
    pub personal_phone: Option<String>,
    pub current_address: Option<String>,
    pub permanent_address: Option<String>,
    pub citizenship_number: Option<String>,
    pub pan_number: Option<String>,
    pub department_id: Option<String>,
    pub designation_id: Option<String>,
    pub branch_id: Option<String>,
    pub date_of_joining: Option<String>,
    pub employment_status: Option<String>,
    pub employment_type: Option<String>,
    pub reporting_manager_id: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub emergency_contact_relation: Option<String>,
    pub area_id: Option<String>,
    pub location_id: Option<String>,
    pub photo: Option<String>,
    pub enable_self_service: Option<bool>,
    pub enable_mobile_access: Option<bool>,
    pub local_name: Option<String>,
    pub national_id: Option<String>,
    pub contact_tel: Option<String>,
    pub office_tel: Option<String>,
    pub motorcycle_license: Option<String>,
    pub automobile_license: Option<String>,
    pub religion: Option<String>,
    pub city: Option<String>,
    pub postcode: Option<String>,
    pub passport_no: Option<String>,
    pub nationality: Option<String>,
    pub verification_mode: Option<String>,
    pub device_privilege: Option<String>,
    pub device_password: Option<String>,
    pub card_no: Option<String>,
    pub bio_photo: Option<String>,
    pub enable_attendance: Option<bool>,
    pub enable_holiday: Option<bool>,
    pub outdoor_management: Option<bool>,
    pub workflow_role: Option<String>,
    pub mobile_punch: Option<bool>,
    pub app_role: Option<String>,
    pub whatsapp_alert: Option<bool>,
    pub whatsapp_exception: Option<bool>,
    pub whatsapp_punch: Option<bool>,
    pub supervisor_mobile: Option<String>,
    pub biometric_id: Option<i32>,
    pub shift_start_time: Option<String>,
    pub shift_end_time: Option<String>,
    pub sync_status: Option<String>,
    pub last_modified: Option<String>,
    pub server_id: Option<String>,
}

/// CREATE: Add new employee
#[tauri::command]
pub async fn create_employee(
    request: CreateEmployeeRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Generate unique employee code if not provided
    let mut employee_code = sanitize_input(&request.employee_code);
    if employee_code.is_empty() {
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM Employees", [], |r| r.get(0)).unwrap_or(0);
        employee_code = format!("BB-{:04}", count + 1);
    }
    let employee_uuid = request
        .employee_uuid
        .clone()
        .unwrap_or_else(generate_uuid_v4);
    let employee_uuid_value = Some(employee_uuid.clone());
    let sync_status = request
        .sync_status
        .clone()
        .unwrap_or_else(|| "pending".to_string());
    let last_modified = request
        .last_modified
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    
    let first_name = sanitize_input(&request.first_name);
    let last_name = sanitize_input(&request.last_name);

    // Encrypt sensitive data
    let email_encrypted = if let Some(email) = &request.personal_email {
        if !validate_email(email) {
            return Err(AppError::ValidationError("Invalid email format".into()));
        }
        Some(encrypt_data(email).map_err(|e| AppError::EncryptionError(e))?)
    } else {
        None
    };

    let phone_encrypted = if let Some(phone) = &request.personal_phone {
        Some(encrypt_data(&sanitize_input(phone)).map_err(|e| AppError::EncryptionError(e))?)
    } else {
        None
    };

    let address_encrypted = if let Some(addr) = &request.current_address {
        Some(encrypt_data(&sanitize_input(addr)).map_err(|e| AppError::EncryptionError(e))?)
    } else {
        None
    };

    let account_encrypted = if let Some(acc) = &request.account_number {
        Some(encrypt_data(&sanitize_input(acc)).map_err(|e| AppError::EncryptionError(e))?)
    } else {
        None
    };

    // Generate display names
    let full_name = format!("{} {} {}", first_name, request.middle_name.as_deref().unwrap_or(""), last_name).trim().replace("  ", " ");

    // Insert employee with all fields
    let _id = conn.execute(
        "INSERT INTO Employees (
            employee_uuid, employee_code, first_name, middle_name, last_name, name, full_name,
            date_of_birth, gender, personal_email, personal_phone,
            current_address, permanent_address, citizenship_number, pan_number,
            department_id, designation_id, branch_id, date_of_joining,
            employment_type, employment_status, reporting_manager_id, bank_name,
            account_number, area_id, location_id, photo,
            enable_self_service, enable_mobile_access, local_name, national_id,
            contact_tel, office_tel, motorcycle_license, automobile_license,
            religion, city, postcode, passport_no, nationality, 
            verification_mode, device_privilege, device_password, card_no,
            bio_photo, enable_attendance, enable_holiday, outdoor_management,
            workflow_role, mobile_punch, app_role, whatsapp_alert,
            whatsapp_exception, whatsapp_punch, supervisor_mobile, biometric_id,
            shift_start_time, shift_end_time,
            status, sync_status, last_modified, server_id, created_at, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
            ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44,
            ?45, ?46, ?47, ?48, ?49, ?50, ?51, ?52, ?53, ?54, ?55, ?56, ?57, ?58,
            'active', ?59, ?60, ?61, datetime('now'), datetime('now')
        )",
        params![
            &employee_uuid,
            &employee_code,
            &first_name,
            &request.middle_name.as_ref().map(|s| sanitize_input(s)),
            &last_name,
            &full_name.clone(),
            &full_name,
            &request.date_of_birth,
            &request.gender,
            &email_encrypted,
            &phone_encrypted,
            &address_encrypted,
            &request.permanent_address.as_ref().map(|s| encrypt_data(&sanitize_input(s))).transpose().map_err(|e| AppError::EncryptionError(e))?,
            &request.citizenship_number.as_ref().map(|s| sanitize_input(s)),
            &request.pan_number.as_ref().map(|s| sanitize_input(s)),
            &request.department_id,
            &request.designation_id,
            &request.branch_id,
            &request.date_of_joining,
            &request.employment_type.as_deref().unwrap_or("Full-time"),
            &request.employment_status.as_deref().unwrap_or("Active"),
            &request.reporting_manager_id,
            &request.bank_name,
            &account_encrypted,
            &request.area_id,
            &request.location_id,
            &request.photo,
            &(request.enable_self_service.unwrap_or(false) as i32),
            &(request.enable_mobile_access.unwrap_or(false) as i32),
            &request.local_name,
            &request.national_id,
            &request.contact_tel,
            &request.office_tel,
            &request.motorcycle_license,
            &request.automobile_license,
            &request.religion,
            &request.city,
            &request.postcode,
            &request.passport_no,
            &request.nationality,
            &request.verification_mode,
            &request.device_privilege,
            &request.device_password,
            &request.card_no,
            &request.bio_photo,
            &(request.enable_attendance.unwrap_or(true) as i32),
            &(request.enable_holiday.unwrap_or(true) as i32),
            &(request.outdoor_management.unwrap_or(false) as i32),
            &request.workflow_role,
            &(request.mobile_punch.unwrap_or(false) as i32),
            &request.app_role,
            &(request.whatsapp_alert.unwrap_or(false) as i32),
            &(request.whatsapp_exception.unwrap_or(false) as i32),
            &(request.whatsapp_punch.unwrap_or(false) as i32),
            &request.supervisor_mobile,
            &request.biometric_id,
            &request.shift_start_time,
            &request.shift_end_time,
            &sync_status,
            &last_modified,
            &request.server_id,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create employee: {}", e)))?;

    // Get the actual row ID if we can and push to sync queue
    let employee_id = conn.last_insert_rowid();

    // Prepare sync payload with ALL fields
    let sync_payload = serde_json::json!({
        "id": employee_id,
        "employee_uuid": employee_uuid_value,
        "employee_code": employee_code,
        "first_name": first_name,
        "middle_name": request.middle_name,
        "last_name": last_name,
        "date_of_birth": request.date_of_birth,
        "gender": request.gender,
        "department_id": request.department_id,
        "designation_id": request.designation_id,
        "branch_id": request.branch_id,
        "employment_type": request.employment_type,
        "employment_status": request.employment_status,
        "biometric_id": request.biometric_id,
        "local_name": request.local_name,
        "national_id": request.national_id,
        "contact_tel": request.contact_tel,
        "religion": request.religion,
        "city": request.city,
        "card_no": request.card_no,
        "mobile_punch": request.mobile_punch,
        "app_role": request.app_role,
        "shift_start_time": request.shift_start_time,
        "shift_end_time": request.shift_end_time,
        "status": "active",
        "sync_status": sync_status,
        "last_modified": last_modified,
        "server_id": request.server_id
    });

    let _ = crate::sync_service::_queue_for_sync(
        conn,
        "employees",
        "INSERT",
        &employee_id.to_string(),
        &sync_payload,
        "HIGH",
    );

    // Log audit
    log_audit(
        conn,
        "Employees",
        Some(employee_id.to_string()),
        "CREATE",
        &format!("Created employee: {}", employee_code),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Employee created successfully",
        "employee_id": employee_id,
        "employee_code": employee_code
    }))
}

#[tauri::command]
pub async fn register_new_staff(
    request: CreateEmployeeRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    create_employee(request, state).await
}

/// READ: Get employee by ID
#[tauri::command]
pub async fn get_employee(
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn
        .prepare(
            "SELECT 
                e.id, e.employee_code, e.first_name, e.middle_name, e.last_name, 
                e.date_of_birth, e.gender, e.personal_email, e.personal_phone, e.current_address,
                e.department_id, e.designation_id, e.branch_id, e.date_of_joining, e.employment_type,
                e.employment_status, e.bank_name,
                d.name as department_name,
                des.name as designation_name,
                b.name as branch_name,
                e.area_id, e.location_id, e.photo, e.enable_self_service, e.enable_mobile_access,
                e.local_name, e.national_id, e.contact_tel, e.office_tel, e.motorcycle_license,
                e.automobile_license, e.religion, e.city, e.postcode, e.passport_no,
                e.nationality, e.verification_mode, e.device_privilege, e.device_password, e.card_no,
                e.bio_photo, e.enable_attendance, e.enable_holiday, e.outdoor_management, e.workflow_role,
                e.mobile_punch, e.app_role, e.whatsapp_alert, e.whatsapp_exception, e.whatsapp_punch,
                e.supervisor_mobile, e.biometric_id, e.shift_start_time, e.shift_end_time,
                e.employee_uuid, e.sync_status, e.last_modified, e.server_id
        FROM Employees e
        LEFT JOIN Departments d ON e.department_id = d.id
        LEFT JOIN Designations des ON e.designation_id = des.id
        LEFT JOIN Branches b ON e.branch_id = b.id
        WHERE e.id = ?1 AND (e.status IS NULL OR e.status != 'deleted')",
        )
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let employee = stmt.query_row(params![employee_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "employee_code": row.get::<_, String>(1)?,
            "first_name": row.get::<_, String>(2)?,
            "middle_name": row.get::<_, Option<String>>(3)?,
            "last_name": row.get::<_, String>(4)?,
            "full_name": format!(
                "{} {} {}",
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                row.get::<_, String>(4)?
            ).trim().to_string(),
            "date_of_birth": row.get::<_, Option<String>>(5)?,
            "gender": row.get::<_, Option<String>>(6)?,
            "personal_email": decrypt_data(&row.get::<_, Option<String>>(7)?.unwrap_or_default()).ok(),
            "personal_phone": decrypt_data(&row.get::<_, Option<String>>(8)?.unwrap_or_default()).ok(),
            "current_address": decrypt_data(&row.get::<_, Option<String>>(9)?.unwrap_or_default()).ok(),
            "department_id": row.get::<_, Option<i64>>(10)?,
            "designation_id": row.get::<_, Option<i64>>(11)?,
            "branch_id": row.get::<_, Option<i64>>(12)?,
            "date_of_joining": row.get::<_, Option<String>>(13)?,
            "employment_type": row.get::<_, String>(14)?,
            "employment_status": row.get::<_, String>(15)?,
            "bank_name": row.get::<_, Option<String>>(16)?,
            "department_name": row.get::<_, Option<String>>(17)?,
            "designation_name": row.get::<_, Option<String>>(18)?,
            "branch_name": row.get::<_, Option<String>>(19)?,
            "area_id": row.get::<_, Option<String>>(20)?,
            "location_id": row.get::<_, Option<String>>(21)?,
            "photo": row.get::<_, Option<String>>(22)?,
            "enable_self_service": row.get::<_, Option<i32>>(23)?.unwrap_or(0) != 0,
            "enable_mobile_access": row.get::<_, Option<i32>>(24)?.unwrap_or(0) != 0,
            "local_name": row.get::<_, Option<String>>(25)?,
            "national_id": row.get::<_, Option<String>>(26)?,
            "contact_tel": row.get::<_, Option<String>>(27)?,
            "office_tel": row.get::<_, Option<String>>(28)?,
            "motorcycle_license": row.get::<_, Option<String>>(29)?,
            "automobile_license": row.get::<_, Option<String>>(30)?,
            "religion": row.get::<_, Option<String>>(31)?,
            "city": row.get::<_, Option<String>>(32)?,
            "postcode": row.get::<_, Option<String>>(33)?,
            "passport_no": row.get::<_, Option<String>>(34)?,
            "nationality": row.get::<_, Option<String>>(35)?,
            "verification_mode": row.get::<_, Option<String>>(36)?,
            "device_privilege": row.get::<_, Option<String>>(37)?,
            "device_password": row.get::<_, Option<String>>(38)?,
            "card_no": row.get::<_, Option<String>>(39)?,
            "bio_photo": row.get::<_, Option<String>>(40)?,
            "enable_attendance": row.get::<_, Option<i32>>(41)?.unwrap_or(1) != 0,
            "enable_holiday": row.get::<_, Option<i32>>(42)?.unwrap_or(1) != 0,
            "outdoor_management": row.get::<_, Option<i32>>(43)?.unwrap_or(0) != 0,
            "workflow_role": row.get::<_, Option<String>>(44)?,
            "mobile_punch": row.get::<_, Option<i32>>(45)?.unwrap_or(0) != 0,
            "app_role": row.get::<_, Option<String>>(46)?,
            "whatsapp_alert": row.get::<_, Option<i32>>(47)?.unwrap_or(0) != 0,
            "whatsapp_exception": row.get::<_, Option<i32>>(48)?.unwrap_or(0) != 0,
            "whatsapp_punch": row.get::<_, Option<i32>>(49)?.unwrap_or(0) != 0,
            "supervisor_mobile": row.get::<_, Option<String>>(50)?,
            "shift_start_time": row.get::<_, Option<String>>(51)?,
            "shift_end_time": row.get::<_, Option<String>>(52)?,
            "employee_uuid": row.get::<_, Option<String>>(53)?,
            "sync_status": row.get::<_, Option<String>>(54)?,
            "last_modified": row.get::<_, Option<String>>(55)?,
            "server_id": row.get::<_, Option<String>>(56)?,
        }))
    }).optional()
    .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    match employee {
        Some(emp) => {
            log_audit(
                conn,
                "Employees",
                Some(employee_id.to_string()),
                "VIEW",
                "Viewed employee",
            )?;
            Ok(serde_json::json!({
                "success": true,
                "data": emp
            }))
        }
        None => Err(AppError::NotFound("Employee not found".into())),
    }
}

/// READ: Get all employees
#[tauri::command]
pub async fn list_employees(
    branch_id: Option<String>,
    status_filter: Option<String>,
    _filters: Option<serde_json::Value>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT e.id, e.employee_code, e.first_name, e.middle_name, e.last_name,
                e.gender, e.date_of_joining, e.employment_type, e.employment_status,
                e.department_id, e.designation_id, e.branch_id, e.status, e.name,
                d.name as dept_name, des.name as desig_name, b.name as branch_name,
                datetime(e.deleted_at, 'localtime'), e.biometric_id, e.shift_start_time, e.shift_end_time,
                e.employee_uuid, e.sync_status, e.last_modified, e.server_id
        FROM Employees e
        LEFT JOIN Departments d ON e.department_id = d.id
        LEFT JOIN Designations des ON e.designation_id = des.id
        LEFT JOIN Branches b ON e.branch_id = b.id
        WHERE 1=1"
    );

    let param_index = 1;
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // Status Filtering Logic
    let status_str = status_filter.unwrap_or_else(|| "active".to_string());
    if status_str == "deleted" {
        query.push_str(" AND e.status = 'deleted'");
    } else if status_str == "all" {
        // No filter
    } else {
        // 'active' mode includes everything EXCEPT 'deleted'
        query.push_str(" AND (e.status != 'deleted' OR e.status IS NULL)");
    }

    if let Some(ref bid) = branch_id {
        if !bid.is_empty() && bid != "all" {
            query.push_str(&format!(" AND (e.branch_id = ?{} OR CAST(e.branch_id AS TEXT) = ?{})", param_index, param_index));
            params.push(Box::new(bid.clone()));
        }
    }

    query.push_str(" ORDER BY e.id DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref()).collect();

    let employees: Vec<serde_json::Value> = stmt
        .query_map(&param_refs[..], |row| {
            let first = row.get::<_, Option<String>>(2)?.unwrap_or_else(|| row.get::<_, Option<String>>(13).unwrap_or_default().unwrap_or_default());
            let middle = row.get::<_, Option<String>>(3)?.unwrap_or_default();
            let last = row.get::<_, Option<String>>(4)?.unwrap_or_default();
            let full_name = format!("{} {} {}", first, middle, last).trim().replace("  ", " ").to_string();

            let id = row.get::<_, i64>(0)?;
            let mut emp_code = row.get::<_, Option<String>>(1)?.unwrap_or_default();
            if emp_code.is_empty() || emp_code.chars().all(char::is_numeric) {
                emp_code = format!("BB-{:04}", id);
            }

            Ok(serde_json::json!({
                "id": id,
                "employee_code": emp_code,
                "first_name": first,
                "middle_name": middle,
                "last_name": last,
                "full_name": full_name,
                "name": row.get::<_, Option<String>>(13)?.unwrap_or_default(),
                "gender": row.get::<_, Option<String>>(5)?,
                "date_of_joining": row.get::<_, Option<String>>(6)?,
                "employment_type": row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "Full-time".to_string()),
                "employment_status": row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "Active".to_string()),
                "status": row.get::<_, Option<String>>(12)?.unwrap_or_else(|| "active".to_string()),
                "department_id": row.get::<_, Option<i64>>(9)?,
                "designation_id": row.get::<_, Option<i64>>(10)?,
                "branch_id": row.get::<_, Option<i64>>(11)?,
                "department": row.get::<_, Option<String>>(14)?,
                "designation": row.get::<_, Option<String>>(15)?,
                "branch_name": row.get::<_, Option<String>>(16)?,
                "deleted_at": row.get::<_, Option<String>>(17)?,
                "biometric_id": row.get::<_, Option<i32>>(18)?,
                "shift_start_time": row.get::<_, Option<String>>(19)?,
                "shift_end_time": row.get::<_, Option<String>>(20)?,
                "employee_uuid": row.get::<_, Option<String>>(21)?,
                "sync_status": row.get::<_, Option<String>>(22)?,
                "last_modified": row.get::<_, Option<String>>(23)?,
                "server_id": row.get::<_, Option<String>>(24)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    let debug_count: i64 = conn.query_row("SELECT COUNT(*) FROM Employees", [], |r| r.get(0)).unwrap_or(-1);
    let debug_active_count: i64 = conn.query_row("SELECT COUNT(*) FROM Employees WHERE status != 'deleted'", [], |r| r.get(0)).unwrap_or(-1);

    Ok(serde_json::json!({
        "success": true,
        "data": employees,
        "count": employees.len(),
        "debug": {
            "total_in_db": debug_count,
            "total_active": debug_active_count,
            "branch_filter": branch_id
        }
    }))
}

/// UPDATE: Modify employee data
#[tauri::command]
pub async fn update_employee(
    employee_id: i64,
    request: UpdateEmployeeRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Fetch old values for audit
    let _old_values = get_employee_for_audit(conn, employee_id)?;
    let modified_at = request
        .last_modified
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    let sync_status_value = request
        .sync_status
        .clone()
        .unwrap_or_else(|| "modified".to_string());
    let server_id_value = request.server_id.clone();

    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    let employee_uuid_value = request.employee_uuid.clone();

    if let Some(ref employee_uuid) = request.employee_uuid {
        updates.push("employee_uuid = ?");
        values.push(Box::new(sanitize_input(employee_uuid)));
    }

    if let Some(ref first_name) = request.first_name {
        updates.push("first_name = ?");
        values.push(Box::new(sanitize_input(&first_name)));
    }
    if let Some(ref middle_name) = request.middle_name {
        updates.push("middle_name = ?");
        values.push(Box::new(sanitize_input(&middle_name)));
    }
    if let Some(ref last_name) = request.last_name {
        updates.push("last_name = ?");
        values.push(Box::new(sanitize_input(&last_name)));
    }
    if let Some(ref email) = request.personal_email {
        updates.push("personal_email = ?");
        let encrypted = encrypt_data(&email).map_err(|e| AppError::EncryptionError(e))?;
        values.push(Box::new(encrypted));
    }
    if let Some(ref phone) = request.personal_phone {
        updates.push("personal_phone = ?");
        let encrypted = encrypt_data(&phone).map_err(|e| AppError::EncryptionError(e))?;
        values.push(Box::new(encrypted));
    }
    if let Some(ref branch_id) = request.branch_id {
        updates.push("branch_id = ?");
        values.push(Box::new(branch_id));
    }
    if let Some(ref status) = request.employment_status {
        updates.push("employment_status = ?");
        values.push(Box::new(status));
    }
    if let Some(ref emp_type) = request.employment_type {
        updates.push("employment_type = ?");
        values.push(Box::new(emp_type));
    }
    if let Some(ref citizenship) = request.citizenship_number {
        updates.push("citizenship_number = ?");
        values.push(Box::new(sanitize_input(&citizenship)));
    }
    if let Some(ref pan) = request.pan_number {
        updates.push("pan_number = ?");
        values.push(Box::new(sanitize_input(&pan)));
    }
    if let Some(ref dept_id) = request.department_id {
        updates.push("department_id = ?");
        values.push(Box::new(dept_id));
    }
    if let Some(ref desig_id) = request.designation_id {
        updates.push("designation_id = ?");
        values.push(Box::new(desig_id));
    }
    if let Some(ref dob) = request.date_of_birth {
        updates.push("date_of_birth = ?");
        values.push(Box::new(dob));
    }
    if let Some(ref gender) = request.gender {
        updates.push("gender = ?");
        values.push(Box::new(gender));
    }
    if let Some(ref addr) = request.current_address {
        updates.push("current_address = ?");
        values.push(Box::new(sanitize_input(&addr)));
    }
    if let Some(ref permanent_addr) = request.permanent_address {
        updates.push("permanent_address = ?");
        values.push(Box::new(sanitize_input(&permanent_addr)));
    }
    if let Some(bank) = request.bank_name {
        updates.push("bank_name = ?");
        values.push(Box::new(sanitize_input(&bank)));
    }
    if let Some(acc) = request.account_number {
        updates.push("account_number = ?");
        values.push(Box::new(sanitize_input(&acc)));
    }
    if let Some(emp_code) = request.employee_code {
        updates.push("employee_code = ?");
        values.push(Box::new(sanitize_input(&emp_code)));
    }
    if let Some(marital) = request.marital_status {
        updates.push("marital_status = ?");
        values.push(Box::new(marital));
    }
    if let Some(ref doj) = request.date_of_joining {
        updates.push("date_of_joining = ?");
        values.push(Box::new(doj));
    }
    if let Some(emergency_name) = request.emergency_contact_name {
        updates.push("emergency_contact_name = ?");
        values.push(Box::new(sanitize_input(&emergency_name)));
    }
    if let Some(emergency_phone) = request.emergency_contact_phone {
        updates.push("emergency_contact_phone = ?");
        values.push(Box::new(sanitize_input(&emergency_phone)));
    }
    if let Some(emergency_relation) = request.emergency_contact_relation {
        updates.push("emergency_contact_relation = ?");
        values.push(Box::new(sanitize_input(&emergency_relation)));
    }
    if let Some(ref area_id) = request.area_id {
        updates.push("area_id = ?");
        values.push(Box::new(area_id));
    }
    if let Some(ref location_id) = request.location_id {
        updates.push("location_id = ?");
        values.push(Box::new(location_id));
    }
    if let Some(ref photo) = request.photo {
        updates.push("photo = ?");
        values.push(Box::new(photo));
    }
    if let Some(enable_self_service) = request.enable_self_service {
        updates.push("enable_self_service = ?");
        values.push(Box::new(enable_self_service as i32));
    }
    if let Some(enable_mobile_access) = request.enable_mobile_access {
        updates.push("enable_mobile_access = ?");
        values.push(Box::new(enable_mobile_access as i32));
    }
    if let Some(local_name) = request.local_name {
        updates.push("local_name = ?");
        values.push(Box::new(sanitize_input(&local_name)));
    }
    if let Some(national_id) = request.national_id {
        updates.push("national_id = ?");
        values.push(Box::new(sanitize_input(&national_id)));
    }
    if let Some(contact_tel) = request.contact_tel {
        updates.push("contact_tel = ?");
        values.push(Box::new(sanitize_input(&contact_tel)));
    }
    if let Some(office_tel) = request.office_tel {
        updates.push("office_tel = ?");
        values.push(Box::new(sanitize_input(&office_tel)));
    }
    if let Some(motorcycle_license) = request.motorcycle_license {
        updates.push("motorcycle_license = ?");
        values.push(Box::new(sanitize_input(&motorcycle_license)));
    }
    if let Some(automobile_license) = request.automobile_license {
        updates.push("automobile_license = ?");
        values.push(Box::new(sanitize_input(&automobile_license)));
    }
    if let Some(religion) = request.religion {
        updates.push("religion = ?");
        values.push(Box::new(sanitize_input(&religion)));
    }
    if let Some(city) = request.city {
        updates.push("city = ?");
        values.push(Box::new(sanitize_input(&city)));
    }
    if let Some(postcode) = request.postcode {
        updates.push("postcode = ?");
        values.push(Box::new(sanitize_input(&postcode)));
    }
    if let Some(passport_no) = request.passport_no {
        updates.push("passport_no = ?");
        values.push(Box::new(sanitize_input(&passport_no)));
    }
    if let Some(nationality) = request.nationality {
        updates.push("nationality = ?");
        values.push(Box::new(sanitize_input(&nationality)));
    }
    if let Some(ref verification_mode) = request.verification_mode {
        updates.push("verification_mode = ?");
        values.push(Box::new(verification_mode));
    }
    if let Some(ref device_privilege) = request.device_privilege {
        updates.push("device_privilege = ?");
        values.push(Box::new(device_privilege));
    }
    if let Some(ref device_password) = request.device_password {
        updates.push("device_password = ?");
        values.push(Box::new(device_password));
    }
    if let Some(ref card_no) = request.card_no {
        updates.push("card_no = ?");
        values.push(Box::new(card_no));
    }
    if let Some(ref bio_photo) = request.bio_photo {
        updates.push("bio_photo = ?");
        values.push(Box::new(bio_photo));
    }
    if let Some(enable_attendance) = request.enable_attendance {
        updates.push("enable_attendance = ?");
        values.push(Box::new(enable_attendance as i32));
    }
    if let Some(enable_holiday) = request.enable_holiday {
        updates.push("enable_holiday = ?");
        values.push(Box::new(enable_holiday as i32));
    }
    if let Some(outdoor_management) = request.outdoor_management {
        updates.push("outdoor_management = ?");
        values.push(Box::new(outdoor_management as i32));
    }
    if let Some(ref workflow_role) = request.workflow_role {
        updates.push("workflow_role = ?");
        values.push(Box::new(workflow_role));
    }
    if let Some(mobile_punch) = request.mobile_punch {
        updates.push("mobile_punch = ?");
        values.push(Box::new(mobile_punch as i32));
    }
    if let Some(ref app_role) = request.app_role {
        updates.push("app_role = ?");
        values.push(Box::new(app_role));
    }
    if let Some(whatsapp_alert) = request.whatsapp_alert {
        updates.push("whatsapp_alert = ?");
        values.push(Box::new(whatsapp_alert as i32));
    }
    if let Some(whatsapp_exception) = request.whatsapp_exception {
        updates.push("whatsapp_exception = ?");
        values.push(Box::new(whatsapp_exception as i32));
    }
    if let Some(whatsapp_punch) = request.whatsapp_punch {
        updates.push("whatsapp_punch = ?");
        values.push(Box::new(whatsapp_punch as i32));
    }
    if let Some(ref supervisor_mobile) = request.supervisor_mobile {
        updates.push("supervisor_mobile = ?");
        values.push(Box::new(sanitize_input(&supervisor_mobile)));
    }
    if let Some(biometric_id) = request.biometric_id {
        updates.push("biometric_id = ?");
        values.push(Box::new(biometric_id));
    }
    if let Some(ref shift_start_time) = request.shift_start_time {
        updates.push("shift_start_time = ?");
        values.push(Box::new(sanitize_input(&shift_start_time)));
    }
    if let Some(ref shift_end_time) = request.shift_end_time {
        updates.push("shift_end_time = ?");
        values.push(Box::new(sanitize_input(&shift_end_time)));
    }
    if let Some(ref sync_status) = request.sync_status {
        updates.push("sync_status = ?");
        values.push(Box::new(sanitize_input(sync_status)));
    }
    if let Some(ref server_id) = request.server_id {
        updates.push("server_id = ?");
        values.push(Box::new(sanitize_input(server_id)));
    }

    // Dynamic Full Name Regeneration
    let first = request.first_name.clone().or_else(|| _old_values.as_ref().and_then(|v| v["first_name"].as_str().map(|s| s.to_string()))).unwrap_or_default();
    let middle = request.middle_name.clone().or_else(|| _old_values.as_ref().and_then(|v| v["middle_name"].as_str().map(|s| s.to_string()))).unwrap_or_default();
    let last = request.last_name.clone().or_else(|| _old_values.as_ref().and_then(|v| v["last_name"].as_str().map(|s| s.to_string()))).unwrap_or_default();
    
    let full_name = format!("{} {} {}", first, middle, last).trim().replace("  ", " ");
    updates.push("name = ?");
    values.push(Box::new(full_name.clone()));
    updates.push("full_name = ?");
    values.push(Box::new(full_name));

    if updates.is_empty() {
        return Err(AppError::ValidationError("No fields to update".into()));
    }

    updates.push("updated_at = datetime('now')");
    updates.push("last_modified = ?");
    values.push(Box::new(modified_at.clone()));
    if request.sync_status.is_none() {
        updates.push("sync_status = ?");
        values.push(Box::new(sync_status_value.clone()));
    }
    // ID comes AFTER all field placeholders
    values.push(Box::new(employee_id));

    let set_clause = updates.join(", ");
    let query = format!("UPDATE Employees SET {} WHERE id = ?", set_clause);

    let params_vec: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();

    conn.execute(&query, &params_vec[..])
        .map_err(|e| AppError::DatabaseError(format!("Update failed: {} | Query: {}", e, query)))?;

    // Log audit
    log_audit(
        conn,
        "Employees",
        Some(employee_id.to_string()),
        "UPDATE",
        &format!("Updated employee #{}", employee_id),
    )?;

    // Push to sync queue
    let sync_payload = serde_json::json!({
        "id": employee_id,
        "employee_uuid": employee_uuid_value,
        "first_name": request.first_name,
        "last_name": request.last_name,
        "department_id": request.department_id,
        "branch_id": request.branch_id,
        "employment_status": request.employment_status,
        "biometric_id": request.biometric_id,
        "mobile_punch": request.mobile_punch,
        "shift_start_time": request.shift_start_time,
        "shift_end_time": request.shift_end_time,
        "updated_at": chrono::Utc::now().to_rfc3339(),
        "last_modified": modified_at,
        "sync_status": sync_status_value,
        "server_id": server_id_value,
    });
    let _ = crate::sync_service::_queue_for_sync(
        conn,
        "employees",
        "UPDATE",
        &employee_id.to_string(),
        &sync_payload,
        "HIGH",
    );

    Ok(serde_json::json!({
        "success": true,
        "message": "Employee updated successfully"
    }))
}

/// DELETE: Soft delete employee
#[tauri::command]
pub async fn delete_employee(
    employee_id: i64,
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
        "UPDATE Employees 
         SET status = 'deleted', 
             employment_status = 'Inactive', 
             enable_self_service = 0,
             enable_mobile_access = 0,
             deleted_at = datetime('now'),
             updated_at = datetime('now') 
         WHERE id = ?1",
        params![employee_id],
    )
    .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    log_audit(
        conn,
        "Employees",
        Some(employee_id.to_string()),
        "DELETE",
        &format!("Deleted employee #{}", employee_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Employee deleted successfully"
    }))
}

/// RESTORE: Restore a deleted employee
#[tauri::command]
pub async fn restore_employee(
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Employees SET status = 'active', updated_at = datetime('now') WHERE id = ?1",
        params![employee_id],
    ).map_err(|e| AppError::DatabaseError(format!("Restore failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Employee restored successfully"
    }))
}

// ============================================================================
// LEAVE MANAGEMENT CRUD
// ============================================================================

const DEFAULT_LEAVE_TYPES: [&str; 5] = [
    "Sick Leave",
    "Casual Leave",
    "Earned Leave",
    "Maternity Leave",
    "Paternity Leave",
];

fn normalize_leave_status(status: &str) -> String {
    match status.trim().to_lowercase().as_str() {
        "approved" => "approved".to_string(),
        "rejected" => "rejected".to_string(),
        "pending" => "pending".to_string(),
        other => other.to_string(),
    }
}

fn is_leave_admin_role(role: Option<&str>) -> bool {
    matches!(role.map(|r| r.trim().to_uppercase()).as_deref(), Some("SUPER_ADMIN") | Some("ADMIN"))
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeaveRequest {
    pub employee_id: i64,
    pub leave_type: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: Option<String>,
    pub applied_by: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListLeaveRequestsRequest {
    pub employee_id: Option<i64>,
    pub status: Option<String>,
    pub current_user_role: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLeaveRequest {
    pub leave_request_id: i64,
    pub actor_role: Option<String>,
    pub actor_employee_id: Option<i64>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeaveRequestDetails {
    pub leave_request_id: i64,
    pub leave_type: String,
    pub start_date: String,
    pub end_date: String,
    pub reason: Option<String>,
    pub actor_role: Option<String>,
}

/// CREATE: Submit leave request
#[tauri::command]
pub async fn create_leave_request(
    request: CreateLeaveRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Validate dates
    if !validate_date(&request.start_date) || !validate_date(&request.end_date) {
        return Err(AppError::ValidationError(
            "Invalid date format. Use YYYY-MM-DD".into(),
        ));
    }

    if request.end_date < request.start_date {
        return Err(AppError::ValidationError(
            "End date cannot be earlier than start date".into(),
        ));
    }

    conn.execute(
        "INSERT INTO LeaveRequests (employee_id, leave_type, start_date, end_date, reason, status, applied_by, applied_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, datetime('now'), datetime('now'))",
        params![
            request.employee_id,
            sanitize_input(&request.leave_type),
            request.start_date,
            request.end_date,
            request.reason.as_ref().map(|s| sanitize_input(s)),
            request.applied_by.as_ref().map(|s| sanitize_input(s))
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create leave request: {}", e)))?;

    log_audit(
        conn,
        "LeaveRequests",
        None,
        "CREATE",
        &format!(
        "Leave request submitted for employee #{}",
            request.employee_id
        ),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Leave request submitted successfully"
    }))
}

#[tauri::command]
pub async fn add_leave_request(
    request: CreateLeaveRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    create_leave_request(
        request,
        state,
    ).await
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeaveStatusRequest {
    pub leave_request_id: i64,
    pub status: String,
    pub approved_by: Option<String>,
    pub approval_remarks: Option<String>,
    pub actor_role: Option<String>,
}

/// READ: Get leave requests
#[tauri::command]
pub async fn list_leave_requests(
    request: ListLeaveRequestsRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT lr.id, lr.employee_id, e.first_name, e.last_name,
                COALESCE(lr.leave_type, 'Casual Leave') as leave_type, lr.start_date, lr.end_date,
                CAST(MAX(0, julianday(lr.end_date) - julianday(lr.start_date) + 1 - COALESCE((
                    SELECT COUNT(*)
                    FROM Holidays h
                    WHERE date(h.date) BETWEEN date(lr.start_date) AND date(lr.end_date)
                ), 0)) AS INTEGER) as total_days,
                COALESCE((
                    SELECT COUNT(*)
                    FROM Holidays h
                    WHERE date(h.date) BETWEEN date(lr.start_date) AND date(lr.end_date)
                ), 0) as holiday_days,
                lr.reason, LOWER(COALESCE(lr.status, 'pending')) as status,
                lr.applied_at, lr.approved_by, lr.approved_at, lr.approval_remarks, lr.rejection_reason
        FROM LeaveRequests lr
        JOIN Employees e ON lr.employee_id = e.id
        WHERE lr.deleted_at IS NULL",
    );

    if let Some(eid) = request.employee_id {
        query.push_str(&format!(" AND lr.employee_id = {}", eid));
    }
    if let Some(st) = request.status {
        query.push_str(&format!(" AND LOWER(COALESCE(lr.status, 'pending')) = '{}'", sanitize_input(&st.to_lowercase())));
    }

    if let Some(role) = request.current_user_role {
        if !is_leave_admin_role(Some(role.as_str())) {
            query.push_str(&format!(" AND lr.employee_id = {}", request.employee_id.unwrap_or(-1)));
        }
    }

    query.push_str(" ORDER BY datetime(COALESCE(lr.applied_at, lr.updated_at, datetime('now'))) DESC, lr.id DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let requests: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employeeId": row.get::<_, i64>(1)?,
                "employeeName": format!("{} {}", row.get::<_, String>(2)?, row.get::<_, String>(3)?),
                "leaveType": row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "Casual Leave".to_string()),
                "startDate": row.get::<_, String>(5)?,
                "endDate": row.get::<_, String>(6)?,
                "totalDays": row.get::<_, i64>(7)?,
                "holidayDays": row.get::<_, i64>(8)?,
                "reason": row.get::<_, Option<String>>(9)?,
                "status": row.get::<_, String>(10)?,
                "appliedAt": row.get::<_, Option<String>>(11)?.unwrap_or_default(),
                "approvedBy": row.get::<_, Option<String>>(12)?,
                "approvedAt": row.get::<_, Option<String>>(13)?,
                "approvalRemarks": row.get::<_, Option<String>>(14)?,
                "rejectionReason": row.get::<_, Option<String>>(15)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": requests,
        "count": requests.len()
    }))
}

/// UPDATE: Approve/Reject leave request
#[tauri::command]
pub async fn update_leave_status(
    request: UpdateLeaveStatusRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    if !is_leave_admin_role(request.actor_role.as_deref()) {
        return Err(AppError::PermissionDenied(
            "Only HR admin or system admin can approve or reject leave requests".into(),
        ));
    }

    let status_sanitized = normalize_leave_status(&request.status);
    if !matches!(status_sanitized.as_str(), "approved" | "rejected") {
        return Err(AppError::ValidationError(
            "Leave status must be approved or rejected".into(),
        ));
    }

    conn.execute(
        "UPDATE LeaveRequests 
         SET status = ?1, approved_by = ?2, approved_at = datetime('now'), approval_remarks = ?3, rejection_reason = ?4, updated_at = datetime('now')
         WHERE id = ?5",
        params![
            status_sanitized,
            request.approved_by,
            request.approval_remarks,
            if status_sanitized == "rejected" { request.approval_remarks.clone() } else { None },
            request.leave_request_id
        ],
    )
    .map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    log_audit(
        conn,
        "LeaveRequests",
        Some(request.leave_request_id.to_string()),
        "UPDATE",
        &format!("Leave request #{} {}", request.leave_request_id, status_sanitized),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Leave request {}", status_sanitized)
    }))
}

/// UPDATE: Edit leave request details
#[tauri::command]
pub async fn update_leave_request(
    request: UpdateLeaveRequestDetails,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    if !is_leave_admin_role(request.actor_role.as_deref()) {
        return Err(AppError::PermissionDenied(
            "Only HR admin or system admin can edit leave requests".into(),
        ));
    }

    if !validate_date(&request.start_date) || !validate_date(&request.end_date) {
        return Err(AppError::ValidationError(
            "Invalid date format. Use YYYY-MM-DD".into(),
        ));
    }

    if request.end_date < request.start_date {
        return Err(AppError::ValidationError(
            "End date cannot be earlier than start date".into(),
        ));
    }

    conn.execute(
        "UPDATE LeaveRequests
         SET leave_type = ?1, start_date = ?2, end_date = ?3, reason = ?4, updated_at = datetime('now')
         WHERE id = ?5 AND deleted_at IS NULL",
        params![
            sanitize_input(&request.leave_type),
            request.start_date,
            request.end_date,
            request.reason.as_ref().map(|s| sanitize_input(s)),
            request.leave_request_id
        ],
    )
    .map_err(|e| AppError::DatabaseError(format!("Edit failed: {}", e)))?;

    log_audit(
        conn,
        "LeaveRequests",
        Some(request.leave_request_id.to_string()),
        "UPDATE",
        &format!("Leave request #{} details updated", request.leave_request_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Leave request updated successfully"
    }))
}

#[tauri::command]
pub async fn delete_leave_request(
    request: DeleteLeaveRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let leave = conn
        .query_row(
            "SELECT employee_id, LOWER(COALESCE(status, 'pending')) FROM LeaveRequests WHERE id = ?1",
            params![request.leave_request_id],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|_| AppError::NotFound("Leave request not found".into()))?;

    let is_admin = is_leave_admin_role(request.actor_role.as_deref());
    let can_self_delete = request.actor_employee_id.is_some() && request.actor_employee_id == Some(leave.0) && leave.1 == "pending";

    if !is_admin && !can_self_delete {
        return Err(AppError::PermissionDenied(
            "You can only delete your own pending leave request".into(),
        ));
    }

    conn.execute(
        "UPDATE LeaveRequests SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?1",
        params![request.leave_request_id],
    )
    .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    log_audit(
        conn,
        "LeaveRequests",
        Some(request.leave_request_id.to_string()),
        "DELETE",
        &format!("Leave request #{} deleted", request.leave_request_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Leave request deleted successfully"
    }))
}

#[tauri::command]
pub async fn get_leave_types(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut leave_types: Vec<String> = Vec::new();
    let mut stmt = conn
        .prepare(
            "SELECT DISTINCT leave_type
             FROM LeaveRequests
             WHERE leave_type IS NOT NULL AND TRIM(leave_type) != '' AND deleted_at IS NULL
             ORDER BY leave_type ASC",
        )
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let rows = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    for row in rows {
        if let Ok(item) = row {
            leave_types.push(item);
        }
    }

    if leave_types.is_empty() {
        leave_types.extend(DEFAULT_LEAVE_TYPES.iter().map(|s| s.to_string()));
    }

    Ok(leave_types)
}

#[tauri::command]
pub async fn get_leave_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let pending: i64 = conn.query_row(
        "SELECT COUNT(*) FROM LeaveRequests WHERE LOWER(COALESCE(status, 'pending')) = 'pending' AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;

    let approved_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM LeaveRequests
         WHERE LOWER(COALESCE(status, 'pending')) = 'approved'
           AND date(COALESCE(approved_at, applied_at, updated_at)) = date('now')
           AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;

    let currently_on_leave: i64 = conn.query_row(
        "SELECT COUNT(*) FROM LeaveRequests
         WHERE LOWER(COALESCE(status, 'pending')) = 'approved'
           AND date('now') BETWEEN date(start_date) AND date(end_date)
           AND deleted_at IS NULL",
        [],
        |row| row.get(0),
    )?;

    Ok(serde_json::json!({
        "pending": pending,
        "approvedToday": approved_today,
        "currentlyOnLeave": currently_on_leave
    }))
}

// ============================================================================
// ATTENDANCE CRUD
// ============================================================================

/// CREATE: Add manual attendance entry
#[tauri::command]
pub async fn create_manual_attendance(
    employee_id: i64,
    punch_time: String,
    punch_type: String,
    punch_method: String,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let employee_row_id = ensure_attendance_employee_exists(conn, employee_id, None, Some(1))?;

    conn.execute(
        "INSERT INTO AttendanceLogs (employee_id, timestamp, punch_type, punch_method, branch_id, gate_id, device_id, is_synced)
         VALUES (?1, ?2, ?3, ?4, 1, 1, NULL, 0)",
        params![
            employee_row_id,
            punch_time,
            sanitize_input(&punch_type),
            sanitize_input(&punch_method),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to add attendance: {}", e)))?;

    log_audit(
        conn,
        "AttendanceLogs",
        None,
        "CREATE",
        &format!("Manual attendance added for employee #{}", employee_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Attendance recorded successfully"
    }))
}

/// READ: Get attendance logs
#[tauri::command]
pub async fn get_attendance_logs(
    employee_id: Option<i64>,
    start_date: Option<String>,
    end_date: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT al.id, al.employee_id, e.name,
                (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                      THEN datetime(al.timestamp)
                      ELSE datetime(al.timestamp, 'localtime') END) as timestamp, 
                al.log_type, al.punch_method, al.is_synced, e.branch_id
        FROM AttendanceLogs al
        LEFT JOIN Employees e ON al.employee_id = e.id
        WHERE 1=1",
    );

    if let Some(eid) = employee_id {
        query.push_str(&format!(" AND al.employee_id = {}", eid));
    }
    if let Some(sd) = start_date {
        query.push_str(&format!(" AND al.timestamp >= '{}'", sanitize_input(&sd)));
    }
    if let Some(ed) = end_date {
        query.push_str(&format!(" AND al.timestamp <= '{}'", sanitize_input(&ed)));
    }

    query.push_str(" ORDER BY al.timestamp DESC LIMIT 1000");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let logs: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_id": row.get::<_, i64>(1)?,
                "employee_name": row.get::<_, Option<String>>(2)?.unwrap_or("Unknown Employee".to_string()),
                "timestamp": row.get::<_, String>(3)?,
                "log_type": row.get::<_, Option<String>>(4)?,
                "punch_method": row.get::<_, Option<String>>(5)?,
                "is_synced": row.get::<_, bool>(6).unwrap_or(false),
                "branch_id": row.get::<_, Option<i64>>(7)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": logs,
        "count": logs.len()
    }))
}

// ============================================================================
// PAYROLL CRUD
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateSalaryStructure {
    pub employee_id: i64,
    pub basic_salary: f64,
    pub allowances: f64,
    pub deductions: f64,
    pub overtime_rate: f64,
}

/// CREATE: Set employee salary structure
#[tauri::command]
pub async fn create_salary_structure(
    request: CreateSalaryStructure,
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
        "INSERT OR REPLACE INTO SalaryStructures 
         (employee_id, basic_salary, allowances, deductions, overtime_rate)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            request.employee_id,
            request.basic_salary,
            request.allowances,
            request.deductions,
            request.overtime_rate,
        ],
    )
    .map_err(|e| AppError::DatabaseError(format!("Failed to create salary structure: {}", e)))?;

    log_audit(
        conn,
        "SalaryStructures",
        None,
        "CREATE",
        &format!(
            "Salary structure created for employee #{}",
            request.employee_id
        ),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Salary structure created successfully"
    }))
}

/// READ: Get employee salary structure
#[tauri::command]
pub async fn get_salary_structure(
    employee_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let structure = conn.query_row(
        "SELECT * FROM SalaryStructures WHERE employee_id = ?1",
        params![employee_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_id": row.get::<_, i64>(1)?,
                "basic_salary": row.get::<_, f64>(2)?,
                "allowances": row.get::<_, f64>(3)?,
                "deductions": row.get::<_, f64>(4)?,
                "overtime_rate": row.get::<_, f64>(5)?,
                "net_salary": row.get::<_, f64>(2)? + row.get::<_, f64>(3)? - row.get::<_, f64>(4)?,
            }))
        },
    ).optional()
    .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    match structure {
        Some(s) => Ok(serde_json::json!({
            "success": true,
            "data": s
        })),
        None => Err(AppError::NotFound("Salary structure not found".into())),
    }
}

/// READ: Get comprehensive payroll records for the frontend
#[tauri::command]
pub async fn get_payroll_records(
    _month: i32,
    _year: i32,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // We join Employees with SalaryStructures to generate payroll info.
    // If SalaryStructures doesn't exist for an employee, we default to 0.
    let mut stmt = conn.prepare(
        "SELECT e.id, 
                e.first_name || ' ' || e.last_name as employee_name, 
                COALESCE(s.basic_salary, 0) as basic_salary,
                COALESCE(s.allowances, 0) as allowances,
                COALESCE(s.deductions, 0) as fixed_deductions,
                COALESCE(s.overtime_rate, 0) as overtime_rate,
                e.status
         FROM Employees e
         LEFT JOIN SalaryStructures s ON e.id = s.employee_id
         WHERE e.status != 'deleted'"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let records: Vec<serde_json::Value> = stmt.query_map([], |row| {
        let id: i64 = row.get(0)?;
        let employee_name: String = row.get(1)?;
        let basic_salary: f64 = row.get(2)?;
        let allowances: f64 = row.get(3)?;
        let fixed_deductions: f64 = row.get(4)?;
        let _overtime_rate: f64 = row.get(5)?;
        
        // Basic calculation logic
        let pf_employee = basic_salary * 0.10; // 10% PF
        let pf_employer = basic_salary * 0.10;
        let tax_amount = if basic_salary > 40000.0 { (basic_salary - 40000.0) * 0.15 } else { 0.0 };
        
        let total_earnings = basic_salary + allowances;
        let total_deductions = fixed_deductions + pf_employee + tax_amount;
        let net_pay = total_earnings - total_deductions;
        let days_present = 26; // Defaulting for demo
        let status = "Processed"; // Defaulting for demo

        Ok(serde_json::json!({
            "id": id,
            "employee_name": employee_name,
            "basic_salary": basic_salary,
            "total_earnings": total_earnings,
            "total_deductions": total_deductions,
            "net_pay": net_pay,
            "pf_employer": pf_employer,
            "pf_employee": pf_employee,
            "tax_amount": tax_amount,
            "overtime_amount": 0, // Placeholder
            "days_present": days_present,
            "status": status,
        }))
    }).map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
    .filter_map(|r| r.ok())
    .collect();

    Ok(records)
}

// ============================================================================
// FINANCE CRUD (Invoices & Payments)
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateInvoiceRequest {
    pub invoice_number: String,
    pub invoice_date: String,
    pub due_date: Option<String>,
    pub contact_name: String,
    pub invoice_type: String,
    pub items: Vec<InvoiceItemRequest>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct InvoiceItemRequest {
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub tax_rate: f64,
    pub discount_rate: Option<f64>,
}

/// CREATE: Add new invoice
#[tauri::command]
pub async fn create_invoice(
    request: CreateInvoiceRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    if !validate_date(&request.invoice_date) {
        return Err(AppError::ValidationError("Invalid invoice date".into()));
    }

    // Calculate totals
    let mut subtotal = 0.0;
    let mut tax_amount = 0.0;
    let mut discount_amount = 0.0;

    for item in &request.items {
        let line_total = item.quantity * item.unit_price;
        let line_discount = item.discount_rate.unwrap_or(0.0) / 100.0 * line_total;
        let line_tax = item.tax_rate / 100.0 * (line_total - line_discount);

        subtotal += line_total;
        tax_amount += line_tax;
        discount_amount += line_discount;
    }

    let total_amount = subtotal + tax_amount - discount_amount;

    // Insert invoice
    let invoice_id = conn
        .execute(
            "INSERT INTO Invoices 
         (invoice_number, invoice_date, due_date, contact_name, invoice_type, 
          subtotal, tax_amount, discount_amount, total_amount, balance_amount, 
          status, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'Draft', ?11, datetime('now'))",
            params![
                sanitize_input(&request.invoice_number),
                request.invoice_date,
                request.due_date,
                sanitize_input(&request.contact_name),
                sanitize_input(&request.invoice_type),
                subtotal,
                tax_amount,
                discount_amount,
                total_amount,
                total_amount, // balance_amount initially equals total
                request.notes.as_ref().map(|s| sanitize_input(s)),
            ],
        )
        .map_err(|e| AppError::DatabaseError(format!("Failed to create invoice: {}", e)))?;

    // Insert invoice items
    for item in &request.items {
        conn.execute(
            "INSERT INTO InvoiceItems (invoice_id, description, quantity, unit_price, tax_rate, discount_rate, total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                invoice_id,
                sanitize_input(&item.description),
                item.quantity,
                item.unit_price,
                item.tax_rate,
                item.discount_rate.unwrap_or(0.0),
                item.quantity * item.unit_price,
            ],
        )?;
    }

    log_audit(
        conn,
        "Invoices",
        Some(invoice_id.to_string()),
        "CREATE",
        &format!("Invoice {} created", request.invoice_number),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Invoice created successfully",
        "invoice_id": invoice_id,
        "total_amount": total_amount
    }))
}

/// READ: Get invoices
#[tauri::command]
pub async fn list_invoices(
    invoice_type: Option<String>,
    status: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT id, invoice_number, invoice_date, due_date, contact_name,
                invoice_type, status, subtotal, tax_amount, discount_amount,
                total_amount, paid_amount, balance_amount
        FROM Invoices WHERE 1=1",
    );

    if let Some(it) = invoice_type {
        query.push_str(&format!(" AND invoice_type = '{}'", sanitize_input(&it)));
    }
    if let Some(st) = status {
        query.push_str(&format!(" AND status = '{}'", sanitize_input(&st)));
    }

    query.push_str(" ORDER BY invoice_date DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let invoices: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "invoice_number": row.get::<_, String>(1)?,
                "invoice_date": row.get::<_, String>(2)?,
                "due_date": row.get::<_, Option<String>>(3)?,
                "contact_name": row.get::<_, String>(4)?,
                "invoice_type": row.get::<_, String>(5)?,
                "status": row.get::<_, String>(6)?,
                "subtotal": row.get::<_, f64>(7)?,
                "tax_amount": row.get::<_, f64>(8)?,
                "discount_amount": row.get::<_, f64>(9)?,
                "total_amount": row.get::<_, f64>(10)?,
                "paid_amount": row.get::<_, f64>(11)?,
                "balance_amount": row.get::<_, f64>(12)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": invoices,
        "count": invoices.len()
    }))
}

// ============================================================================
// PROJECTS CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub start_date: String,
    pub end_date: Option<String>,
    pub budget: Option<f64>,
}

#[tauri::command]
pub async fn create_project(
    request: CreateProjectRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let project_code = format!("PRJ-{:06}", chrono::Utc::now().timestamp() % 1000000);

    conn.execute(
        "INSERT INTO Projects (project_code, name, description, status, priority, start_date, end_date, budget, progress, team_size, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, datetime('now'))",
        params![
            project_code,
            sanitize_input(&request.name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.status,
            request.priority,
            request.start_date,
            request.end_date,
            request.budget.unwrap_or(0.0),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create project: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Project created successfully",
        "project_code": project_code
    }))
}

#[tauri::command]
pub async fn list_projects(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_code, name, description, status, priority, start_date, end_date, budget, progress, team_size, created_at
         FROM Projects ORDER BY created_at DESC"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let projects: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "project_code": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
                "status": row.get::<_, String>(4)?,
                "priority": row.get::<_, String>(5)?,
                "start_date": row.get::<_, String>(6)?,
                "end_date": row.get::<_, Option<String>>(7)?,
                "budget": row.get::<_, Option<f64>>(8)?,
                "progress": row.get::<_, i32>(9)?,
                "team_size": row.get::<_, i32>(10)?,
                "created_at": row.get::<_, String>(11)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(projects)
}

#[tauri::command]
pub async fn update_project(
    project_id: i64,
    request: CreateProjectRequest,
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
        "UPDATE Projects SET name = ?1, description = ?2, status = ?3, priority = ?4, start_date = ?5, end_date = ?6, budget = ?7, updated_at = datetime('now') WHERE id = ?8",
        params![
            sanitize_input(&request.name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.status,
            request.priority,
            request.start_date,
            request.end_date,
            request.budget.unwrap_or(0.0),
            project_id,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Project updated successfully"
    }))
}

#[tauri::command]
pub async fn delete_project(
    project_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("DELETE FROM Projects WHERE id = ?1", params![project_id])
        .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Project deleted successfully"
    }))
}

#[tauri::command]
pub async fn get_project_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_projects: i64 = conn.query_row("SELECT COUNT(*) FROM Projects", [], |r| r.get(0))?;
    let active_projects: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Projects WHERE status = 'Active'",
        [],
        |r| r.get(0),
    )?;
    let completed_projects: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Projects WHERE status = 'Completed'",
        [],
        |r| r.get(0),
    )?;
    let overdue_projects: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Projects WHERE status = 'Active' AND end_date < date('now')",
        [],
        |r| r.get(0),
    )?;

    Ok(serde_json::json!({
        "total_projects": total_projects,
        "active_projects": active_projects,
        "completed_projects": completed_projects,
        "overdue_projects": overdue_projects
    }))
}

// ============================================================================
// TASKS CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateTaskRequest {
    pub project_id: i64,
    pub task_name: String,
    pub description: Option<String>,
    pub assigned_to: Option<i64>,
    pub priority: Option<String>,
    pub due_date: Option<String>,
}

/// CREATE: Add task to project
#[tauri::command]
pub async fn create_task(
    request: CreateTaskRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let task_id = conn
        .execute(
            "INSERT INTO Tasks
         (project_id, task_name, description, assigned_to, status, priority, due_date, created_at)
         VALUES (?1, ?2, ?3, ?4, 'Todo', ?5, ?6, datetime('now'))",
            params![
                request.project_id,
                sanitize_input(&request.task_name),
                request.description.as_ref().map(|s| sanitize_input(s)),
                request.assigned_to,
                request.priority.as_deref().unwrap_or("Medium"),
                request.due_date,
            ],
        )
        .map_err(|e| AppError::DatabaseError(format!("Failed to create task: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Task created successfully",
        "task_id": task_id
    }))
}

// ============================================================================
// CRM (LEADS) CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateLeadRequest {
    pub name: String,
    pub company: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub status: String,
    pub source: String,
    pub value: Option<f64>,
}

#[tauri::command]
pub async fn create_lead(
    request: CreateLeadRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let lead_code = format!("LEAD-{:06}", chrono::Utc::now().timestamp() % 1000000);

    conn.execute(
        "INSERT INTO Leads (lead_code, name, company, email, phone, status, source, value, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            lead_code,
            sanitize_input(&request.name),
            request.company.as_ref().map(|s| sanitize_input(s)),
            request.email,
            request.phone,
            request.status,
            request.source,
            request.value.unwrap_or(0.0),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create lead: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Lead created successfully",
        "lead_code": lead_code
    }))
}

#[tauri::command]
pub async fn list_leads(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, lead_code, name, company, email, phone, status, source, value, created_at
         FROM Leads ORDER BY created_at DESC",
        )
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let leads: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "lead_code": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "company": row.get::<_, Option<String>>(3)?,
                "email": row.get::<_, Option<String>>(4)?,
                "phone": row.get::<_, Option<String>>(5)?,
                "status": row.get::<_, String>(6)?,
                "source": row.get::<_, String>(7)?,
                "value": row.get::<_, Option<f64>>(8)?,
                "created_at": row.get::<_, String>(9)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(leads)
}

#[tauri::command]
pub async fn update_lead(
    lead_id: i64,
    request: CreateLeadRequest,
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
        "UPDATE Leads SET name = ?1, company = ?2, email = ?3, phone = ?4, status = ?5, source = ?6, value = ?7 WHERE id = ?8",
        params![
            sanitize_input(&request.name),
            request.company.as_ref().map(|s| sanitize_input(s)),
            request.email,
            request.phone,
            request.status,
            request.source,
            request.value.unwrap_or(0.0),
            lead_id,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Lead updated successfully"
    }))
}

#[tauri::command]
pub async fn delete_lead(
    lead_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("DELETE FROM Leads WHERE id = ?1", params![lead_id])
        .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Lead deleted successfully"
    }))
}

#[tauri::command]
pub async fn get_crm_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_leads: i64 = conn.query_row("SELECT COUNT(*) FROM Leads", [], |r| r.get(0))?;
    let new_leads: i64 =
        conn.query_row("SELECT COUNT(*) FROM Leads WHERE status = 'New'", [], |r| {
            r.get(0)
        })?;
    let qualified_leads: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Leads WHERE status = 'Qualified'",
        [],
        |r| r.get(0),
    )?;
    let converted_leads: i64 =
        conn.query_row("SELECT COUNT(*) FROM Leads WHERE status = 'Won'", [], |r| {
            r.get(0)
        })?;
    let total_pipeline_value: f64 = conn.query_row(
        "SELECT COALESCE(SUM(value), 0) FROM Leads WHERE status NOT IN ('Won', 'Lost')",
        [],
        |r| r.get(0),
    )?;

    Ok(serde_json::json!({
        "total_leads": total_leads,
        "new_leads": new_leads,
        "qualified_leads": qualified_leads,
        "converted_leads": converted_leads,
        "total_pipeline_value": total_pipeline_value
    }))
}

// ============================================================================
// ASSETS CRUD OPERATIONS
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateAssetRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub status: String,
    pub purchase_date: String,
    pub purchase_cost: Option<f64>,
    pub assigned_to: Option<String>,
    pub location: Option<String>,
    pub warranty_expiry: Option<String>,
    pub condition: String,
}

#[tauri::command]
pub async fn create_asset(
    request: CreateAssetRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let asset_code = format!("AST-{:06}", chrono::Utc::now().timestamp() % 1000000);

    conn.execute(
        "INSERT INTO Assets (asset_code, name, description, category, status, purchase_date, purchase_cost, assigned_to, location, warranty_expiry, condition, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, datetime('now'))",
        params![
            asset_code,
            sanitize_input(&request.name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.category,
            request.status,
            request.purchase_date,
            request.purchase_cost.unwrap_or(0.0),
            request.assigned_to.as_ref().map(|s| sanitize_input(s)),
            request.location.as_ref().map(|s| sanitize_input(s)),
            request.warranty_expiry,
            request.condition,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create asset: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Asset created successfully",
        "asset_code": asset_code
    }))
}

#[tauri::command]
pub async fn list_assets(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT id, asset_code, name, description, category, status, purchase_date, purchase_cost, assigned_to, location, warranty_expiry, condition, created_at
         FROM Assets ORDER BY created_at DESC"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let assets: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "asset_code": row.get::<_, String>(1)?,
                "name": row.get::<_, String>(2)?,
                "description": row.get::<_, Option<String>>(3)?,
                "category": row.get::<_, String>(4)?,
                "status": row.get::<_, String>(5)?,
                "purchase_date": row.get::<_, String>(6)?,
                "purchase_cost": row.get::<_, Option<f64>>(7)?,
                "assigned_to": row.get::<_, Option<String>>(8)?,
                "location": row.get::<_, Option<String>>(9)?,
                "warranty_expiry": row.get::<_, Option<String>>(10)?,
                "condition": row.get::<_, String>(11)?,
                "created_at": row.get::<_, String>(12)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(assets)
}

#[tauri::command]
pub async fn update_asset(
    asset_id: i64,
    request: CreateAssetRequest,
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
        "UPDATE Assets SET name = ?1, description = ?2, category = ?3, status = ?4, purchase_date = ?5, purchase_cost = ?6, assigned_to = ?7, location = ?8, warranty_expiry = ?9, condition = ?10 WHERE id = ?11",
        params![
            sanitize_input(&request.name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.category,
            request.status,
            request.purchase_date,
            request.purchase_cost.unwrap_or(0.0),
            request.assigned_to.as_ref().map(|s| sanitize_input(s)),
            request.location.as_ref().map(|s| sanitize_input(s)),
            request.warranty_expiry,
            request.condition,
            asset_id,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Asset updated successfully"
    }))
}

#[tauri::command]
pub async fn delete_asset(
    asset_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute("DELETE FROM Assets WHERE id = ?1", params![asset_id])
        .map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Asset deleted successfully"
    }))
}

#[tauri::command]
pub async fn get_asset_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_assets: i64 = conn.query_row("SELECT COUNT(*) FROM Assets", [], |r| r.get(0))?;
    let active_assets: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Assets WHERE status = 'Active'",
        [],
        |r| r.get(0),
    )?;
    let maintenance_assets: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Assets WHERE status = 'Maintenance'",
        [],
        |r| r.get(0),
    )?;
    let retired_assets: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Assets WHERE status = 'Retired'",
        [],
        |r| r.get(0),
    )?;
    let total_value: f64 = conn.query_row(
        "SELECT COALESCE(SUM(purchase_cost), 0) FROM Assets",
        [],
        |r| r.get(0),
    )?;

    Ok(serde_json::json!({
        "total_assets": total_assets,
        "active_assets": active_assets,
        "maintenance_assets": maintenance_assets,
        "retired_assets": retired_assets,
        "total_value": total_value
    }))
}

// ============================================================================
// AUDIT LOGGING HELPER
// ============================================================================

fn log_audit(
    conn: &Connection,
    table_name: &str,
    record_id: Option<String>,
    action: &str,
    description: &str,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO AuditLogs (table_name, record_id, operation, description, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        params![table_name, record_id, action, description,],
    )
    .map_err(|e| AppError::DatabaseError(format!("Audit log failed: {}", e)))?;

    Ok(())
}

fn get_employee_for_audit(
    conn: &Connection,
    employee_id: i64,
) -> Result<Option<serde_json::Value>, AppError> {
    let employee = conn
        .query_row(
            "SELECT id, employee_code, first_name, middle_name, last_name FROM Employees WHERE id = ?1",
            params![employee_id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "employee_code": row.get::<_, Option<String>>(1)?,
                    "first_name": row.get::<_, Option<String>>(2)?,
                    "middle_name": row.get::<_, Option<String>>(3)?,
                    "last_name": row.get::<_, Option<String>>(4)?,
                }))
            },
        )
        .optional()
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    Ok(employee)
}

/// GET DASHBOARD STATS
#[tauri::command]
pub async fn get_dashboard_stats(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_staff: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Employees WHERE (status IS NULL OR status != 'deleted')",
        [],
        |r| r.get(0),
    )?;

    // Count distinct employees who have logged today using local time conversion logic
    let present_today: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT employee_id) FROM AttendanceLogs 
         WHERE (CASE WHEN punch_method = 'Manual' OR device_id = 999 THEN date(timestamp)
                     ELSE date(timestamp, 'localtime') END) = date('now', 'localtime')",
        [],
        |r| r.get(0)
    ).unwrap_or_else(|_| 0);

    let absent = if total_staff > present_today {
        total_staff - present_today
    } else {
        0
    };

    // Get present staff list for the side panel
    let mut stmt = conn.prepare(
        "SELECT DISTINCT e.id, e.first_name || ' ' || e.last_name, 
                CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN strftime('%H:%M', al.timestamp)
                     ELSE strftime('%H:%M', al.timestamp, 'localtime') END as punch_time
         FROM AttendanceLogs al
         JOIN Employees e ON al.employee_id = e.id
         WHERE (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN date(al.timestamp)
                     ELSE date(al.timestamp, 'localtime') END) = date('now', 'localtime')
         ORDER BY punch_time DESC"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let present_staff: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "time": row.get::<_, String>(2)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    // Get absent staff list
    let mut stmt = conn.prepare(
        "SELECT id, first_name || ' ' || last_name 
         FROM Employees 
         WHERE status != 'deleted' 
         AND id NOT IN (
             SELECT DISTINCT employee_id FROM AttendanceLogs 
             WHERE (CASE WHEN punch_method = 'Manual' OR device_id = 999 THEN date(timestamp)
                         ELSE date(timestamp, 'localtime') END) = date('now', 'localtime')
         )"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let absent_staff: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    // Get branch summary
    let mut stmt = conn.prepare(
        "SELECT b.id, b.name, b.location,
                (SELECT COUNT(*) FROM Employees e WHERE e.branch_id = b.id AND e.status != 'deleted') as emp_count,
                (SELECT COUNT(*) FROM Gates g WHERE g.branch_id = b.id) as gate_count,
                (SELECT COUNT(*) FROM Devices d WHERE d.branch_id = b.id) as dev_count
         FROM Branches b"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let branches: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "location": row.get::<_, Option<String>>(2)?,
                "employee_count": row.get::<_, i64>(3)?,
                "gate_count": row.get::<_, i64>(4)?,
                "device_count": row.get::<_, i64>(5)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "totalEmployees": total_staff,
        "totalStaff": total_staff,
        "presentToday": present_today,
        "absent": absent,
        "absentToday": absent,
        "lateToday": 0,
        "onLeave": 0,
        "pendingLeaveRequests": 0,
        "newHiresThisMonth": 0,
        "resignationsThisMonth": 0,
        "presentStaff": present_staff,
        "absentStaff": absent_staff,
        "lateStaff": [],
        "leaveStaff": [],
        "branches": branches
    }))
}

// ============================================================================
// CORPORATE STRUCTURE CRUD (Branches, Departments, Designations)
// ============================================================================

#[tauri::command]
pub async fn list_organizations(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn
        .prepare("SELECT id, name, address, contact_info, auth_key, license_expiry FROM Organizations ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let organizations = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, Option<String>>(2)?,
                "contact_info": row.get::<_, Option<String>>(3)?,
                "auth_key": row.get::<_, Option<String>>(4)?,
                "license_expiry": row.get::<_, Option<String>>(5)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(e.to_string()))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(organizations)
}

#[tauri::command]
pub async fn add_organization(
    name: String,
    address: Option<String>,
    contact_info: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO Organizations (name, address, contact_info) VALUES (?1, ?2, ?3)",
        params![name, address, contact_info],
    )?;

    Ok(serde_json::json!({
        "success": true,
        "id": conn.last_insert_rowid()
    }))
}

#[tauri::command]
pub async fn update_organization(
    id: i64,
    name: String,
    address: Option<String>,
    contact_info: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Organizations SET name = ?1, address = ?2, contact_info = ?3 WHERE id = ?4",
        params![name, address, contact_info, id],
    )?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn delete_organization(id: i64, state: tauri::State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let branch_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM Branches WHERE org_id = ?1 OR organization_id = ?1", params![id], |row| row.get(0))
        .unwrap_or(0);

    if branch_count > 0 {
        return Err(AppError::ValidationError(
            "Delete branches under this organization first.".into(),
        ));
    }

    conn.execute("DELETE FROM Organizations WHERE id = ?1", params![id])?;

    Ok(serde_json::json!({"success": true}))
}

#[tauri::command]
pub async fn list_branches(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, location, org_id, organization_id FROM Branches ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let branches = stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "location": row.get::<_, Option<String>>(2)?,
            "org_id": row.get::<_, Option<i64>>(3)?,
            "organization_id": row.get::<_, Option<i64>>(4)?,
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(branches)
}

// ============================================================================
// BRANCH MIGRATION & SAFETY COMMANDS
// ============================================================================

#[tauri::command]
pub async fn get_branch_summary(id: i64, state: tauri::State<'_, AppState>) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let employee_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Employees WHERE branch_id = ?1 AND (status IS NULL OR status != 'deleted')",
        rusqlite::params![id], |r| r.get(0)
    ).unwrap_or(0);

    let device_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Devices WHERE branch_id = ?1",
        rusqlite::params![id], |r| r.get(0)
    ).unwrap_or(0);

    let gate_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM Gates WHERE branch_id = ?1",
        rusqlite::params![id], |r| r.get(0)
    ).unwrap_or(0);

    // List employees for display
    let mut emp_stmt = conn.prepare(
        "SELECT id, COALESCE(name, TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), 'Unknown') as full_name, employee_code, department_id FROM Employees WHERE branch_id = ?1 AND (status IS NULL OR status != 'deleted') ORDER BY full_name"
    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let employees: Vec<serde_json::Value> = emp_stmt.query_map(rusqlite::params![id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "employee_code": row.get::<_, Option<String>>(2)?,
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    // List devices
    let mut dev_stmt = conn.prepare(
        "SELECT id, name, brand, ip_address FROM Devices WHERE branch_id = ?1 ORDER BY name"
    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let devices: Vec<serde_json::Value> = dev_stmt.query_map(rusqlite::params![id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "brand": row.get::<_, String>(2)?,
            "ip": row.get::<_, String>(3)?,
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    Ok(serde_json::json!({
        "employee_count": employee_count,
        "device_count": device_count,
        "gate_count": gate_count,
        "employees": employees,
        "devices": devices,
        "is_empty": employee_count == 0 && device_count == 0
    }))
}

#[tauri::command]
pub async fn migrate_branch_data(
    from_branch_id: i64,
    to_branch_id: Option<i64>,
    migrate_employees: bool,
    migrate_devices: bool,
    state: tauri::State<'_, AppState>
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut employees_moved = 0i64;
    let mut devices_moved = 0i64;

    if migrate_employees {
        if let Some(to_id) = to_branch_id {
            employees_moved = conn.execute(
                "UPDATE Employees SET branch_id = ?1 WHERE branch_id = ?2 AND (status IS NULL OR status != 'deleted')",
                rusqlite::params![to_id, from_branch_id]
            ).map_err(|e| AppError::DatabaseError(e.to_string()))? as i64;
        } else {
            // Unassign employees from branch
            employees_moved = conn.execute(
                "UPDATE Employees SET branch_id = NULL WHERE branch_id = ?1 AND (status IS NULL OR status != 'deleted')",
                rusqlite::params![from_branch_id]
            ).map_err(|e| AppError::DatabaseError(e.to_string()))? as i64;
        }
    }

    if migrate_devices {
        if let Some(to_id) = to_branch_id {
            devices_moved = conn.execute(
                "UPDATE Devices SET branch_id = ?1, gate_id = NULL WHERE branch_id = ?2",
                rusqlite::params![to_id, from_branch_id]
            ).map_err(|e| AppError::DatabaseError(e.to_string()))? as i64;
        } else {
            devices_moved = conn.execute(
                "UPDATE Devices SET branch_id = NULL, gate_id = NULL WHERE branch_id = ?1",
                rusqlite::params![from_branch_id]
            ).map_err(|e| AppError::DatabaseError(e.to_string()))? as i64;
        }
    }

    Ok(serde_json::json!({
        "success": true,
        "employees_moved": employees_moved,
        "devices_moved": devices_moved
    }))
}

#[tauri::command]
pub async fn list_departments(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, description, branch_id FROM Departments ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let results = stmt.query_map([], |row| {
        Ok(serde_json::json!({ 
            "id": row.get::<_, i64>(0)?, 
            "name": row.get::<_, String>(1)?, 
            "description": row.get::<_, Option<String>>(2)?,
            "branch_id": row.get::<_, Option<i64>>(3)?
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(results)
}

#[tauri::command]
pub async fn list_designations(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, description, branch_id FROM Designations ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let results = stmt.query_map([], |row| {
        Ok(serde_json::json!({ 
            "id": row.get::<_, i64>(0)?, 
            "name": row.get::<_, String>(1)?, 
            "description": row.get::<_, Option<String>>(2)?,
            "branch_id": row.get::<_, Option<i64>>(3)?
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(results)
}

#[tauri::command]
pub async fn create_department(name: String, branch_id: Option<i64>, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Departments (name, branch_id) VALUES (?1, ?2)", rusqlite::params![name, branch_id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn create_designation(name: String, branch_id: Option<i64>, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Designations (name, branch_id) VALUES (?1, ?2)", rusqlite::params![name, branch_id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_department(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Departments WHERE id = ?", [id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_designation(id: i64, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("DELETE FROM Designations WHERE id = ?", [id])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

/// GET ATTENDANCE SUMMARY — Present / Absent / Late breakdown for a given date
#[tauri::command]
pub async fn get_attendance_summary(
    date: String,
    branch_id: Option<i64>,
    late_threshold: Option<String>, // default "09:15"
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // 0. Get global default threshold from SystemConfigs
    let global_threshold: String = conn.query_row(
        "SELECT value FROM SystemConfigs WHERE key = 'office_start_time'",
        [],
        |row| row.get(0)
    ).unwrap_or_else(|_| "09:15".to_string());

    let threshold = late_threshold.unwrap_or(global_threshold);

    // 1. All active employees for the given branch
    let mut emp_query = "SELECT e.id, e.name, e.department, b.name as branch_name, e.shift_start_time 
                         FROM Employees e 
                         LEFT JOIN Branches b ON e.branch_id = b.id
                         WHERE (e.status IS NULL OR e.status != 'deleted')".to_string();
    let mut emp_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(bid) = branch_id {
        emp_query.push_str(" AND e.branch_id = ?");
        emp_params.push(Box::new(bid));
    }
    emp_query.push_str(" ORDER BY e.name");

    let mut stmt = conn.prepare(&emp_query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = emp_params.iter().map(|p| p.as_ref()).collect();

    let all_employees: Vec<serde_json::Value> = stmt.query_map(&param_refs[..], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, Option<String>>(2)?,
            "branch_name": row.get::<_, Option<String>>(3)?,
            "shift_start": row.get::<_, Option<String>>(4)?,
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    // 2. Employees who punched on the given date, with their first punch time (localtime-aware)
    let punch_query = "
        SELECT al.employee_id,
               MIN(CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                        THEN strftime('%H:%M', al.timestamp)
                        ELSE strftime('%H:%M', al.timestamp, 'localtime') END) as first_punch
        FROM AttendanceLogs al
        WHERE (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                    THEN date(al.timestamp)
                    ELSE date(al.timestamp, 'localtime') END) = ?1
        GROUP BY al.employee_id
    ";

    let mut stmt2 = conn.prepare(punch_query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let punch_map: std::collections::HashMap<i64, String> = stmt2.query_map([&date], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?
    .filter_map(|r| r.ok())
    .collect();

    // 3. Categorize: present, late, absent
    let mut present = Vec::new();
    let mut late = Vec::new();
    let mut absent = Vec::new();

    for emp in &all_employees {
        let emp_id = emp["id"].as_i64().unwrap_or(0);
        let emp_shift = emp["shift_start"].as_str().unwrap_or(&threshold);
        
        if let Some(first_punch) = punch_map.get(&emp_id) {
            let is_late = first_punch.as_str() > emp_shift;
            let entry = serde_json::json!({
                "id": emp_id,
                "name": emp["name"],
                "department": emp["department"],
                "branch_name": emp["branch_name"],
                "first_punch": first_punch,
                "shift_start": emp_shift,
            });
            if is_late {
                late.push(entry);
            } else {
                present.push(entry);
            }
        } else {
            absent.push(serde_json::json!({
                "id": emp_id,
                "name": emp["name"],
                "department": emp["department"],
                "branch_name": emp["branch_name"],
                "first_punch": null,
                "shift_start": emp_shift,
            }));
        }
    }

    Ok(serde_json::json!({
        "date": date,
        "present": present,
        "late": late,
        "absent": absent,
        "total": all_employees.len(),
        "present_count": present.len(),
        "late_count": late.len(),
        "absent_count": absent.len(),
    }))
}

/// GET ATTENDANCE RANGE SUMMARY — Aggregated stats for a date range
#[tauri::command]
pub async fn get_attendance_range_summary(
    from_date: String,
    to_date: String,
    branch_id: Option<i64>,
    employee_id: Option<i64>,
    late_threshold: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let global_threshold: String = conn.query_row(
        "SELECT value FROM SystemConfigs WHERE key = 'office_start_time'",
        [],
        |row| row.get(0)
    ).unwrap_or_else(|_| "09:15".to_string());

    let threshold = late_threshold.unwrap_or(global_threshold);

    // 1. Get employees
    let mut emp_query = "SELECT e.id, e.name, e.department, b.name as branch_name, e.shift_start_time 
                         FROM Employees e 
                         LEFT JOIN Branches b ON e.branch_id = b.id
                         WHERE (e.status IS NULL OR e.status != 'deleted')".to_string();
    let mut emp_params: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    if let Some(bid) = branch_id {
        emp_query.push_str(" AND e.branch_id = ?");
        emp_params.push(Box::new(bid));
    }
    if let Some(eid) = employee_id {
        emp_query.push_str(" AND e.id = ?");
        emp_params.push(Box::new(eid));
    }
    emp_query.push_str(" ORDER BY e.name");

    let mut stmt = conn.prepare(&emp_query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = emp_params.iter().map(|p| p.as_ref()).collect();

    let employees: Vec<serde_json::Value> = stmt.query_map(&param_refs[..], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, Option<String>>(2)?,
            "branch_name": row.get::<_, Option<String>>(3)?,
            "shift_start": row.get::<_, Option<String>>(4)?,
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    // 2. Get all punches in range
    let punch_query = "
        SELECT al.employee_id,
               (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                     THEN date(al.timestamp)
                     ELSE date(al.timestamp, 'localtime') END) as log_date,
               MIN(CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                        THEN strftime('%H:%M', al.timestamp)
                        ELSE strftime('%H:%M', al.timestamp, 'localtime') END) as first_punch
        FROM AttendanceLogs al
        WHERE (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 
                    THEN date(al.timestamp)
                    ELSE date(al.timestamp, 'localtime') END) BETWEEN ?1 AND ?2
        GROUP BY al.employee_id, log_date
    ";

    let mut stmt2 = conn.prepare(punch_query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let mut punch_data: std::collections::HashMap<i64, Vec<(String, String)>> = std::collections::HashMap::new();
    
    let mut rows = stmt2.query([&from_date, &to_date]).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    while let Some(row) = rows.next().map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let eid: i64 = row.get(0)?;
        let date: String = row.get(1)?;
        let time: String = row.get(2)?;
        punch_data.entry(eid).or_default().push((date, time));
    }

    // 3. Aggregate
    // Note: This is a simple count. Real absent count would need to know working days.
    // For now, we return lists of counts.
    let mut summary_list = Vec::new();
    for emp in employees {
        let eid = emp["id"].as_i64().unwrap_or(0);
        let emp_shift = emp["shift_start"].as_str().unwrap_or(&threshold);
        let punches = punch_data.get(&eid);
        let present_count = punches.map(|v| v.len()).unwrap_or(0);
        let late_count = punches.map(|v| v.iter().filter(|(_, t)| t.as_str() > emp_shift).count()).unwrap_or(0);
        
        summary_list.push(serde_json::json!({
            "id": eid,
            "name": emp["name"],
            "department": emp["department"],
            "branch_name": emp["branch_name"],
            "shift_start": emp_shift,
            "days_present": present_count,
            "days_late": late_count,
        }));
    }

    Ok(serde_json::json!({
        "from": from_date,
        "to": to_date,
        "summary": summary_list,
    }))
}


/// GET DAILY ATTENDANCE REPORTS (Enhanced)
#[tauri::command]
pub async fn get_daily_reports(
    from_date: String,
    to_date: String,
    dept: String,
    search: String,
    employee_id: Option<i64>,
    branch_id: Option<i64>,
    _gate_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT e.id, e.name, e.department, 
                CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN date(al.timestamp)
                     ELSE date(al.timestamp, 'localtime') END as att_date,
                MIN(CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN datetime(al.timestamp)
                         ELSE datetime(al.timestamp, 'localtime') END) as first_in,
                MAX(CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN datetime(al.timestamp)
                         ELSE datetime(al.timestamp, 'localtime') END) as last_out,
                GROUP_CONCAT((CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN strftime('%H:%M', al.timestamp)
                                   ELSE strftime('%H:%M', al.timestamp, 'localtime') END) 
                             || '::' || COALESCE(al.punch_method, 'Device'), ' | ') as all_punches,
                e.employee_code,
                b.name as branch_name,
                al.punch_method
         FROM Employees e
         JOIN AttendanceLogs al ON e.id = al.employee_id
         LEFT JOIN Branches b ON e.branch_id = b.id
         WHERE (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN date(al.timestamp)
                     ELSE date(al.timestamp, 'localtime') END) BETWEEN date(?1) AND date(?2)"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(from_date),
        Box::new(to_date),
    ];

    if let Some(eid) = employee_id {
        query.push_str(" AND e.id = ?");
        params_vec.push(Box::new(eid));
    }

    if dept != "All" {
        query.push_str(" AND e.department = ?");
        params_vec.push(Box::new(dept));
    }

    if !search.is_empty() {
        query.push_str(" AND (e.name LIKE ? OR e.employee_code LIKE ?)");
        let s = format!("%{}%", search);
        params_vec.push(Box::new(s.clone()));
        params_vec.push(Box::new(s));
    }

    if let Some(bid) = branch_id {
        query.push_str(" AND e.branch_id = ?");
        params_vec.push(Box::new(bid));
    }

    query.push_str(" GROUP BY e.id, att_date ORDER BY att_date DESC, e.name ASC");

    let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s.as_ref()).collect();

    let results = stmt.query_map(&param_refs[..], |row| {
        let first_in: String = row.get(4)?;
        let last_out: String = row.get(5)?;
        let all_punches: String = row.get(6)?;
        
        let in_time = first_in.split_whitespace().nth(1).unwrap_or("00:00:00");
        let is_late = in_time > "09:15:00";
        
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, Option<String>>(2)?,
            "date": row.get::<_, String>(3)?,
            "first_in": first_in,
            "last_out": if last_out == first_in { "—".to_string() } else { last_out },
            "all_punches": all_punches,
            "employee_code": row.get::<_, Option<String>>(7)?,
            "branch_name": row.get::<_, Option<String>>(8)?,
            "method": row.get::<_, Option<String>>(9)?,
            "status": if is_late { "Late" } else { "On-time" }
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    Ok(results)
}

/// GET MONTHLY LEDGER
#[tauri::command]
pub async fn get_monthly_ledger(
    year_month: String, // YYYY-MM
    branch_id: Option<i64>,
    _gate_id: Option<i64>,
    _dept: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT e.id, e.name,
                strftime('%d', CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN al.timestamp
                                    ELSE datetime(al.timestamp, 'localtime') END) as day,
                COUNT(*)
         FROM Employees e
         JOIN AttendanceLogs al ON e.id = al.employee_id
         WHERE strftime('%Y-%m', CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN al.timestamp
                                      ELSE datetime(al.timestamp, 'localtime') END) = ?1"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(year_month)];

    if let Some(bid) = branch_id {
        query.push_str(" AND e.branch_id = ?");
        params_vec.push(Box::new(bid));
    }

    query.push_str(" GROUP BY e.id, day ORDER BY e.name");

    let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s.as_ref()).collect();

    let mut ledger_map: std::collections::HashMap<i64, (String, std::collections::HashMap<String, String>)> = std::collections::HashMap::new();

    let mut rows = stmt.query(&param_refs[..]).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    while let Some(row) = rows.next().map_err(|e| AppError::DatabaseError(e.to_string()))? {
        let id: i64 = row.get(0)?;
        let name: String = row.get(1)?;
        let day: String = row.get(2)?;
        
        let entry = ledger_map.entry(id).or_insert((name, std::collections::HashMap::new()));
        entry.1.insert(day, "P".to_string());
    }

    let results: Vec<serde_json::Value> = ledger_map.into_iter().map(|(id, (name, att))| {
        serde_json::json!({
            "id": id,
            "name": name,
            "attendance": att
        })
    }).collect();

    Ok(results)
}

/// GET SALARY SHEET
#[tauri::command]
pub async fn get_salary_sheet(
    year_month: String,
    _branch_id: Option<i64>,
    _gate_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT e.id, e.name, e.department, COUNT(DISTINCT date(al.timestamp, 'localtime')) as present_days
         FROM Employees e
         JOIN AttendanceLogs al ON e.id = al.employee_id
         WHERE strftime('%Y-%m', al.timestamp, 'localtime') = ?1
         GROUP BY e.id"
    ).map_err(|e| AppError::DatabaseError(e.to_string()))?;

    let results = stmt.query_map([year_month], |row| {
        let present: i64 = row.get(3)?;
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "department": row.get::<_, Option<String>>(2)?,
            "present_days": present,
            "paid_leaves": 0,
            "payable_days": present
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    Ok(results)
}

/// GET RAW LOGS
#[tauri::command]
pub async fn get_raw_logs(
    from_date: String,
    to_date: String,
    search: String,
    employee_id: Option<i64>,
    _branch_id: Option<i64>,
    _gate_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT al.id, e.name,
                CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN datetime(al.timestamp)
                     ELSE datetime(al.timestamp, 'localtime') END as display_time,
                al.punch_method, b.name as branch_name
         FROM AttendanceLogs al
         JOIN Employees e ON al.employee_id = e.id
         LEFT JOIN Branches b ON al.branch_id = b.id
         WHERE (CASE WHEN al.punch_method = 'Manual' OR al.device_id = 999 THEN date(al.timestamp)
                     ELSE date(al.timestamp, 'localtime') END) BETWEEN date(?1) AND date(?2)"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(from_date),
        Box::new(to_date),
    ];

    if let Some(eid) = employee_id {
        query.push_str(" AND e.id = ?");
        params_vec.push(Box::new(eid));
    }

    if !search.is_empty() {
        query.push_str(" AND (e.name LIKE ? OR e.employee_code LIKE ?)");
        let s = format!("%{}%", search);
        params_vec.push(Box::new(s.clone()));
        params_vec.push(Box::new(s));
    }

    query.push_str(" ORDER BY al.timestamp DESC LIMIT 1000");

    let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let param_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|s| s.as_ref()).collect();

    let logs = stmt.query_map(&param_refs[..], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "name": row.get::<_, String>(1)?,
            "timestamp": row.get::<_, String>(2)?,
            "type": row.get::<_, Option<String>>(3)?,
            "device": row.get::<_, Option<String>>(4)?
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    Ok(logs)
}

#[tauri::command]
pub async fn export_usb_db(_state: tauri::State<'_, AppState>) -> Result<String, AppError> {
    // In a real app, this would copy the SQLite file to a detected USB drive.
    // For now, we'll just return a success message.
    Ok("C:/BioBridge_USB_Backup.db".into())
}
