pub mod zkteco;
pub mod hikvision;
pub mod scanner;
pub mod id;
pub mod dat_parser;

use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use crate::models::{AttendanceLog, DeviceBrand};
use crate::errors::AppError;

const CONNECT_TIMEOUT_SECS: u64 = 10;
const MAX_RETRIES: u32 = 3;
const RETRY_DELAY_SECS: u64 = 1;

/// Async trait that every hardware driver must implement.
/// To add a new brand: implement this trait and register it in `get_driver()`.
#[async_trait]
pub trait DeviceDriver: Send + Sync {
    async fn sync_logs(&self, ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32) -> Result<Vec<AttendanceLog>, AppError>;
    async fn get_all_user_info(&self, ip: &str, port: u16, comm_key: i32, machine_number: i32) -> Result<Vec<crate::models::UserInfo>, AppError>;
    async fn test_connectivity(&self, ip: &str, port: u16, comm_key: i32, machine_number: i32) -> Result<(), AppError>;
    async fn listen_realtime(&self, ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError>;
    fn brand_name(&self) -> &'static str;
}

/// Driver registry factory — add new brands here only.
pub fn get_driver(brand: &DeviceBrand) -> Result<Arc<dyn DeviceDriver>, AppError> {
    match brand {
        DeviceBrand::ZKTeco    => Ok(Arc::new(zkteco::ZKTecoDriver)),
        DeviceBrand::Hikvision => Ok(Arc::new(hikvision::HikvisionDriver)),
        DeviceBrand::Unknown   => Err(AppError::UnknownDriver("Unknown brand selected".to_string())),
    }
}

/// Quick connectivity check facade.
pub async fn test_device(ip: &str, port: u16, comm_key: i32, machine_number: i32, brand: DeviceBrand) -> Result<(), AppError> {
    let driver = get_driver(&brand)?;
    // Use a longer timeout for tests since the driver might retry 3 times internally (3s each)
    tokio::time::timeout(
        Duration::from_secs(15), 
        driver.test_connectivity(ip, port, comm_key, machine_number)
    ).await.map_err(|_| AppError::TimeoutError(15, 1))?
}

/// Retry wrapper: up to MAX_RETRIES attempts, each with CONNECT_TIMEOUT_SECS hard cap.
/// Any attempt returning Ok immediately short-circuits.
async fn with_retry(
    driver: Arc<dyn DeviceDriver>,
    ip: String,
    port: u16,
    comm_key: i32,
    device_id: i32,
    machine_number: i32,
) -> Result<Vec<AttendanceLog>, AppError> {
    let mut last_err = AppError::Unknown("No attempts made".to_string());

    for attempt in 1..=MAX_RETRIES {
        let d = Arc::clone(&driver);
        let ip_clone = ip.clone();

        let result = tokio::time::timeout(
            Duration::from_secs(CONNECT_TIMEOUT_SECS),
            async move { d.sync_logs(&ip_clone, port, comm_key, device_id, machine_number).await },
        )
        .await;

        match result {
            Ok(Ok(logs)) => {
                if attempt > 1 {
                    eprintln!("[{}] Succeeded on attempt {}", driver.brand_name(), attempt);
                }
                return Ok(logs);
            }
            Ok(Err(e)) => {
                eprintln!("[{} @ {}] Attempt {}/{} failed: {}", driver.brand_name(), ip, attempt, MAX_RETRIES, e);
                last_err = e;
            }
            Err(_) => {
                eprintln!("[{} @ {}] Attempt {}/{} timed out after {}s", driver.brand_name(), ip, attempt, MAX_RETRIES, CONNECT_TIMEOUT_SECS);
                last_err = AppError::TimeoutError(CONNECT_TIMEOUT_SECS, attempt);
            }
        }

        if attempt < MAX_RETRIES {
            tokio::time::sleep(Duration::from_secs(RETRY_DELAY_SECS)).await;
        }
    }

    Err(AppError::RetryExhausted(MAX_RETRIES, last_err.to_string()))
}

/// Public sync facade: resolves driver from brand, then applies retry logic.
pub async fn sync_device(ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32, brand: DeviceBrand) -> Result<Vec<AttendanceLog>, AppError> {
    let driver = get_driver(&brand)?;
    with_retry(driver, ip.to_string(), port, comm_key, device_id, machine_number).await
}

/// Public users facade: returns actual users from the device
pub async fn get_all_user_info(ip: &str, port: u16, comm_key: i32, machine_number: i32, brand: DeviceBrand) -> Result<Vec<crate::models::UserInfo>, AppError> {
    let driver = get_driver(&brand)?;
    driver.get_all_user_info(ip, port, comm_key, machine_number).await
}

/// Start a real-time event listener for a device.
pub async fn listen_device(ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32, brand: DeviceBrand, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError> {
    let driver = get_driver(&brand)?;
    driver.listen_realtime(ip, port, comm_key, device_id, machine_number, app_handle, cancel).await
}
