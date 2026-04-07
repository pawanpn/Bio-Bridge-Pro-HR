use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AttendanceLog {
    pub device_id: i32,
    pub employee_id: i32,
    pub timestamp: String,
    // Note: To map Employee Phone, append it identically here avoiding divergence.
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserInfo {
    pub employee_id: i32,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum DeviceBrand {
    ZKTeco,
    Hikvision,
    Unknown
}
