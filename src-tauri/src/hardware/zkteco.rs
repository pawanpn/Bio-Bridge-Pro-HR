use async_trait::async_trait;
use tauri::Emitter;
use crate::models::AttendanceLog;
use crate::errors::AppError;
use super::DeviceDriver;

pub struct ZKTecoDriver;

/// Extract JSON from stdout, skipping any debug text before the JSON object
fn extract_json_from_stdout(raw: &str) -> serde_json::Value {
    // Find the first '{' which starts the JSON payload
    if let Some(start) = raw.find('{') {
        serde_json::from_str(&raw[start..]).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    }
}

#[async_trait]
impl DeviceDriver for ZKTecoDriver {
    fn brand_name(&self) -> &'static str { "ZKTeco" }

    async fn sync_logs(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, last_timestamp: Option<String>) -> Result<Vec<AttendanceLog>, AppError> {
        // Quick TCP pre-check — fail fast if device is unreachable
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| AppError::ConnectionError(format!("Invalid address: {}", e)))?, Duration::from_secs(2)).is_err() {
            return Err(AppError::ConnectionError(format!("Device unreachable at {}:{}", ip, port)));
        }

        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");
        
        let mut cmd = tokio::process::Command::new("node");
        cmd.arg(&script_path)
           .arg("sync")
           .arg(ip)
           .arg(port.to_string())
           .arg("10000"); // 10s wait
           
        if let Some(ts) = last_timestamp {
            cmd.arg(ts);
        }

        let output = cmd.output().await;

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let parsed = extract_json_from_stdout(&stdout);
                let mut attendance_logs = Vec::new();
                
                if let Some(attendances) = parsed.get("attendances").and_then(|a| a.as_array()) {
                    for att in attendances {
                        let emp_str = att.get("deviceUserId").and_then(|v| v.as_str()).unwrap_or("0");
                        let employee_id = emp_str.parse::<i32>().unwrap_or(0);
                        let timestamp = att.get("recordTime").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                        if employee_id > 0 && !timestamp.is_empty() {
                            attendance_logs.push(AttendanceLog {
                                device_id,
                                employee_id,
                                timestamp,
                                punch_method: "Verified".to_string()
                            });
                        }
                    }
                }
                
                Ok(attendance_logs)
            }
            Ok(output) => Err(AppError::ConnectionError(format!("Failed to retrieve logs. Error: {}", String::from_utf8_lossy(&output.stderr)))),
            Err(_) => Err(AppError::ConnectionError("Node.js not installed.".into()))
        }
    }

    async fn get_all_user_info(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<Vec<crate::models::UserInfo>, AppError> {
        // Quick TCP pre-check — fail fast if device is unreachable
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| AppError::ConnectionError(format!("Invalid address: {}", e)))?, Duration::from_secs(2)).is_err() {
            return Err(AppError::ConnectionError(format!("Device unreachable at {}:{}", ip, port)));
        }

        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");
        
        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("sync")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000") // 10s wait
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let parsed = extract_json_from_stdout(&stdout);
                let mut users = Vec::new();
                
                if let Some(users_array) = parsed.get("users").and_then(|u| u.as_array()) {
                    for u in users_array {
                        let emp_str = u.get("userId").and_then(|v| v.as_str()).unwrap_or("0");
                        let employee_id = emp_str.parse::<i32>().unwrap_or(0);
                        let name = u.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                        if employee_id > 0 {
                            users.push(crate::models::UserInfo {
                                employee_id,
                                name: if name.is_empty() { format!("User {}", employee_id) } else { name }
                            });
                        }
                    }
                }
                
                Ok(users)
            }
            Ok(output) => Err(AppError::ConnectionError(format!("Failed to retrieve users. Err: {}", String::from_utf8_lossy(&output.stderr)))),
            Err(_) => Err(AppError::ConnectionError("Node.js not installed.".into()))
        }
    }

    async fn test_connectivity(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<(), AppError> {
        // Lightweight TCP port probe — just check if the port is open.
        // No Node.js subprocess needed for a simple connectivity test.
        use std::net::TcpStream;
        use std::time::Duration;

        let addr = format!("{}:{}", ip, port);
        match TcpStream::connect_timeout(&addr.parse().map_err(|e| AppError::ConnectionError(format!("Invalid address: {}", e)))?, Duration::from_secs(3)) {
            Ok(_) => Ok(()),
            Err(_) => Err(AppError::ConnectionError(format!("Device unreachable at {}:{}", ip, port))),
        }
    }

    async fn listen_realtime(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError> {
        // Quick TCP pre-check
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| AppError::ConnectionError(format!("Invalid address: {}", e)))?, Duration::from_secs(2)).is_err() {
            return Err(AppError::ConnectionError(format!("Device unreachable at {}:{}", ip, port)));
        }

        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");

        let mut child = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("realtime")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000") // connection timeout
            .stdout(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| AppError::ConnectionError(format!("Failed to start realtime listener: {}", e)))?;

        let stdout = child.stdout.take().ok_or_else(|| AppError::ConnectionError("Could not capture stdout".into()))?;
        use tokio::io::AsyncBufReadExt;
        let mut reader = tokio::io::BufReader::new(stdout).lines();

        loop {
            if cancel.load(std::sync::atomic::Ordering::SeqCst) { 
                let _ = child.kill().await;
                break; 
            }
            
            match tokio::time::timeout(Duration::from_millis(500), reader.next_line()).await {
                Ok(Ok(Some(line))) => {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&line) {
                         if parsed["type"] == "punch" {
                              let data = &parsed["data"];
                              let emp_str = data.get("userId").and_then(|v| v.as_str()).unwrap_or("0");
                              let emp_id = emp_str.parse::<i32>().unwrap_or(0);
                              
                              if emp_id > 0 {
                                  let _ = app_handle.emit("realtime-punch", serde_json::json!({
                                      "device_id": device_id, 
                                      "employee_id": emp_id, 
                                      "timestamp": chrono::Utc::now().to_rfc3339(), 
                                      "punch_method": "Realtime"
                                  }));
                              }
                         }
                    }
                }
                Ok(Err(_)) | Ok(Ok(None)) => {
                    // Script exited or error
                    break;
                }
                _ => {} // Timeout, loop continues to check cancel flag
            }
        }
        let _ = child.kill().await;
        Ok(())
    }
}
