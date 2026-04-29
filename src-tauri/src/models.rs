use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AttendanceLog {
    pub device_id: i32,
    pub employee_id: i32,
    pub timestamp: String,
    pub punch_method: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UserInfo {
    pub employee_id: i32,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
pub enum DeviceBrand {
    ZKTeco,
    Hikvision,
    Unknown
}
