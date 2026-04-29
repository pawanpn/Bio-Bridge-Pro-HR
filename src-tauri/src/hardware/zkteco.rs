/// ZKTeco Device Driver using Node.js Bridge (zk_fetch.cjs)
/// 
/// This module handles communication with ZKTeco attendance devices via Node.js.
/// Script location: src-tauri/scripts/zk_fetch.cjs
/// Path resolution: Uses CARGO_MANIFEST_DIR for dev, app dir for production

use async_trait::async_trait;
use tauri::Emitter;
use crate::models::AttendanceLog;
use crate::errors::AppError;
use super::DeviceDriver;

pub struct ZKTecoDriver;

/// Get the correct path to zk_fetch.cjs script
/// Works in both development and production environments
fn get_script_path() -> std::path::PathBuf {
    // Method 1: Try CARGO_MANIFEST_DIR (development)
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let dev_path = manifest_dir.join("scripts").join("zk_fetch.cjs");
    
    if dev_path.exists() {
        return dev_path;
    }
    
    // Method 2: Try relative to executable (production)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let prod_path = exe_dir.join("..").join("scripts").join("zk_fetch.cjs");
            if prod_path.exists() {
                return prod_path;
            }
        }
    }
    
    // Method 3: Fallback to current working directory
    let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    current_dir.join("scripts").join("zk_fetch.cjs")
}

/// Extract JSON from stdout, skipping any debug text before the JSON object
fn extract_json_from_stdout(raw: &str) -> serde_json::Value {
    if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            if end >= start {
                return serde_json::from_str(&raw[start..=end]).unwrap_or_else(|e| {
                    println!("JSON Parse error: {}", e);
                    serde_json::json!({})
                });
            }
        }
    }
    serde_json::json!({})
}

/// Verify Node.js is available
fn verify_node_available() -> Result<(), AppError> {
    let output = std::process::Command::new("node")
        .arg("--version")
        .output()
        .map_err(|e| AppError::ConnectionError(format!("Node.js not found: {}. Please install Node.js v18+", e)))?;
    
    if !output.status.success() {
        return Err(AppError::ConnectionError("Node.js is not installed or not in PATH".to_string()));
    }
    
    Ok(())
}

#[async_trait]
impl DeviceDriver for ZKTecoDriver {
    fn brand_name(&self) -> &'static str { "ZKTeco" }

