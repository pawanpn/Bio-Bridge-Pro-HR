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
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateEmployeeRequest {
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

    // Validate inputs
    let employee_code = sanitize_input(&request.employee_code);
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

    // Insert employee with all fields
    let _id = conn.execute(
        "INSERT INTO Employees (
            employee_code, first_name, middle_name, last_name,
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
            status, created_at, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
            ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30,
            ?31, ?32, ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44,
            ?45, ?46, ?47, ?48, ?49, ?50, ?51, ?52, ?53,
            'active', datetime('now'), datetime('now')
        )",
        params![
            employee_code,
            first_name,
            request.middle_name.as_ref().map(|s| sanitize_input(s)),
            last_name,
            request.date_of_birth,
            request.gender,
            email_encrypted,
            phone_encrypted,
            address_encrypted,
            request.permanent_address.as_ref().map(|s| encrypt_data(&sanitize_input(s))).transpose().map_err(|e| AppError::EncryptionError(e))?,
            request.citizenship_number.as_ref().map(|s| sanitize_input(s)),
            request.pan_number.as_ref().map(|s| sanitize_input(s)),
            request.department_id,
            request.designation_id,
            request.branch_id,
            request.date_of_joining,
            request.employment_type.as_deref().unwrap_or("Full-time"),
            request.employment_status.as_deref().unwrap_or("Active"),
            request.reporting_manager_id,
            request.bank_name,
            account_encrypted,
            request.area_id,
            request.location_id,
            request.photo,
            request.enable_self_service.unwrap_or(false) as i32,
            request.enable_mobile_access.unwrap_or(false) as i32,
            request.local_name,
            request.national_id,
            request.contact_tel,
            request.office_tel,
            request.motorcycle_license,
            request.automobile_license,
            request.religion,
            request.city,
            request.postcode,
            request.passport_no,
            request.nationality,
            request.verification_mode,
            request.device_privilege,
            request.device_password,
            request.card_no,
            request.bio_photo,
            request.enable_attendance.unwrap_or(true) as i32,
            request.enable_holiday.unwrap_or(true) as i32,
            request.outdoor_management.unwrap_or(false) as i32,
            request.workflow_role,
            request.mobile_punch.unwrap_or(false) as i32,
            request.app_role,
            request.whatsapp_alert.unwrap_or(false) as i32,
            request.whatsapp_exception.unwrap_or(false) as i32,
            request.whatsapp_punch.unwrap_or(false) as i32,
            request.supervisor_mobile,
            request.biometric_id,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create employee: {}", e)))?;

    // Get the actual row ID if we can and push to sync queue
    let employee_id = conn.last_insert_rowid();

    // Prepare sync payload with ALL fields
    let sync_payload = serde_json::json!({
        "id": employee_id,
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
        "status": "active"
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
            "SELECT e.*, 
            d.name as department_name,
            des.name as designation_name,
            b.name as branch_name
        FROM Employees e
        LEFT JOIN Departments d ON e.department_id = d.id
        LEFT JOIN Designations des ON e.designation_id = des.id
        LEFT JOIN Branches b ON e.branch_id = b.id
        WHERE e.id = ?1 AND e.status != 'deleted'",
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
    filters: Option<serde_json::Value>,
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
        "SELECT id, employee_code, first_name, middle_name, last_name,
                gender, date_of_joining, employment_type, employment_status,
                department_id as department_name, designation_id as designation_name,
                status as branch_name
        FROM Employees
        WHERE (status IS NULL OR status != 'deleted')",
    );

    let mut param_index = 1;
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref bid) = branch_id {
        if !bid.is_empty() && bid != "all" {
            query.push_str(&format!(" AND (branch_id = ?{} OR CAST(branch_id AS TEXT) = ?{})", param_index, param_index));
            params.push(Box::new(bid.clone()));
            param_index += 1;
        }
    }

    query.push_str(" ORDER BY id DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref()).collect();

    let employees: Vec<serde_json::Value> = stmt
        .query_map(&param_refs[..], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_code": row.get::<_, Option<String>>(1)?.unwrap_or_else(|| format!("EMP-{:04}", row.get::<_, i64>(0).unwrap_or(0))),
                "first_name": row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                "middle_name": row.get::<_, Option<String>>(3)?,
                "last_name": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                "full_name": format!(
                    "{} {} {}",
                    row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    row.get::<_, Option<String>>(4)?.unwrap_or_default()
                ).trim().replace("  ", " ").to_string(),
                "gender": row.get::<_, Option<String>>(5)?,
                "date_of_joining": row.get::<_, Option<String>>(6)?,
                "employment_type": row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "Full-time".to_string()),
                "employment_status": row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "Active".to_string()),
                "status": row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "Active".to_string()),
                "department": row.get::<_, Option<String>>(9)?,
                "designation": row.get::<_, Option<String>>(10)?,
                "branch": row.get::<_, Option<String>>(11)?,
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

    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref first_name) = request.first_name {
        updates.push("first_name = ?");
        values.push(Box::new(sanitize_input(&first_name)));
    }
    if let Some(middle_name) = request.middle_name {
        updates.push("middle_name = ?");
        values.push(Box::new(sanitize_input(&middle_name)));
    }
    if let Some(ref last_name) = request.last_name {
        updates.push("last_name = ?");
        values.push(Box::new(sanitize_input(&last_name)));
    }
    if let Some(email) = request.personal_email {
        updates.push("personal_email = ?");
        let encrypted = encrypt_data(&email).map_err(|e| AppError::EncryptionError(e))?;
        values.push(Box::new(encrypted));
    }
    if let Some(phone) = request.personal_phone {
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
    if let Some(emp_type) = request.employment_type {
        updates.push("employment_type = ?");
        values.push(Box::new(emp_type));
    }
    if let Some(citizenship) = request.citizenship_number {
        updates.push("citizenship_number = ?");
        values.push(Box::new(sanitize_input(&citizenship)));
    }
    if let Some(pan) = request.pan_number {
        updates.push("pan_number = ?");
        values.push(Box::new(sanitize_input(&pan)));
    }
    if let Some(ref dept_id) = request.department_id {
        updates.push("department_id = ?");
        values.push(Box::new(dept_id));
    }
    if let Some(desig_id) = request.designation_id {
        updates.push("designation_id = ?");
        values.push(Box::new(desig_id));
    }
    if let Some(dob) = request.date_of_birth {
        updates.push("date_of_birth = ?");
        values.push(Box::new(dob));
    }
    if let Some(gender) = request.gender {
        updates.push("gender = ?");
        values.push(Box::new(gender));
    }
    if let Some(addr) = request.current_address {
        updates.push("current_address = ?");
        values.push(Box::new(sanitize_input(&addr)));
    }
    if let Some(permanent_addr) = request.permanent_address {
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
    if let Some(doj) = request.date_of_joining {
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
    if let Some(area_id) = request.area_id {
        updates.push("area_id = ?");
        values.push(Box::new(area_id));
    }
    if let Some(location_id) = request.location_id {
        updates.push("location_id = ?");
        values.push(Box::new(location_id));
    }
    if let Some(photo) = request.photo {
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
    if let Some(verification_mode) = request.verification_mode {
        updates.push("verification_mode = ?");
        values.push(Box::new(verification_mode));
    }
    if let Some(device_privilege) = request.device_privilege {
        updates.push("device_privilege = ?");
        values.push(Box::new(device_privilege));
    }
    if let Some(device_password) = request.device_password {
        updates.push("device_password = ?");
        values.push(Box::new(device_password));
    }
    if let Some(card_no) = request.card_no {
        updates.push("card_no = ?");
        values.push(Box::new(card_no));
    }
    if let Some(bio_photo) = request.bio_photo {
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
    if let Some(workflow_role) = request.workflow_role {
        updates.push("workflow_role = ?");
        values.push(Box::new(workflow_role));
    }
    if let Some(mobile_punch) = request.mobile_punch {
        updates.push("mobile_punch = ?");
        values.push(Box::new(mobile_punch as i32));
    }
    if let Some(app_role) = request.app_role {
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
    if let Some(supervisor_mobile) = request.supervisor_mobile {
        updates.push("supervisor_mobile = ?");
        values.push(Box::new(sanitize_input(&supervisor_mobile)));
    }
    if let Some(biometric_id) = request.biometric_id {
        updates.push("biometric_id = ?");
        values.push(Box::new(biometric_id));
    }

    if updates.is_empty() {
        return Err(AppError::ValidationError("No fields to update".into()));
    }

    updates.push("updated_at = datetime('now')");
    values.push(Box::new(employee_id));

    let set_clause = updates.join(", ");
    let query = format!("UPDATE Employees SET {} WHERE id = ?", set_clause);

    let params_vec: Vec<&dyn rusqlite::ToSql> = values.iter().map(|v| v.as_ref()).collect();

    conn.execute(&query, &params_vec[..])
        .map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

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
        "first_name": request.first_name,
        "last_name": request.last_name,
        "department_id": request.department_id,
        "branch_id": request.branch_id,
        "employment_status": request.employment_status,
        "biometric_id": request.biometric_id,
        "mobile_punch": request.mobile_punch,
        "updated_at": chrono::Utc::now().to_rfc3339()
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
        "UPDATE Employees SET status = 'deleted', updated_at = datetime('now') WHERE id = ?1",
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

// ============================================================================
// LEAVE MANAGEMENT CRUD
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateLeaveRequest {
    pub employee_id: i64,
    pub leave_type_id: i64,
    pub start_date: String,
    pub end_date: String,
    pub reason: Option<String>,
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

    conn.execute(
        "INSERT INTO LeaveRequests (employee_id, leave_type_id, start_date, end_date, reason, status, applied_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'Pending', datetime('now'))",
        params![
            request.employee_id,
            request.leave_type_id,
            request.start_date,
            request.end_date,
            request.reason.as_ref().map(|s| sanitize_input(s))
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

/// READ: Get leave requests
#[tauri::command]
pub async fn list_leave_requests(
    employee_id: Option<i64>,
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
        "SELECT lr.id, lr.employee_id, e.first_name, e.last_name,
                lt.name as leave_type, lr.start_date, lr.end_date,
                lr.total_days, lr.reason, lr.status, lr.applied_at
        FROM LeaveRequests lr
        JOIN Employees e ON lr.employee_id = e.id
        LEFT JOIN LeaveTypes lt ON lr.leave_type_id = lt.id
        WHERE 1=1",
    );

    if let Some(eid) = employee_id {
        query.push_str(&format!(" AND lr.employee_id = {}", eid));
    }
    if let Some(st) = status {
        query.push_str(&format!(" AND lr.status = '{}'", sanitize_input(&st)));
    }

    query.push_str(" ORDER BY lr.applied_at DESC");

    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let requests: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_id": row.get::<_, i64>(1)?,
                "employee_name": format!("{} {}", row.get::<_, String>(2)?, row.get::<_, String>(3)?),
                "leave_type": row.get::<_, Option<String>>(4)?,
                "start_date": row.get::<_, String>(5)?,
                "end_date": row.get::<_, String>(6)?,
                "total_days": row.get::<_, f64>(7)?,
                "reason": row.get::<_, Option<String>>(8)?,
                "status": row.get::<_, String>(9)?,
                "applied_at": row.get::<_, String>(10)?,
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
    leave_request_id: i64,
    status: String,
    approved_by: Option<String>,
    rejection_reason: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state
        .db
        .lock()
        .map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard
        .as_ref()
        .ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let status_sanitized = sanitize_input(&status);

    conn.execute(
        "UPDATE LeaveRequests 
         SET status = ?1, approved_by = ?2, approved_at = datetime('now'), rejection_reason = ?3
         WHERE id = ?4",
        params![
            status_sanitized,
            approved_by,
            rejection_reason,
            leave_request_id
        ],
    )
    .map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

    log_audit(
        conn,
        "LeaveRequests",
        Some(leave_request_id.to_string()),
        "UPDATE",
        &format!("Leave request #{} {}", leave_request_id, status_sanitized),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": format!("Leave request {}", status_sanitized)
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

    conn.execute(
        "INSERT INTO AttendanceLogs (employee_id, timestamp, punch_type, punch_method, branch_id, gate_id, device_id, is_synced)
         VALUES (?1, ?2, ?3, ?4, 1, 1, NULL, 0)",
        params![
            employee_id,
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
                al.timestamp, al.punch_type, al.punch_method, al.is_synced
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
                "punch_type": row.get::<_, Option<String>>(4)?,
                "punch_method": row.get::<_, Option<String>>(5)?,
                "is_synced": row.get::<_, bool>(6).unwrap_or(false),
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
        "INSERT INTO AuditLogs (table_name, record_id, action, description, created_at)
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
            "SELECT id, employee_code, first_name, last_name FROM Employees WHERE id = ?1",
            params![employee_id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "employee_code": row.get::<_, Option<String>>(1)?,
                    "first_name": row.get::<_, Option<String>>(2)?,
                    "last_name": row.get::<_, Option<String>>(3)?,
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

    // Count distinct employees who have logged today
    let present_today: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT employee_id) FROM AttendanceLogs WHERE date(timestamp) = date('now')",
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
        "SELECT DISTINCT e.id, e.first_name || ' ' || e.last_name, strftime('%H:%M', al.timestamp)
         FROM AttendanceLogs al
         JOIN Employees e ON al.employee_id = e.id
         WHERE date(al.timestamp) = date('now')
         ORDER BY al.timestamp DESC"
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
         AND id NOT IN (SELECT DISTINCT employee_id FROM AttendanceLogs WHERE date(timestamp) = date('now'))"
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
pub async fn list_branches(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, location FROM Branches ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let branches = stmt.query_map([], |row| {
        Ok(serde_json::json!({ "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "location": row.get::<_, Option<String>>(2)? }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(branches)
}

#[tauri::command]
pub async fn list_departments(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, description FROM Departments ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let results = stmt.query_map([], |row| {
        Ok(serde_json::json!({ "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "description": row.get::<_, Option<String>>(2)? }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(results)
}

#[tauri::command]
pub async fn list_designations(state: tauri::State<'_, AppState>) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    let mut stmt = conn.prepare("SELECT id, name, description FROM Designations ORDER BY name")
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    let results = stmt.query_map([], |row| {
        Ok(serde_json::json!({ "id": row.get::<_, i64>(0)?, "name": row.get::<_, String>(1)?, "description": row.get::<_, Option<String>>(2)? }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();
    Ok(results)
}

#[tauri::command]
pub async fn create_department(name: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Departments (name) VALUES (?)", [name])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn create_designation(name: String, state: tauri::State<'_, AppState>) -> Result<(), AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;
    conn.execute("INSERT INTO Designations (name) VALUES (?)", [name])
        .map_err(|e| AppError::DatabaseError(e.to_string()))?;
    Ok(())
}
/// GET DAILY ATTENDANCE REPORTS
#[tauri::command]
pub async fn get_daily_reports(
    branch_id: Option<i64>,
    date: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT al.id, al.employee_id, e.name as employee_name,
                b.id as branch_id, b.name as branch_name, g.id as gate_id, g.name as gate_name,
                al.device_id, al.timestamp, al.punch_method, al.sync_status
         FROM AttendanceLogs al
         LEFT JOIN Employees e ON al.employee_id = e.id
         LEFT JOIN Branches b ON al.branch_id = b.id
         LEFT JOIN Gates g ON al.gate_id = g.id
         WHERE date(al.timestamp) = date(?1)"
    );

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(date)];

    if let Some(bid) = branch_id {
        query.push_str(" AND al.branch_id = ?2");
        params.push(Box::new(bid));
    }

    query.push_str(" ORDER BY al.timestamp DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| AppError::DatabaseError(e.to_string()))?;
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|s| s.as_ref()).collect();

    let logs = stmt.query_map(&param_refs[..], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, i64>(0)?,
            "employee_id": row.get::<_, i64>(1)?,
            "employee_name": row.get::<_, Option<String>>(2)?,
            "branch_id": row.get::<_, Option<i64>>(3)?,
            "branch_name": row.get::<_, Option<String>>(4)?,
            "gate_id": row.get::<_, Option<i64>>(5)?,
            "gate_name": row.get::<_, Option<String>>(6)?,
            "device_id": row.get::<_, Option<i64>>(7)?,
            "timestamp": row.get::<_, String>(8)?,
            "punch_method": row.get::<_, Option<String>>(9)?,
            "is_synced": row.get::<_, Option<String>>(10)? == Some("SYNCED".to_string())
        }))
    }).map_err(|e| AppError::DatabaseError(e.to_string()))?.filter_map(|r| r.ok()).collect();

    Ok(logs)
}
