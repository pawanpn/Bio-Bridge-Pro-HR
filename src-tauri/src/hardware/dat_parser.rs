use crate::models::{AttendanceLog, UserInfo};
use std::fs;

#[allow(dead_code)]
pub fn parse_user_dat(file_path: &str) -> Result<Vec<UserInfo>, String> {
    let data = fs::read(file_path).map_err(|e| e.to_string())?;
    let mut users = Vec::new();
    let mut offset = 0;

    // Depending on ZK version, a user record is typically 72 bytes
    while offset + 72 <= data.len() {
        // Read 2-byte ID first (standard for user.dat in many versions)
        let id_2 = u16::from_le_bytes([data[offset], data[offset+1]]) as i32;
        let id_4 = u32::from_le_bytes([data[offset+0], data[offset+1], data[offset+2], data[offset+3]]) as i32;
        
        // If id_4 is huge, it's likely a 2-byte ID being misread
        let employee_id = if id_4 > 1000000 { id_2 } else { id_4 };
        
        let mut name_bytes = Vec::new();
        // Name is at offset 24 and is typically 24-40 bytes
        for i in 0..30 {
            let p = data[offset + 24 + i];
            if p == 0 { break; }
            name_bytes.push(p);
        }
        let name = String::from_utf8_lossy(&name_bytes).trim().to_string();
        
        if employee_id > 0 {
            users.push(UserInfo { 
                employee_id, 
                name: if name.is_empty() { format!("User {}", employee_id) } else { name } 
            });
        }
        offset += 72;
    }
    Ok(users)
}

#[allow(dead_code)]
pub fn parse_attlog_dat(file_path: &str, device_id: i32) -> Result<Vec<AttendanceLog>, String> {
    let data = fs::read(file_path).map_err(|e| e.to_string())?;
    let mut logs = Vec::new();
    let mut offset = 0;

    while offset + 12 <= data.len() {
        let employee_id = u32::from_le_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]) as i32;
        let verify_mode = data[offset+4];
        let raw_ts = u32::from_le_bytes([data[offset+6], data[offset+7], data[offset+8], data[offset+9]]);
        
        let year  = ((raw_ts >> 26) & 0x3f) + 2000;
        let month = (raw_ts >> 22) & 0x0f;
        let day   = (raw_ts >> 17) & 0x1f;
        let hour  = (raw_ts >> 12) & 0x1f;
        let min   = (raw_ts >> 6) & 0x3f;
        let sec   = raw_ts & 0x3f;

        let timestamp = format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec);
        
        let punch_method = match verify_mode {
            1 => "Finger".to_string(),
            2 => "Card".to_string(),
            15 | 25 => "Face".to_string(),
            0 => "Password".to_string(),
            _ => format!("Mode {}", verify_mode)
        };

        if employee_id > 0 {
            logs.push(AttendanceLog { device_id, employee_id, timestamp, punch_method });
        }
        offset += 12;
    }
    Ok(logs)
}
