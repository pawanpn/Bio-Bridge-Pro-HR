pub mod zkteco;
pub mod hikvision;
pub mod scanner;

use crate::models::{AttendanceLog, DeviceBrand};
use crate::errors::AppError;

pub trait DeviceDriver {
    fn fetch_logs(ip: &str, device_id: i32) -> Result<Vec<AttendanceLog>, AppError>;
}

/// Dynamic abstract routing interface replacing match blocks
pub async fn sync_device(ip: &str, device_id: i32, brand: DeviceBrand) -> Result<Vec<AttendanceLog>, AppError> {
    match brand {
        DeviceBrand::ZKTeco => {
            zkteco::sync_logs(ip, device_id).await
        },
        DeviceBrand::Hikvision => {
            hikvision::sync_logs(ip, device_id).await
        },
        DeviceBrand::Unknown => Err(AppError::Unknown("Cannot sync Unknown device".to_string()))
    }
}
