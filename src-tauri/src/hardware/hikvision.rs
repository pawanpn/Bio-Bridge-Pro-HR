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
    async fn sync_logs(&self, ip: &str, device_id: i32) -> Result<Vec<AttendanceLog>, AppError> {
        let url = format!("http://{}/ISAPI/AccessControl/AcsEvent?format=json", ip);
        let client = Client::builder()
            .timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS))
            .build()
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":100}}"#)
            .send()
            .await
            .map_err(|e| AppError::ConnectionError(format!("ISAPI request failed on {}: {}", ip, e)))?;

        let json: Value = response.json().await
            .map_err(|e| AppError::SerializationError(format!("Invalid ISAPI response: {}", e)))?;

        let mut attendance_logs = Vec::new();
        if let Some(events) = json["AcsEvent"]["InfoList"].as_array() {
            for event in events {
                let employee_id = event["employeeNoString"].as_str().and_then(|s| s.parse::<i32>().ok()).unwrap_or(0);
                let timestamp = event["time"].as_str().unwrap_or("").to_string();
                if employee_id > 0 {
                    attendance_logs.push(AttendanceLog { device_id, employee_id, timestamp });
                }
            }
        }
        Ok(attendance_logs)
    }

    async fn test_connectivity(&self, ip: &str, port: u16) -> Result<(), AppError> {
        let url = format!("http://{}:{}/ISAPI/System/deviceInfo", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(5)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        client.get(&url).send().await.map_err(|e| AppError::ConnectionError(e.to_string()))?;
        Ok(())
    }

    async fn listen_realtime(&self, ip: &str, port: u16, device_id: i32, app_handle: tauri::AppHandle) -> Result<(), AppError> {
        let url = format!("http://{}:{}/ISAPI/Event/notification/alertStream", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(3600)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        let mut response = client.get(&url).send().await.map_err(|e| AppError::ConnectionError(format!("AlertStream failed: {}", e)))?;

        while let Ok(Some(chunk)) = response.chunk().await {
            let chunk_str = String::from_utf8_lossy(&chunk);
            if chunk_str.contains("AccessControlEvent") {
                if let Some(id_start) = chunk_str.find("<employeeNoString>") {
                    let id_end = chunk_str[id_start..].find("</employeeNoString>").unwrap_or(0);
                    let employee_id_str = &chunk_str[id_start + 18..id_start + id_end];
                    let employee_id = employee_id_str.parse::<i32>().unwrap_or(0);
                    if employee_id > 0 {
                        let now = chrono::Utc::now().to_rfc3339();
                        let _ = app_handle.emit("realtime-punch", serde_json::json!({
                            "device_id": device_id, "employee_id": employee_id, "timestamp": now, "brand": "Hikvision"
                        }));
                    }
                }
            }
        }
        Ok(())
    }
}
