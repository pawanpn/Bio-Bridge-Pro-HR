use rusqlite::{Connection, Result};
use std::fs;
use std::path::Path;

pub fn init_db(app_dir: &Path) -> Result<Connection> {
    if !app_dir.exists() {
        fs::create_dir_all(app_dir).expect("Failed to create app data directory");
    }

    // Create subfolders as requested
    let dirs = vec![
        "Databases",
        "Attendance_Reports",
        "Employee_Photos",
        "OT_Reports",
        "Employee_Documents",
    ];
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Departments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS Designations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT
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
            name TEXT NOT NULL,
            first_name TEXT,
            middle_name TEXT,
            last_name TEXT,
            employee_code TEXT UNIQUE,
            personal_email TEXT,
            personal_phone TEXT,
            work_email TEXT,
            work_phone TEXT,
            date_of_birth TEXT,
            gender TEXT,
            current_address TEXT,
            permanent_address TEXT,
            citizenship_number TEXT,
            pan_number TEXT,
            marital_status TEXT,
            date_of_joining TEXT,
            department_id INTEGER,
            designation_id INTEGER,
            branch_id INTEGER,
            reporting_manager_id INTEGER,
            bank_name TEXT,
            account_number TEXT,
            area_id INTEGER,
            location_id INTEGER,
            photo TEXT,
            enable_self_service INTEGER DEFAULT 1,
            enable_mobile_access INTEGER DEFAULT 1,
            local_name TEXT,
            national_id TEXT,
            contact_tel TEXT,
            office_tel TEXT,
            motorcycle_license TEXT,
            automobile_license TEXT,
            religion TEXT,
            city TEXT,
            postcode TEXT,
            passport_no TEXT,
            nationality TEXT,
            verification_mode INTEGER,
            device_privilege INTEGER,
            device_password TEXT,
            card_no TEXT,
            bio_photo TEXT,
            enable_attendance INTEGER DEFAULT 1,
            enable_holiday INTEGER DEFAULT 1,
            outdoor_management INTEGER DEFAULT 0,
            workflow_role TEXT,
            mobile_punch INTEGER DEFAULT 1,
            app_role TEXT,
            whatsapp_alert INTEGER DEFAULT 0,
            whatsapp_exception INTEGER DEFAULT 0,
            whatsapp_punch INTEGER DEFAULT 0,
            supervisor_mobile TEXT,
            biometric_id INTEGER,
            employment_status TEXT DEFAULT 'Active',
            employment_type TEXT DEFAULT 'Full-time',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(branch_id) REFERENCES Branches(id)
        )",
        [],
    )?;

    // Safe Migration Logic: Add columns one by one if they don't exist
    let migrations = vec![
        ("first_name", "TEXT"), ("middle_name", "TEXT"), ("last_name", "TEXT"), 
        ("employee_code", "TEXT"), ("department_id", "INTEGER"), ("designation_id", "INTEGER"), 
        ("biometric_id", "INTEGER"), ("pan_number", "TEXT"), ("citizenship_number", "TEXT"), 
        ("date_of_joining", "TEXT"), ("date_of_birth", "TEXT"), ("gender", "TEXT"), 
        ("marital_status", "TEXT"), ("personal_email", "TEXT"), ("personal_phone", "TEXT"),
        ("current_address", "TEXT"), ("permanent_address", "TEXT"),
        ("employment_status", "TEXT DEFAULT 'Active'"), ("employment_type", "TEXT"),
        ("whatsapp_alert", "INTEGER DEFAULT 0"), ("whatsapp_exception", "INTEGER DEFAULT 0"), 
        ("whatsapp_punch", "INTEGER DEFAULT 0"), ("supervisor_mobile", "TEXT"),
        ("mobile_punch", "INTEGER DEFAULT 1"), ("full_name", "TEXT"), ("department", "TEXT"),
        ("reporting_manager_id", "INTEGER"), ("bank_name", "TEXT"), ("account_number", "TEXT"),
        ("emergency_contact_name", "TEXT"), ("emergency_contact_phone", "TEXT"), ("emergency_contact_relation", "TEXT"),
        ("area_id", "TEXT"), ("location_id", "TEXT"), ("photo", "TEXT"),
        ("enable_self_service", "INTEGER DEFAULT 1"), ("enable_mobile_access", "INTEGER DEFAULT 1"),
        ("local_name", "TEXT"), ("national_id", "TEXT"), ("contact_tel", "TEXT"), ("office_tel", "TEXT"),
        ("motorcycle_license", "TEXT"), ("automobile_license", "TEXT"), ("religion", "TEXT"), 
        ("city", "TEXT"), ("postcode", "TEXT"), ("passport_no", "TEXT"), ("nationality", "TEXT"),
        ("verification_mode", "TEXT"), ("device_privilege", "TEXT"), ("device_password", "TEXT"),
        ("enable_holiday", "INTEGER DEFAULT 1"), ("outdoor_management", "INTEGER DEFAULT 0"),
        ("workflow_role", "TEXT"), ("app_role", "TEXT"),
        ("deleted_at", "TEXT")
    ];

    for (col, col_type) in migrations {
        let _ = conn.execute(&format!("ALTER TABLE Employees ADD COLUMN {} {}", col, col_type), []);
    }

    let _ = conn.execute("ALTER TABLE Departments ADD COLUMN branch_id INTEGER", []);
    let _ = conn.execute("ALTER TABLE Designations ADD COLUMN branch_id INTEGER", []);
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
            status TEXT DEFAULT 'offline',
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
            device_id INTEGER,
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

    // Audit Logs table for security and tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS AuditLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            record_id TEXT,
            operation TEXT NOT NULL,
            description TEXT,
            user_id INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
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
    let _ = conn.execute(
        "ALTER TABLE Devices ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE Devices ADD COLUMN comm_key INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE Devices ADD COLUMN is_default INTEGER DEFAULT 0",
        [],
    );
    let columns = vec![
        ("subnet_mask", "TEXT"),
        ("gateway", "TEXT"),
        ("dns", "TEXT"),
        ("dhcp", "INTEGER DEFAULT 0"),
        ("server_mode", "TEXT"),
        ("server_address", "TEXT"),
        ("https_enabled", "INTEGER DEFAULT 0"),
    ];
    for (col, col_type) in columns {
        let _ = conn.execute(
            &format!("ALTER TABLE Devices ADD COLUMN {} {}", col, col_type),
            [],
        );
    }
    let _ = conn.execute(
        "ALTER TABLE AttendanceLogs ADD COLUMN gate_id INTEGER NOT NULL DEFAULT 1",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE AttendanceLogs ADD COLUMN punch_method TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE Users ADD COLUMN must_change_password INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE Employees ADD COLUMN status TEXT DEFAULT 'active'",
        [],
    );

    // Migration: Add all missing columns to Employees table for full CRUD support
    let employee_columns = vec![
        ("employee_code", "TEXT"),
        ("first_name", "TEXT"),
        ("middle_name", "TEXT"),
        ("last_name", "TEXT"),
        ("date_of_birth", "TEXT"),
        ("gender", "TEXT"),
        ("marital_status", "TEXT"),
        ("personal_email", "TEXT"),
        ("personal_phone", "TEXT"),
        ("current_address", "TEXT"),
        ("permanent_address", "TEXT"),
        ("citizenship_number", "TEXT"),
        ("pan_number", "TEXT"),
        ("national_id", "TEXT"),
        ("department_id", "TEXT"),
        ("designation_id", "TEXT"),
        ("date_of_joining", "TEXT"),
        ("employment_type", "TEXT"),
        ("employment_status", "TEXT DEFAULT 'Active'"),
        ("reporting_manager_id", "TEXT"),
        ("bank_name", "TEXT"),
        ("account_number", "TEXT"),
        ("emergency_contact_name", "TEXT"),
        ("emergency_contact_phone", "TEXT"),
        ("emergency_contact_relation", "TEXT"),
        ("area_id", "TEXT"),
        ("location_id", "TEXT"),
        ("photo", "TEXT"),
        ("enable_self_service", "INTEGER DEFAULT 0"),
        ("enable_mobile_access", "INTEGER DEFAULT 0"),
        ("local_name", "TEXT"),
        ("contact_tel", "TEXT"),
        ("office_tel", "TEXT"),
        ("motorcycle_license", "TEXT"),
        ("automobile_license", "TEXT"),
        ("religion", "TEXT"),
        ("city", "TEXT"),
        ("postcode", "TEXT"),
        ("passport_no", "TEXT"),
        ("nationality", "TEXT"),
        ("verification_mode", "TEXT"),
        ("device_privilege", "TEXT"),
        ("device_password", "TEXT"),
        ("card_no", "TEXT"),
        ("bio_photo", "TEXT"),
        ("enable_attendance", "INTEGER DEFAULT 1"),
        ("enable_holiday", "INTEGER DEFAULT 1"),
        ("outdoor_management", "INTEGER DEFAULT 0"),
        ("workflow_role", "TEXT"),
        ("mobile_punch", "INTEGER DEFAULT 0"),
        ("app_role", "TEXT"),
        ("whatsapp_alert", "INTEGER DEFAULT 0"),
        ("whatsapp_exception", "INTEGER DEFAULT 0"),
        ("whatsapp_punch", "INTEGER DEFAULT 0"),
        ("supervisor_mobile", "TEXT"),
        ("created_at", "TEXT DEFAULT (datetime('now'))"),
        ("updated_at", "TEXT DEFAULT (datetime('now'))"),
    ];
    for (col, col_type) in employee_columns {
        let _ = conn.execute(
            &format!("ALTER TABLE Employees ADD COLUMN {} {}", col, col_type),
            [],
        );
    }

    // Migrate existing data: populate first_name/last_name from name
    let _ = conn.execute(
        "UPDATE Employees SET first_name = TRIM(SUBSTR(name, 1, INSTR(name, ' ') - 1)), last_name = TRIM(SUBSTR(name, INSTR(name, ' ') + 1)) WHERE first_name IS NULL AND INSTR(name, ' ') > 0",
        [],
    );
    let _ = conn.execute(
        "UPDATE Employees SET first_name = name WHERE first_name IS NULL",
        [],
    );
    let _ = conn.execute(
        "UPDATE Employees SET employee_code = 'BB-' || printf('%04d', id) WHERE employee_code IS NULL",
        [],
    );
    let _ = conn.execute(
        "UPDATE Employees SET employment_status = UPPER(status) WHERE status IS NOT NULL",
        [],
    );

    // Migration for LeaveRequests table
    let _ = conn.execute(
        "ALTER TABLE LeaveRequests ADD COLUMN leave_type TEXT DEFAULT 'Casual Leave'",
        [],
    );
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
            sender_id INTEGER,
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

    // Offline-First Sync Queue table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS SyncQueue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
            payload TEXT NOT NULL,
            record_id TEXT NOT NULL,
            supabase_id TEXT,
            priority TEXT DEFAULT 'MEDIUM',
            status TEXT DEFAULT 'PENDING',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            synced_at TEXT,
            retry_count INTEGER DEFAULT 0,
            error_message TEXT
        )",
        [],
    );
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON SyncQueue(status) WHERE status = 'PENDING'", []);
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON SyncQueue(table_name)",
        [],
    );

    // Inventory Items table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS Items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'General',
            quantity INTEGER DEFAULT 0,
            unit_price REAL DEFAULT 0,
            reorder_level INTEGER DEFAULT 10,
            supplier TEXT,
            location TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    );

    // Projects table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS Projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Planning',
            priority TEXT DEFAULT 'Medium',
            start_date TEXT,
            end_date TEXT,
            budget REAL DEFAULT 0,
            progress INTEGER DEFAULT 0,
            team_size INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    );

    // CRM Leads table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS Leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            company TEXT,
            email TEXT,
            phone TEXT,
            status TEXT DEFAULT 'New',
            source TEXT DEFAULT 'Website',
            value REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    );

    // Assets table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS Assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            asset_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'Electronics',
            status TEXT DEFAULT 'Active',
            purchase_date TEXT,
            purchase_cost REAL DEFAULT 0,
            assigned_to TEXT,
            location TEXT,
            warranty_expiry TEXT,
            condition TEXT DEFAULT 'Good',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )",
        [],
    );

    // System Configuration table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS SystemConfigs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            UNIQUE(category, key)
        )",
        [],
    )?;

    // Seed default configs
    let default_configs = vec![
        ("general", "app_name", "BioBridge Pro HR"),
        ("general", "theme", "dark"),
        ("company", "name", "Your Company Ltd."),
        ("company", "address", "Kathmandu, Nepal"),
        ("localization", "calendar_mode", "BS"),
        ("localization", "currency", "NPR"),
        ("security", "session_timeout", "30"),
        ("notifications", "email_enabled", "0"),
        ("attendance", "ot_enabled", "1"),
        ("payroll", "basic_salary_type", "Monthly"),
        ("database", "auto_backup", "1"),
        ("database", "supabase_url", ""),
        ("database", "supabase_key", ""),
    ];
    for (cat, key, val) in default_configs {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO SystemConfigs (category, key, value) VALUES (?1, ?2, ?3)",
            [cat, key, val],
        );
    }

    // Ensure uniqueness constraint for offline-first permanent sync
    let _ = conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_attendancelogs_emp_time ON AttendanceLogs (employee_id, timestamp)", []);

    // Seed default data
    conn.execute(
        "INSERT OR IGNORE INTO Organizations (id, name) VALUES (1, 'Default Organization')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO Branches (id, org_id, name) VALUES (1, 1, 'Head Office')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO Gates (id, branch_id, name) VALUES (1, 1, 'Main Gate')",
        [],
    )?;

    // Seed default system device for manual entries (using 999 to avoid collision with physical devices)
    let _ = conn.execute(
        "INSERT OR IGNORE INTO Devices (id, name, brand, ip_address, port, status) VALUES (999, 'System/Manual', 'Internal', '0.0.0.0', 0, 'online')",
        [],
    );

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

    // Seed corporate dummy data
    let branches = vec![
        (2, "Kathmandu Branch", "New Road, KTM"),
        (3, "Pokhara Branch", "Lakeside, PKR"),
        (4, "Butwal Branch", "Main Road, BTL"),
    ];
    for (id, name, loc) in branches {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO Branches (id, org_id, name, location) VALUES (?1, 1, ?2, ?3)",
            [id.to_string(), name.to_string(), loc.to_string()],
        );
        // Queue for Supabase Sync
        let _ = conn.execute(
            "INSERT OR IGNORE INTO SyncQueue (table_name, operation, record_id, payload, priority, status, created_at)
             VALUES ('branches', 'INSERT', ?1, ?2, 'HIGH', 'PENDING', datetime('now'))",
            [id.to_string(), serde_json::json!({"id": id, "name": name, "location": loc, "org_id": 1}).to_string()],
        );
    }

    let departments = vec![
        "Human Resources", "Information Technology", "Finance", 
        "Marketing", "Sales", "Operations", "Logistics"
    ];
    for (i, dept) in departments.iter().enumerate() {
        let dept_id = i + 1;
        let _ = conn.execute("INSERT OR IGNORE INTO Departments (id, name) VALUES (?1, ?2)", [dept_id.to_string(), dept.to_string()]);
        // Queue for Supabase Sync
        let _ = conn.execute(
            "INSERT OR IGNORE INTO SyncQueue (table_name, operation, record_id, payload, priority, status, created_at)
             VALUES ('departments', 'INSERT', ?1, ?2, 'HIGH', 'PENDING', datetime('now'))",
            [dept_id.to_string(), serde_json::json!({"id": dept_id, "name": dept}).to_string()],
        );
    }

    let designations = vec![
        "General Manager", "Department Head", "Senior Associate", 
        "Junior Associate", "Accountant", "Developer", "Sales Representative"
    ];
    for (i, desig) in designations.iter().enumerate() {
        let desig_id = i + 1;
        let _ = conn.execute("INSERT OR IGNORE INTO Designations (id, name) VALUES (?1, ?2)", [desig_id.to_string(), desig.to_string()]);
        // Queue for Supabase Sync
        let _ = conn.execute(
            "INSERT OR IGNORE INTO SyncQueue (table_name, operation, record_id, payload, priority, status, created_at)
             VALUES ('designations', 'INSERT', ?1, ?2, 'HIGH', 'PENDING', datetime('now'))",
            [desig_id.to_string(), serde_json::json!({"id": desig_id, "name": desig}).to_string()],
        );
    }

    let _ = conn.execute(
        "ALTER TABLE Employees ADD COLUMN biometric_id INTEGER",
        [],
    );

    // Ensure some default departments exist
    let _ = conn.execute("INSERT OR IGNORE INTO Departments (id, name) VALUES (1, 'Operations')", []);
    let _ = conn.execute("INSERT OR IGNORE INTO Departments (id, name) VALUES (2, 'Sales')", []);
    let _ = conn.execute("INSERT OR IGNORE INTO Departments (id, name) VALUES (3, 'Maintenance')", []);

    // Seed real branches (if not exist)
    conn.execute(
        "INSERT OR IGNORE INTO Branches (id, org_id, name, location) VALUES (1, 1, 'Main Office', 'Kathmandu')",
        [],
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO Gates (id, branch_id, name) VALUES (1, 1, 'Main Gate')",
        [],
    )?;

    /* 
       DUMMY DATA SEEDING (Restored per user request)
    */
    conn.execute(
        "INSERT OR IGNORE INTO Employees (id, name, first_name, last_name, employee_code, department_id, branch_id, status) 
         VALUES (101, 'Suman Shrestha', 'Suman', 'Shrestha', 'EMP-101', 1, 1, 'active')",
        []
    )?;
    conn.execute(
        "INSERT OR IGNORE INTO Employees (id, name, first_name, last_name, employee_code, department_id, branch_id, status) 
         VALUES (102, 'Dilip Kumar', 'Dilip', 'Kumar', 'EMP-102', 2, 1, 'active')",
        []
    )?;

    // Also seed some dummy invoices
    let dummy_invoices = vec![
        ("INV-2026-001", "ABC Company", "Sales", 56500.0, "Paid", "2026-04-01"),
        ("INV-2026-002", "XYZ Suppliers", "Purchase", 39550.0, "Sent", "2026-04-05"),
        ("INV-2026-003", "Tech Solutions", "Sales", 84750.0, "Overdue", "2026-03-25"),
    ];
    for (num, contact, inv_type, amount, status, date) in dummy_invoices {
        let amt_str = amount.to_string();
        let paid_str = if status == "Paid" { amount.to_string() } else if status == "Sent" { "20000.0".to_string() } else { "0.0".to_string() };
        let bal_str = if status == "Paid" { "0.0".to_string() } else if status == "Sent" { (amount - 20000.0).to_string() } else { amount.to_string() };

        let _ = conn.execute(
            "INSERT OR IGNORE INTO Invoices (invoice_number, contact_name, invoice_type, total_amount, paid_amount, balance_amount, status, invoice_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
            [
                num, 
                contact, 
                inv_type, 
                &amt_str, 
                &paid_str, 
                &bal_str, 
                status,
                date
            ],
        );
    }

    Ok(conn)
}
