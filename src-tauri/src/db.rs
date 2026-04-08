use rusqlite::{Connection, Result};
use std::fs;
use std::path::Path;

pub fn init_db(app_dir: &Path) -> Result<Connection> {
    if !app_dir.exists() {
        fs::create_dir_all(app_dir).expect("Failed to create app data directory");
    }

    // Create subfolders as requested
    let dirs = vec!["Databases", "Attendance_Reports", "Employee_Photos", "OT_Reports", "Employee_Documents"];
    for d in dirs {
        let dir_path = app_dir.join(d);
        if !dir_path.exists() {
            fs::create_dir_all(dir_path).expect("Failed to create subdirectory");
        }
    }

    let db_path = app_dir.join("Databases").join("biobridge_pro.db");
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
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            port INTEGER NOT NULL,
            comm_key INTEGER DEFAULT 0,
            machine_number INTEGER DEFAULT 1,
            is_default INTEGER DEFAULT 0,
            branch_id INTEGER REFERENCES Branches(id),
            gate_id INTEGER REFERENCES Gates(id),
            subnet_mask TEXT,
            gateway TEXT,
            dns TEXT,
            dhcp INTEGER DEFAULT 0,
            server_mode TEXT,
            server_address TEXT,
            https_enabled INTEGER DEFAULT 0
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
            punch_method TEXT,
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
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_email TEXT,
            private_key TEXT,
            project_id TEXT,
            root_folder_id TEXT
        )",
        [],
    )?;

    // ── COMPLETE HR SOLUTION MODULES ──────────────────────────────────
    conn.execute(
        "CREATE TABLE IF NOT EXISTS SalaryStructures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER UNIQUE,
            basic_salary REAL DEFAULT 0,
            allowances REAL DEFAULT 0,
            deductions REAL DEFAULT 0,
            overtime_rate REAL DEFAULT 0,
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS PayrollRecords (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            year_month TEXT, -- YYYY-MM
            basic_paid REAL,
            allowances_paid REAL,
            deductions_paid REAL,
            ot_paid REAL,
            net_pay REAL,
            days_present INTEGER,
            generated_at TEXT,
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS LeaveManagement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            leave_type TEXT, -- Sick, Casual, Paid
            start_date TEXT,
            end_date TEXT,
            status TEXT DEFAULT 'Approved',
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS OvertimeTracker (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            date TEXT,
            shift_end TEXT,
            actual_out TEXT,
            ot_hours REAL,
            is_processed INTEGER DEFAULT 0,
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    )?;

    // Migration for existing tables (ensure columns exist)
    let _ = conn.execute("ALTER TABLE Devices ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE Devices ADD COLUMN comm_key INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE Devices ADD COLUMN is_default INTEGER DEFAULT 0", []);
    let columns = vec![
        ("subnet_mask", "TEXT"), ("gateway", "TEXT"), ("dns", "TEXT"), 
        ("dhcp", "INTEGER DEFAULT 0"), ("server_mode", "TEXT"), 
        ("server_address", "TEXT"), ("https_enabled", "INTEGER DEFAULT 0")
    ];
    for (col, col_type) in columns {
        let _ = conn.execute(&format!("ALTER TABLE Devices ADD COLUMN {} {}", col, col_type), []);
    }
    let _ = conn.execute("ALTER TABLE AttendanceLogs ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1", []);
    let _ = conn.execute("ALTER TABLE AttendanceLogs ADD COLUMN punch_method TEXT", []);
    let _ = conn.execute("ALTER TABLE Users ADD COLUMN must_change_password INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE Employees ADD COLUMN status TEXT DEFAULT 'active'", []);

    // Migration for LeaveRequests table
    let _ = conn.execute("ALTER TABLE LeaveRequests ADD COLUMN leave_type TEXT DEFAULT 'Casual Leave'", []);
    let _ = conn.execute("ALTER TABLE LeaveRequests ADD COLUMN reason TEXT", []);
    let _ = conn.execute("ALTER TABLE LeaveRequests ADD COLUMN approved_by TEXT", []);

    // Migration for EmployeeDocuments table (ensure it exists)
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS EmployeeDocuments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            doc_type TEXT,
            doc_name TEXT,
            cloud_file_id TEXT,
            upload_date TEXT,
            FOREIGN KEY(employee_id) REFERENCES Employees(id)
        )",
        [],
    );

    // Multi-branch access table: allows ADMIN users to access multiple branches
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS UserBranchAccess (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            branch_id INTEGER NOT NULL,
            FOREIGN KEY(user_id) REFERENCES Users(id),
            FOREIGN KEY(branch_id) REFERENCES Branches(id),
            UNIQUE(user_id, branch_id)
        )",
        [],
    );

    // Notification System table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS Notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            sender_name TEXT,
            receiver_id INTEGER,
            receiver_type TEXT DEFAULT 'USER', -- USER, BRANCH, ALL
            branch_id INTEGER,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            notification_type TEXT DEFAULT 'GENERAL', -- GENERAL, URGENT, ANNOUNCEMENT, REMINDER
            is_read INTEGER DEFAULT 0,
            read_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            expires_at TEXT,
            FOREIGN KEY(sender_id) REFERENCES Users(id),
            FOREIGN KEY(receiver_id) REFERENCES Users(id),
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
        )",
        [],
    );

    // Ensure uniqueness constraint for offline-first permanent sync
    let _ = conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_attendancelogs_emp_time ON AttendanceLogs (employee_id, timestamp)", []);

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
