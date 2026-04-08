// ============================================================================
// BioBridge Pro ERP - Complete Backend CRUD Services
// ============================================================================
// This file contains all Create, Read, Update, Delete operations for every
// ERP module with proper validation, security, and audit logging.
// ============================================================================

use rusqlite::{Connection, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use crate::AppState;
use crate::errors::AppError;
use crate::security::{encrypt_data, decrypt_data, sanitize_input, validate_email, validate_date};

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Items SET is_active = 0 WHERE id = ?1",
        params![item_id],
    ).map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Items SET quantity = quantity + ?1, updated_at = datetime('now') WHERE id = ?2",
        params![adjustment, item_id],
    ).map_err(|e| AppError::DatabaseError(format!("Stock update failed: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let total_items: i64 = conn.query_row("SELECT COUNT(*) FROM Items WHERE is_active = 1", [], |r| r.get(0))?;
    let total_value: f64 = conn.query_row("SELECT COALESCE(SUM(quantity * unit_price), 0) FROM Items WHERE is_active = 1", [], |r| r.get(0))?;
    let low_stock: i64 = conn.query_row("SELECT COUNT(*) FROM Items WHERE quantity <= reorder_level AND quantity > 0 AND is_active = 1", [], |r| r.get(0))?;
    let out_of_stock: i64 = conn.query_row("SELECT COUNT(*) FROM Items WHERE quantity = 0 AND is_active = 1", [], |r| r.get(0))?;

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
    pub department_id: Option<String>,
    pub designation_id: Option<String>,
    pub branch_id: Option<String>,
    pub date_of_joining: Option<String>,
    pub employment_type: Option<String>,
    pub reporting_manager_id: Option<String>,
    pub bank_name: Option<String>,
    pub account_number: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateEmployeeRequest {
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub date_of_birth: Option<String>,
    pub gender: Option<String>,
    pub personal_email: Option<String>,
    pub personal_phone: Option<String>,
    pub current_address: Option<String>,
    pub department_id: Option<String>,
    pub designation_id: Option<String>,
    pub date_of_joining: Option<String>,
    pub employment_status: Option<String>,
}

/// CREATE: Add new employee
#[tauri::command]
pub async fn create_employee(
    request: CreateEmployeeRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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

    // Insert employee
    let employee_id = conn.execute(
        "INSERT INTO Employees (
            employee_code, first_name, middle_name, last_name,
            date_of_birth, gender, personal_email, personal_phone,
            current_address, permanent_address, department_id,
            designation_id, branch_id, date_of_joining,
            employment_type, reporting_manager_id, bank_name,
            account_number, status, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, 'active', datetime('now'), datetime('now'))",
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
            request.department_id,
            request.designation_id,
            request.branch_id,
            request.date_of_joining,
            request.employment_type.as_deref().unwrap_or("Full-time"),
            request.reporting_manager_id,
            request.bank_name,
            account_encrypted,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create employee: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT e.*, 
            d.name as department_name,
            des.name as designation_name,
            b.name as branch_name
        FROM Employees e
        LEFT JOIN Departments d ON e.department_id = d.id
        LEFT JOIN Designations des ON e.designation_id = des.id
        LEFT JOIN Branches b ON e.branch_id = b.id
        WHERE e.id = ?1 AND e.status != 'deleted'"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

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
        }))
    }).optional()
    .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;

    match employee {
        Some(emp) => {
            log_audit(conn, "Employees", Some(employee_id.to_string()), "VIEW", "Viewed employee")?;
            Ok(serde_json::json!({
                "success": true,
                "data": emp
            }))
        },
        None => Err(AppError::NotFound("Employee not found".into())),
    }
}

