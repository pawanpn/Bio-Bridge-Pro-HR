use rusqlite::Connection;
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app_data = std::env::var("APPDATA")?;
    let db_path = PathBuf::from(app_data)
        .join("com.biobridge.prohr")
        .join("Databases")
        .join("biobridge_pro.db");
    
    println!("Checking DB at: {}", db_path.display());
    if !db_path.exists() {
        println!("DB file does not exist!");
        return Ok(());
    }

    let conn = Connection::open(db_path)?;
    
    let emp_count: i64 = conn.query_row("SELECT COUNT(*) FROM Employees", [], |r| r.get(0))?;
    let log_count: i64 = conn.query_row("SELECT COUNT(*) FROM AttendanceLogs", [], |r| r.get(0))?;
    let branch_count: i64 = conn.query_row("SELECT COUNT(*) FROM Branches", [], |r| r.get(0))?;
    
    println!("Employees: {}", emp_count);
    println!("AttendanceLogs: {}", log_count);
    println!("Branches: {}", branch_count);
    
    let mut stmt = conn.prepare("SELECT employee_id, timestamp, punch_method FROM AttendanceLogs ORDER BY timestamp DESC LIMIT 5")?;
    let logs = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<String>>(2)?))
    })?;
    
    println!("--- Latest 5 Logs ---");
    for log in logs {
        let (eid, ts, method) = log?;
        println!("Emp ID: {}, Time: {}, Method: {:?}", eid, ts, method);
    }
    
    Ok(())
}