    async fn sync_logs(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, last_timestamp: Option<String>) -> Result<(Vec<crate::models::UserInfo>, Vec<AttendanceLog>), AppError> {
        // Step 1: Quick TCP pre-check
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| 
            AppError::ConnectionError(format!("Invalid address: {}", e))
        )?, Duration::from_secs(3)).is_err() {
            return Err(AppError::ConnectionError(format!(
                "Device unreachable at {}:{} - Check IP address, network connection, and device power",
                ip, port
            )));
        }

        // Step 2: Verify Node.js
        verify_node_available()?;

        // Step 3: Get script path
        let script_path = get_script_path();
        if !script_path.exists() {
            return Err(AppError::ConnectionError(format!(
                "zk_fetch.cjs not found at: {}\nExpected location: src-tauri/scripts/zk_fetch.cjs",
                script_path.display()
            )));
        }

        // Step 4: Build command
        let mut cmd = tokio::process::Command::new("node");
        cmd.arg(&script_path)
           .arg("sync")
           .arg(ip)
           .arg(port.to_string())
           .arg("60000"); // 60s timeout

        if let Some(ts) = last_timestamp {
            cmd.arg(ts);
        }

        // Step 5: Execute
        let output = cmd.output().await.map_err(|e| 
            AppError::ConnectionError(format!("Failed to execute node script: {}", e))
        )?;

        // Step 6: Parse response
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!(
                "Script execution failed:\n{}", stderr
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);
        let mut attendance_logs = Vec::new();
        let mut users = Vec::new();

        if let Some(users_array) = parsed.get("users").and_then(|u| u.get("data")).and_then(|d| d.as_array()) {
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

        if let Some(attendances) = parsed.get("attendances").and_then(|a| a.get("data")).and_then(|d| d.as_array()) {
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

        Ok((users, attendance_logs))
    }

    async fn get_all_user_info(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<Vec<crate::models::UserInfo>, AppError> {
        // Step 1: TCP pre-check
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| 
            AppError::ConnectionError(format!("Invalid address: {}", e))
        )?, Duration::from_secs(3)).is_err() {
            return Err(AppError::ConnectionError(format!(
                "Device unreachable at {}:{}", ip, port
            )));
        }

        // Step 2: Verify Node.js
        verify_node_available()?;

        // Step 3: Get script path
        let script_path = get_script_path();
        if !script_path.exists() {
            return Err(AppError::ConnectionError(format!(
                "zk_fetch.cjs not found at: {}", script_path.display()
            )));
        }

        // Step 4: Execute
        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("sync")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000")
            .output()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to execute: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!(
                "Failed to retrieve users:\n{}", stderr
            )));
        }

        // Step 5: Parse users
        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);
        let mut users = Vec::new();

        if let Some(users_array) = parsed.get("users").and_then(|u| u.get("data")).and_then(|d| d.as_array()) {
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

    async fn test_connectivity(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<(), AppError> {
        // Lightweight TCP port probe
        use std::net::TcpStream;
        use std::time::Duration;

        let addr = format!("{}:{}", ip, port);
        match TcpStream::connect_timeout(&addr.parse().map_err(|e| 
            AppError::ConnectionError(format!("Invalid address: {}", e))
        )?, Duration::from_secs(3)) {
            Ok(_) => Ok(()),
            Err(_) => Err(AppError::ConnectionError(format!(
                "Device unreachable at {}:{} - Check IP, port, and device power",
                ip, port
            ))),
        }
    }

    async fn listen_realtime(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError> {
        // TCP pre-check
        use std::net::TcpStream;
        use std::time::Duration;
        let addr = format!("{}:{}", ip, port);
        if TcpStream::connect_timeout(&addr.parse().map_err(|e| 
            AppError::ConnectionError(format!("Invalid address: {}", e))
        )?, Duration::from_secs(3)).is_err() {
            return Err(AppError::ConnectionError(format!(
                "Device unreachable at {}:{}", ip, port
            )));
        }

        // Get script path
        let script_path = get_script_path();
        if !script_path.exists() {
            return Err(AppError::ConnectionError(format!(
                "zk_fetch.cjs not found at: {}", script_path.display()
            )));
        }

        // Spawn realtime listener
        let mut child = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("realtime")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000")
            .stdout(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| AppError::ConnectionError(format!("Failed to start realtime listener: {}", e)))?;

        let stdout = child.stdout.take().ok_or_else(|| 
            AppError::ConnectionError("Could not capture stdout".into())
        )?;
        
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
                                    "timestamp": chrono::Local::now().to_rfc3339(),
                                    "punch_method": "Realtime"
                                }));
                            }
                        }
                    }
                }
                Ok(Err(_)) | Ok(Ok(None)) => {
                    break;
                }
                _ => {}
            }
        }
        
        let _ = child.kill().await;
        Ok(())
    }

    async fn push_user_info(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32, user_id: i32, name: &str, role: i32, card_no: &str) -> Result<(), AppError> {
        // Step 1: Verify Node.js
        verify_node_available()?;

        // Step 2: Get script path
        let script_path = get_script_path();
        if !script_path.exists() {
            return Err(AppError::ConnectionError(format!(
                "zk_fetch.cjs not found"
            )));
        }

        // Step 3: Execute setUser command
        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("setUser")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000") // 10s timeout
            .arg(user_id.to_string())
            .arg(name)
            .arg(role.to_string())
            .arg(card_no)
            .output()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to execute: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!(
                "Failed to set user on device:\n{}", stderr
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);
        
        if parsed.get("status").and_then(|s| s.as_str()) == Some("success") {
            Ok(())
        } else {
            let msg = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown script error");
            Err(AppError::ConnectionError(format!("Script reported error: {}", msg)))
        }
    }

    async fn pull_user_biometric(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32, user_id: i32) -> Result<serde_json::Value, AppError> {
        // Step 1: Verify Node.js
        verify_node_available()?;

        // Step 2: Get script path
        let script_path = get_script_path();
        if !script_path.exists() {
            return Err(AppError::ConnectionError(format!("zk_fetch.cjs not found")));
        }

        // Step 3: Execute getFingerprints command
        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("getFingerprints")
            .arg(ip)
            .arg(port.to_string())
            .arg("20000") // 20s timeout for large data
            .arg(user_id.to_string())
            .output()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to execute: {}", e)))?;

        // Step 4: Parse response
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!("Failed to pull biometric:\n{}", stderr)));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);
        
        if parsed.get("status").and_then(|s| s.as_str()) == Some("success") {
            Ok(parsed["data"].clone())
        } else {
            let msg = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown script error");
            Err(AppError::ConnectionError(format!("Script reported error: {}", msg)))
        }
    }

    async fn get_device_user_count(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32) -> Result<serde_json::Value, AppError> {
        verify_node_available()?;
        let script_path = get_script_path();
        if !script_path.exists() { return Err(AppError::ConnectionError(format!("zk_fetch.cjs not found"))); }

        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("getUserCount")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000")
            .output()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to execute: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!("Failed to get user count:\n{}", stderr)));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);
        Ok(parsed)
    }

    async fn enroll_user_on_device(&self, ip: &str, port: u16, _comm_key: i32, _machine_number: i32, user_id: i32, name: &str, role: i32, card_no: &str) -> Result<(), AppError> {
        verify_node_available()?;
        let script_path = get_script_path();
        if !script_path.exists() { return Err(AppError::ConnectionError(format!("zk_fetch.cjs not found"))); }

        let output = tokio::process::Command::new("node")
            .arg(&script_path)
            .arg("enroll")
            .arg(ip)
            .arg(port.to_string())
            .arg("10000")
            .arg(user_id.to_string())
            .arg(name)
            .arg(role.to_string())
            .arg(card_no)
            .output()
            .await
            .map_err(|e| AppError::ConnectionError(format!("Failed to execute: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::ConnectionError(format!("Failed to enroll:\n{}", stderr)));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let parsed = extract_json_from_stdout(&stdout);

        if parsed.get("status").and_then(|s| s.as_str()) == Some("success") {
            Ok(())
        } else {
            let msg = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown script error");
            Err(AppError::ConnectionError(format!("Script reported error: {}", msg)))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_script_path_resolution() {
        let path = get_script_path();
        println!("Resolved script path: {}", path.display());
        // Should point to src-tauri/scripts/zk_fetch.cjs
        assert!(path.ends_with("zk_fetch.cjs"));
    }

    #[test]
    fn test_node_available() {
        match verify_node_available() {
            Ok(_) => println!("✅ Node.js is available"),
            Err(e) => println!("❌ Node.js check failed: {}", e),
        }
    }
}