/// READ: Get all employees
#[tauri::command]
pub async fn list_employees(
    filters: Option<serde_json::Value>,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT e.id, e.employee_code, e.first_name, e.middle_name, e.last_name,
                e.gender, e.date_of_joining, e.employment_type, e.employment_status,
                d.name as department_name, des.name as designation_name,
                b.name as branch_name
        FROM Employees e
        LEFT JOIN Departments d ON e.department_id = d.id
        LEFT JOIN Designations des ON e.designation_id = des.id
        LEFT JOIN Branches b ON e.branch_id = b.id
        WHERE e.status != 'deleted'"
    );

    // Apply filters
    if let Some(f) = filters {
        if let Some(dept_id) = f.get("department_id").and_then(|v| v.as_i64()) {
            query.push_str(&format!(" AND e.department_id = {}", dept_id));
        }
        if let Some(branch_id) = f.get("branch_id").and_then(|v| v.as_i64()) {
            query.push_str(&format!(" AND e.branch_id = {}", branch_id));
        }
        if let Some(status) = f.get("employment_status").and_then(|v| v.as_str()) {
            query.push_str(&format!(" AND e.employment_status = '{}'", sanitize_input(status)));
        }
    }

    query.push_str(" ORDER BY e.first_name, e.last_name");

    let mut stmt = conn.prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let employees: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
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
                "gender": row.get::<_, Option<String>>(5)?,
                "date_of_joining": row.get::<_, Option<String>>(6)?,
                "employment_type": row.get::<_, String>(7)?,
                "employment_status": row.get::<_, String>(8)?,
                "department": row.get::<_, Option<String>>(9)?,
                "designation": row.get::<_, Option<String>>(10)?,
                "branch": row.get::<_, Option<String>>(11)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": employees,
        "count": employees.len()
    }))
}

