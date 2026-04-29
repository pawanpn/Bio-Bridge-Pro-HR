use reqwest::Client;
use async_trait::async_trait;
use tauri::Emitter;
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

    async fn sync_logs(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, _last_timestamp: Option<String>) -> Result<(Vec<crate::models::UserInfo>, Vec<AttendanceLog>), AppError> {
        let url = format!("http://{}:{}/ISAPI/AccessControl/AcsEvent?format=json", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":100}}"#)
            .send().await.map_err(|e| AppError::ConnectionError(format!("ISAPI request failed on {}: {}", ip, e)))?;

        let json: Value = response.json().await.map_err(|e| AppError::SerializationError(format!("Invalid ISAPI response: {}", e)))?;

        let mut attendance_logs = Vec::new();
        if let Some(events) = json["AcsEvent"]["InfoList"].as_array() {
            for event in events {
                let employee_id = event["employeeNoString"].as_str().and_then(|s| s.parse::<i32>().ok()).unwrap_or(0);
                let raw_mode = event["currentVerifyModeNo"].as_u64().unwrap_or(0);
                let punch_method = match raw_mode {
                    1 => "Face".to_string(),
                    2 => "Finger".to_string(),
                    3 => "Card".to_string(),
                    _ => "Face/Finger".to_string()
                };

                let timestamp = event["time"].as_str().unwrap_or("").to_string();
                if employee_id > 0 {
                    attendance_logs.push(AttendanceLog { device_id, employee_id, timestamp, punch_method });
                }
            }
        }
        Ok((Vec::new(), attendance_logs))
    }

    async fn get_all_user_info(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<Vec<crate::models::UserInfo>, AppError> {
        let url = format!("http://{}:{}/ISAPI/AccessControl/UserInfo/Search?format=json", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(CONNECT_TIMEOUT_SECS)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body(r#"{"UserInfoSearchCond":{"searchID":"1","searchResultPosition":0,"maxResults":100}}"#)
            .send().await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let json: Value = response.json().await.unwrap_or(serde_json::json!({}));
        let mut users = Vec::new();
        if let Some(user_list) = json["UserInfoSearch"]["UserInfo"].as_array() {
            for u in user_list {
                let id = u["employeeNo"].as_str().and_then(|s| s.parse::<i32>().ok()).unwrap_or(0);
                let name = u["name"].as_str().unwrap_or(&format!("User {}", id)).to_string();
                if id > 0 { users.push(crate::models::UserInfo { employee_id: id, name }); }
            }
        }
        Ok(users)
    }

    async fn test_connectivity(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<(), AppError> {
        let url = format!("http://{}:{}/ISAPI/System/deviceInfo", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(5)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        client.get(&url).send().await.map_err(|e| AppError::ConnectionError(e.to_string()))?;
        Ok(())
    }

    async fn listen_realtime(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError> {
        let url = format!("http://{}:{}/ISAPI/Event/notification/alertStream", ip, port);
        let client = Client::builder().timeout(Duration::from_secs(3600)).build().map_err(|e| AppError::ConnectionError(e.to_string()))?;
        let mut response = client.get(&url).send().await.map_err(|e| AppError::ConnectionError(format!("AlertStream failed: {}", e)))?;

        while let Ok(Some(chunk)) = response.chunk().await {
            if cancel.load(std::sync::atomic::Ordering::SeqCst) { break; }
            let chunk_str = String::from_utf8_lossy(&chunk);
            if chunk_str.contains("AccessControlEvent") {
                if let Some(id_start) = chunk_str.find("<employeeNoString>") {
                    let id_end = chunk_str[id_start..].find("</employeeNoString>").unwrap_or(0);
                    let employee_id_str = &chunk_str[id_start + 18..id_start + id_end];
                    let employee_id = employee_id_str.parse::<i32>().unwrap_or(0);
                    if employee_id > 0 {
                        let mut punch_method = "Face/Finger".to_string();
                        if let Some(mode_start) = chunk_str.find("<verifyModeNo>") {
                            let mode_end = chunk_str[mode_start..].find("</verifyModeNo>").unwrap_or(0);
                            let mode_val = &chunk_str[mode_start + 14..mode_start + mode_end];
                            punch_method = match mode_val {
                                "1" => "Face".to_string(),
                                "2" => "Finger".to_string(),
                                "3" => "Card".to_string(),
                                _ => "Face/Finger".to_string()
                            };
                        }

                        let now = chrono::Utc::now().to_rfc3339();
                        let _ = app_handle.emit("realtime-punch", serde_json::json!({
                            "device_id": device_id, "employee_id": employee_id, "timestamp": now, "brand": "Hikvision", "punch_method": punch_method
                        }));
                    }
                }
            }
        }
        Ok(())
    }
    async fn push_user_info(&self, _ip: &str, _port: u16, _comm_key: i32, _machine_number: i32, _user_id: i32, _name: &str, _role: i32, _card_no: &str) -> Result<(), AppError> {
        Err(AppError::Unknown("Push user info not implemented for Hikvision driver yet".into()))
    }

    async fn pull_user_biometric(&self, _ip: &str, _port: u16, _comm_key: i32, _machine_number: i32, _user_id: i32) -> Result<serde_json::Value, AppError> {
        Err(AppError::Unknown("Pull biometric not implemented for Hikvision driver yet".into()))
    }

    async fn get_device_user_count(&self, _ip: &str, _port: u16, _comm_key: i32, _machine_number: i32) -> Result<serde_json::Value, AppError> {
        Err(AppError::Unknown("Get device user count not implemented for Hikvision driver yet".into()))
    }

    async fn enroll_user_on_device(&self, _ip: &str, _port: u16, _comm_key: i32, _machine_number: i32, _user_id: i32, _name: &str, _role: i32, _card_no: &str) -> Result<(), AppError> {
        Err(AppError::Unknown("Enroll user not implemented for Hikvision driver yet".into()))
    }
}
