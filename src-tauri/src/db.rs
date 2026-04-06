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

    // LVL 3: Gates/Locations within a branch
    conn.execute(
        "CREATE TABLE IF NOT EXISTS Gates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
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
            status TEXT DEFAULT 'active',
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Devices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER NOT NULL,
            gate_id INTEGER NOT NULL DEFAULT 1,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            port INTEGER DEFAULT 4370,
            status TEXT DEFAULT 'offline',
            FOREIGN KEY(branch_id) REFERENCES Branches(id),
            FOREIGN KEY(gate_id) REFERENCES Gates(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS AttendanceLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            branch_id INTEGER NOT NULL,
            gate_id INTEGER NOT NULL DEFAULT 1,
            device_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            log_type TEXT,
            is_synced INTEGER DEFAULT 0,
            FOREIGN KEY(employee_id) REFERENCES Employees(id),
            FOREIGN KEY(branch_id) REFERENCES Branches(id),
            FOREIGN KEY(gate_id) REFERENCES Gates(id),
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
        "CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('SUPER_ADMIN', 'ADMIN', 'OPERATOR')),
            branch_id INTEGER,
            is_active INTEGER DEFAULT 1,
            must_change_password INTEGER DEFAULT 0,
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
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

    // Migration for existing tables (ensure columns exist)
    let _ = conn.execute("ALTER TABLE Devices ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE AttendanceLogs ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE Users ADD COLUMN must_change_password INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE Employees ADD COLUMN status TEXT DEFAULT 'active'", []);

    // Seed default data
    conn.execute("INSERT OR IGNORE INTO Organizations (id, name) VALUES (1, 'Default Organization')", [])?;
    conn.execute("INSERT OR IGNORE INTO Branches (id, org_id, name) VALUES (1, 1, 'Head Office')", [])?;
    conn.execute("INSERT OR IGNORE INTO Gates (id, branch_id, name) VALUES (1, 1, 'Main Gate')", [])?;
    
    // Seed test employee for hardware bio-id 1
    conn.execute(
        "INSERT OR IGNORE INTO Employees (id, name, department, branch_id, status) VALUES (1, 'Admin Staff', 'Operations', 1, 'active')",
        []
    )?;
    
    // Seed default Super Admin (admin / admin123)
    // bcrypt hash for 'admin123'
    let admin_pass_hash = "$2b$10$hmwXr.AU9waNfqdDwBPMwurCdtk5VT2mKSN4eqach.HlnACpNxv0y";
    let _ = conn.execute(
        "INSERT OR IGNORE INTO Users (username, password_hash, role, must_change_password) VALUES ('admin', ?1, 'SUPER_ADMIN', 1)",
        [admin_pass_hash]
    );
    
    // Fix existing database that might have the old master PIN hash instead of the user hash
    let _ = conn.execute(
        "UPDATE Users SET password_hash = ?1, must_change_password = 1 WHERE username = 'admin' AND (password_hash = '10d196f790ed847684074fcc319a3b6a964be7cd7b4618e7d23d8c4749f7ba34' OR password_hash = 'ec625a85dfd20986840d198b6097caf0da50e6cb2040bfb22b51cfdd5c6bb5a4')",
        [admin_pass_hash]
    );

    Ok(conn)
}