/// UPDATE: Modify employee data
#[tauri::command]
pub async fn update_employee(
    employee_id: i64,
    request: UpdateEmployeeRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Fetch old values for audit
    let _old_values = get_employee_for_audit(conn, employee_id)?;

    let mut updates = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(first_name) = request.first_name {
        updates.push("first_name = ?");
        values.push(Box::new(sanitize_input(&first_name)));
    }
    if let Some(last_name) = request.last_name {
        updates.push("last_name = ?");
        values.push(Box::new(sanitize_input(&last_name)));
    }
    if let Some(email) = request.personal_email {
        updates.push("personal_email = ?");
        let encrypted = encrypt_data(&email).map_err(|e| AppError::EncryptionError(e))?;
        values.push(Box::new(encrypted));
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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "UPDATE Employees SET status = 'deleted', updated_at = datetime('now') WHERE id = ?1",
        params![employee_id],
    ).map_err(|e| AppError::DatabaseError(format!("Delete failed: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    // Validate dates
    if !validate_date(&request.start_date) || !validate_date(&request.end_date) {
        return Err(AppError::ValidationError("Invalid date format. Use YYYY-MM-DD".into()));
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
        &format!("Leave request submitted for employee #{}", request.employee_id),
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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT lr.id, lr.employee_id, e.first_name, e.last_name,
                lt.name as leave_type, lr.start_date, lr.end_date,
                lr.total_days, lr.reason, lr.status, lr.applied_at
        FROM LeaveRequests lr
        JOIN Employees e ON lr.employee_id = e.id
        LEFT JOIN LeaveTypes lt ON lr.leave_type_id = lt.id
        WHERE 1=1"
    );

    if let Some(eid) = employee_id {
        query.push_str(&format!(" AND lr.employee_id = {}", eid));
    }
    if let Some(st) = status {
        query.push_str(&format!(" AND lr.status = '{}'", sanitize_input(&st)));
    }

    query.push_str(" ORDER BY lr.applied_at DESC");

    let mut stmt = conn.prepare(&query)
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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    ).map_err(|e| AppError::DatabaseError(format!("Update failed: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT al.id, al.employee_id, e.first_name, e.last_name,
                al.timestamp, al.punch_type, al.punch_method, al.is_synced
        FROM AttendanceLogs al
        JOIN Employees e ON al.employee_id = e.id
        WHERE 1=1"
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

    let mut stmt = conn.prepare(&query)
        .map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let logs: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_id": row.get::<_, i64>(1)?,
                "employee_name": format!("{} {}", row.get::<_, String>(2)?, row.get::<_, String>(3)?),
                "timestamp": row.get::<_, String>(4)?,
                "punch_type": row.get::<_, Option<String>>(5)?,
                "punch_method": row.get::<_, Option<String>>(6)?,
                "is_synced": row.get::<_, bool>(7)?,
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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create salary structure: {}", e)))?;

    log_audit(
        conn,
        "SalaryStructures",
        None,
        "CREATE",
        &format!("Salary structure created for employee #{}", request.employee_id),
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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

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
    let invoice_id = conn.execute(
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
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create invoice: {}", e)))?;

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut query = String::from(
        "SELECT id, invoice_number, invoice_date, due_date, contact_name,
                invoice_type, status, subtotal, tax_amount, discount_amount,
                total_amount, paid_amount, balance_amount
        FROM Invoices WHERE 1=1"
    );

    if let Some(it) = invoice_type {
        query.push_str(&format!(" AND invoice_type = '{}'", sanitize_input(&it)));
    }
    if let Some(st) = status {
        query.push_str(&format!(" AND status = '{}'", sanitize_input(&st)));
    }

    query.push_str(" ORDER BY invoice_date DESC");

    let mut stmt = conn.prepare(&query)
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
// INVENTORY CRUD
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateItemRequest {
    pub item_code: String,
    pub item_name: String,
    pub description: Option<String>,
    pub item_type: String,
    pub unit_of_measure: Option<String>,
    pub purchase_price: Option<f64>,
    pub sale_price: Option<f64>,
    pub reorder_level: Option<f64>,
}

/// CREATE: Add new inventory item
#[tauri::command]
pub async fn create_item(
    request: CreateItemRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let item_id = conn.execute(
        "INSERT INTO Items 
         (item_code, item_name, description, item_type, unit_of_measure,
          purchase_price, sale_price, reorder_level, is_active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, datetime('now'))",
        params![
            sanitize_input(&request.item_code),
            sanitize_input(&request.item_name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            sanitize_input(&request.item_type),
            request.unit_of_measure.as_deref().unwrap_or("Pcs"),
            request.purchase_price.unwrap_or(0.0),
            request.sale_price.unwrap_or(0.0),
            request.reorder_level.unwrap_or(0.0),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create item: {}", e)))?;

    log_audit(
        conn,
        "Items",
        Some(item_id.to_string()),
        "CREATE",
        &format!("Item {} created", request.item_code),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Item created successfully",
        "item_id": item_id
    }))
}

/// READ: Get all items
#[tauri::command]
pub async fn list_items(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT i.id, i.item_code, i.item_name, i.item_type, i.unit_of_measure,
                i.purchase_price, i.sale_price, i.reorder_level, i.is_active,
                COALESCE(SUM(s.quantity), 0) as total_stock
        FROM Items i
        LEFT JOIN Stock s ON i.id = s.item_id
        WHERE i.is_active = 1
        GROUP BY i.id
        ORDER BY i.item_name"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let items: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "item_code": row.get::<_, String>(1)?,
                "item_name": row.get::<_, String>(2)?,
                "item_type": row.get::<_, String>(3)?,
                "unit_of_measure": row.get::<_, String>(4)?,
                "purchase_price": row.get::<_, f64>(5)?,
                "sale_price": row.get::<_, f64>(6)?,
                "reorder_level": row.get::<_, f64>(7)?,
                "is_active": row.get::<_, bool>(8)?,
                "total_stock": row.get::<_, f64>(9)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": items,
        "count": items.len()
    }))
}

/// UPDATE: Update stock quantity
#[tauri::command]
pub async fn update_stock(
    item_id: i64,
    warehouse_id: i64,
    quantity_change: f64,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    conn.execute(
        "INSERT INTO Stock (item_id, warehouse_id, quantity)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(item_id, warehouse_id)
         DO UPDATE SET quantity = quantity + ?4, last_updated = datetime('now')",
        params![item_id, warehouse_id, quantity_change, quantity_change],
    ).map_err(|e| AppError::DatabaseError(format!("Stock update failed: {}", e)))?;

    log_audit(
        conn,
        "Stock",
        None,
        "UPDATE",
        &format!("Stock updated for item #{}", item_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Stock updated successfully"
    }))
}

// ============================================================================
// PROJECTS & TASKS CRUD
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateProjectRequest {
    pub project_code: String,
    pub project_name: String,
    pub description: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub budget: Option<f64>,
    pub client_name: Option<String>,
}

/// CREATE: Add new project
#[tauri::command]
pub async fn create_project(
    request: CreateProjectRequest,
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let project_id = conn.execute(
        "INSERT INTO Projects 
         (project_code, project_name, description, status, priority,
          start_date, end_date, budget, client_name, created_at)
         VALUES (?1, ?2, ?3, 'Planning', 'Medium', ?4, ?5, ?6, ?7, datetime('now'))",
        params![
            sanitize_input(&request.project_code),
            sanitize_input(&request.project_name),
            request.description.as_ref().map(|s| sanitize_input(s)),
            request.start_date,
            request.end_date,
            request.budget,
            request.client_name.as_ref().map(|s| sanitize_input(s)),
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create project: {}", e)))?;

    log_audit(
        conn,
        "Projects",
        Some(project_id.to_string()),
        "CREATE",
        &format!("Project {} created", request.project_code),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Project created successfully",
        "project_id": project_id
    }))
}

/// READ: Get all projects
#[tauri::command]
pub async fn list_projects(
    state: tauri::State<'_, AppState>,
) -> Result<serde_json::Value, AppError> {
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let mut stmt = conn.prepare(
        "SELECT p.id, p.project_code, p.project_name, p.status, p.priority,
                p.start_date, p.end_date, p.budget, p.client_name,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'Completed' THEN 1 END) as completed_tasks
        FROM Projects p
        LEFT JOIN Tasks t ON p.id = t.project_id
        WHERE p.status != 'deleted'
        GROUP BY p.id
        ORDER BY p.created_at DESC"
    ).map_err(|e| AppError::DatabaseError(format!("Prepare failed: {}", e)))?;

    let projects: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "project_code": row.get::<_, String>(1)?,
                "project_name": row.get::<_, String>(2)?,
                "status": row.get::<_, String>(3)?,
                "priority": row.get::<_, String>(4)?,
                "start_date": row.get::<_, Option<String>>(5)?,
                "end_date": row.get::<_, Option<String>>(6)?,
                "budget": row.get::<_, Option<f64>>(7)?,
                "client_name": row.get::<_, Option<String>>(8)?,
                "total_tasks": row.get::<_, i64>(9)?,
                "completed_tasks": row.get::<_, i64>(10)?,
            }))
        })
        .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(serde_json::json!({
        "success": true,
        "data": projects,
        "count": projects.len()
    }))
}

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
    let db_guard = state.db.lock().map_err(|_| AppError::Unknown("Lock error".into()))?;
    let conn = db_guard.as_ref().ok_or_else(|| AppError::DatabaseError("DB not initialized".into()))?;

    let task_id = conn.execute(
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
    ).map_err(|e| AppError::DatabaseError(format!("Failed to create task: {}", e)))?;

    log_audit(
        conn,
        "Tasks",
        Some(task_id.to_string()),
        "CREATE",
        &format!("Task created in project #{}", request.project_id),
    )?;

    Ok(serde_json::json!({
        "success": true,
        "message": "Task created successfully",
        "task_id": task_id
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
        params![
            table_name,
            record_id,
            action,
            description,
        ],
    ).map_err(|e| AppError::DatabaseError(format!("Audit log failed: {}", e)))?;
    
    Ok(())
}

fn get_employee_for_audit(
    conn: &Connection,
    employee_id: i64,
) -> Result<Option<serde_json::Value>, AppError> {
    let employee = conn.query_row(
        "SELECT * FROM Employees WHERE id = ?1",
        params![employee_id],
        |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "employee_code": row.get::<_, String>(1)?,
                "first_name": row.get::<_, String>(2)?,
                "last_name": row.get::<_, String>(4)?,
            }))
        },
    ).optional()
    .map_err(|e| AppError::DatabaseError(format!("Query failed: {}", e)))?;
    
    Ok(employee)
}
