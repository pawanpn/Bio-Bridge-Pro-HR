use reqwest::Client;
use async_trait::async_trait;
use std::time::Duration;
use serde_json::Value;
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

        // 1. Fetch Logs
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":100}}"#)
            .send()
            .await
            .map_err(|e| AppError::ConnectionError(format!("ISAPI request failed on {}: {}", ip, e)))?;

        // 2. Parse Response
        let json: Value = response.json().await
            .map_err(|e| AppError::SerializationError(format!("Invalid ISAPI response: {}", e)))?;

        let mut attendance_logs = Vec::new();

        if let Some(events) = json["AcsEvent"]["InfoList"].as_array() {
            for event in events {
                // Hikvision ISAPI: employeeNoString is the user ID. time is the timestamp.
                let employee_id = event["employeeNoString"]
                    .as_str()
                    .and_then(|s| s.parse::<i32>().ok())
                    .unwrap_or(0);
                
                let timestamp = event["time"]
                    .as_str()
                    .unwrap_or("")
                    .to_string();

                if employee_id > 0 {
                    attendance_logs.push(AttendanceLog {
                        device_id,
                        employee_id,
                        timestamp,
                    });
                }
            }
        }

        Ok(attendance_logs)
    }
}
