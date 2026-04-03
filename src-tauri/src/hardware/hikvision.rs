use reqwest::Client;
use async_trait::async_trait;
use std::time::Duration;
use crate::models::AttendanceLog;
use crate::errors::AppError;
use super::DeviceDriver;

const CONNECT_TIMEOUT_SECS: u64 = 10;

pub struct HikvisionDriver;

#[async_trait]
impl DeviceDriver for HikvisionDriver {
    fn brand_name(&self) -> &'static str { "Hikvision" }

    async fn sync_logs(&self, ip: &str, device_id: i32) -> Result<Vec<AttendanceLog>, AppError> {
        let url = format!("http://{}/ISAPI/AccessControl/AcsEvent?format=json", ip);

        let client = Client::builder()
            .timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
            .build()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // In production: use HTTP Digest Auth via reqwest_digest or similar.
        // For now we simulate a successful response without authentication.
        let _response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":50}}"#)
            .send()
            .await
            .map_err(|e| AppError::ConnectionError(format!("ISAPI request failed on {}: {}", ip, e)))?;

        // Production: parse _response.json() mapping to AttendanceLog structs.
        let now = chrono::Utc::now();
        Ok(vec![AttendanceLog {
            device_id,
            employee_id: 205,
            timestamp: now.to_rfc3339(),
        }])
    }
}
