use rusqlite::{Connection, Result};
use std::fs;
use std::path::Path;

pub fn init_db(app_dir: &Path) -> Result<Connection> {
    if !app_dir.exists() {
        fs::create_dir_all(app_dir).expect("Failed to create app data directory");
    }

    let db_path = app_dir.join("biobridge.db");
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            address TEXT,
            contact_info TEXT,
            auth_key TEXT UNIQUE,
            license_expiry TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            location TEXT,
            FOREIGN KEY(org_id) REFERENCES Organizations(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            rfid TEXT,
            pin TEXT,
            department TEXT,
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            ip_address TEXT NOT NULL,
            port INTEGER DEFAULT 4370,
            status TEXT DEFAULT 'offline',
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS AttendanceLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            branch_id INTEGER NOT NULL,
            device_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            log_type TEXT,
            is_synced INTEGER DEFAULT 0,
            FOREIGN KEY(employee_id) REFERENCES Employees(id),
            FOREIGN KEY(branch_id) REFERENCES Branches(id),
            FOREIGN KEY(device_id) REFERENCES Devices(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            description TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS LeaveRequests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS CloudConfig (
            id INTEGER PRIMARY KEY,
            client_email TEXT NOT NULL,
            private_key TEXT NOT NULL,
            project_id TEXT NOT NULL,
            root_folder_id TEXT
        )",
        [],
    )?;

    Ok(conn)
}
