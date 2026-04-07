use tokio::net::UdpSocket;
use async_trait::async_trait;
use std::time::Duration;
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

    async fn sync_logs(&self, ip: &str, port: u16, _comm_key: i32, device_id: i32, _machine_number: i32) -> Result<Vec<AttendanceLog>, AppError> {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");
        
        let output = tokio::process::Command::new("node")
            .arg(script_path)
            .arg(ip)
            .arg(port.to_string())
            .arg("10000") // 10s wait
            .output()
            .await;

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
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");
        
        let output = tokio::process::Command::new("node")
            .arg(script_path)
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
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");
        
        // Spawn the node script to verify connectivity
        let output = tokio::process::Command::new("node")
            .arg(script_path)
            .arg(ip)
            .arg(port.to_string())
            .arg("3000") // 3s timeout for testing
            .output()
            .await;

        match output {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if stdout.contains("\"status\":\"success\"") {
                    return Ok(());
                }
                Err(AppError::ConnectionError(format!("Connection test failed. Log: {}", String::from_utf8_lossy(&output.stderr))))
            }
            Ok(output) => {
                Err(AppError::ConnectionError(format!("Device unreachable at {}:{}. Err: {}", ip, port, String::from_utf8_lossy(&output.stderr))))
            }
            Err(_) => {
                Err(AppError::ConnectionError("Node.js is required but not installed or script not found.".to_string()))
            }
        }
    }

    async fn listen_realtime(&self, ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32, app_handle: tauri::AppHandle, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<(), AppError> {
        let socket = connect_device_udp(ip, port).await?;
        let session_id = establish_zk_session_udp(&socket, ip, port, comm_key, machine_number).await?;

        let reg_packet = assemble_zk_packet(ZKCommand::RegEvent, session_id, 1, &[0x01, 0x00, 0x00, 0x00]);
        socket.send_to(&reg_packet, format!("{}:{}", ip, port)).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut buf = [0u8; 1024];
        loop {
            if cancel.load(std::sync::atomic::Ordering::SeqCst) { break; }
            match tokio::time::timeout(Duration::from_millis(500), socket.recv_from(&mut buf)).await {
                Ok(Ok((n, _))) if n >= 12 => {
                    let cmd_reply = u16::from_le_bytes([buf[0], buf[1]]);
                    if cmd_reply == 0x0500 {
                         let emp_id = u32::from_le_bytes([buf[8], buf[9], buf[10], buf[11]]) as i32;
                         let verify_mode = buf[12];
                         let punch_method = match verify_mode {
                             1 => "Finger".to_string(),
                             2 => "Card".to_string(),
                             15 | 25 => "Face".to_string(),
                             0 => "Password".to_string(),
                             _ => format!("Mode {}", verify_mode)
                         };
                         let _ = app_handle.emit("realtime-punch", serde_json::json!({
                             "device_id": device_id, "employee_id": emp_id, "timestamp": chrono::Utc::now().to_rfc3339(), "punch_method": punch_method
                         }));
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }
}

async fn connect_device_udp(_ip: &str, _port: u16) -> Result<UdpSocket, AppError> {
    let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| AppError::ConnectionError(format!("Socket bind failed: {}", e)))?;
    Ok(socket)
}

async fn establish_zk_session_udp(socket: &tokio::net::UdpSocket, ip: &str, port: u16, comm_key: i32, machine_number: i32) -> Result<u16, AppError> {
    let addr = format!("{}:{}", ip, port);
    let _ = socket.connect(&addr).await;

    // 1. FORCE SESSION KILL Preamble: Send a blind EXIT command to clear ghost sessions (ZKTeco Protocol workaround)
    // We send it twice: once with 0 session/reply and once as a broadcast attempt.
    let kill_pkt = assemble_zk_packet(ZKCommand::Exit, 0, 0, &[]);
    let _ = socket.send(&kill_pkt).await;
    tokio::time::sleep(Duration::from_millis(200)).await;

    // 2. Identification: Use Device ID 11 as requested. 
    // In ZK, the data block for Connect can contain either the Comm Key or the Device ID.
    let data = if comm_key > 0 { 
        comm_key.to_le_bytes().to_vec() 
    } else { 
        // Standard convention: if no comm_key is set, the payload should be purely empty, not the machine number.
        vec![]
    };

    let pkt = assemble_zk_packet(ZKCommand::Connect, 0, 0, &data);

    let mut buf = [0u8; 1024];
    for attempt in 1..=3 {
        let _ = socket.send(&pkt).await;
        match tokio::time::timeout(Duration::from_secs(3), socket.recv(&mut buf)).await {
            Ok(Ok(n)) if n >= 8 => {
                let reply_code = u16::from_le_bytes([buf[0], buf[1]]);
                
                if reply_code == 0x07d5 { // CMD_ACK_UNAUTH
                     return Err(AppError::ConnectionError(format!("Authentication Failed for Device ID {}: Check Comm Key or Device ID mapping.", machine_number))); 
                } else if reply_code == 0x07d0 { // CMD_ACK_OK
                    let session_id = u16::from_le_bytes([buf[4], buf[5]]);
                    return Ok(session_id);
                }
            }
            _ => {
                eprintln!("[ZK @ {}] Connect attempt {}/3 (Handshake for ID {}) timed out", ip, attempt, machine_number);
            }
        }
    }
    
    // Fallback logic: If ID 11 failed, try a blind empty connect as last resort
    if !data.is_empty() {
        let blind_pkt = assemble_zk_packet(ZKCommand::Connect, 0, 0, &[]);
        let _ = socket.send(&blind_pkt).await;
        if let Ok(Ok(n)) = tokio::time::timeout(Duration::from_secs(2), socket.recv(&mut buf)).await {
            if n >= 8 {
                let session_id = u16::from_le_bytes([buf[4], buf[5]]);
                return Ok(session_id);
            }
        }
    }

    Err(AppError::ConnectionError(format!("Refused at {} (ID {}). Session may be locked by another PC or firewall. Use Test Portal next.", ip, machine_number)))
}

#[repr(u16)]
#[derive(Clone, Copy)]
pub enum ZKCommand {
    Connect = 0x03e8, Exit = 0x000b, AttLogRrq = 0x000d, UserInfoRrq = 0x0009, RegEvent = 0x0041,
}

pub fn assemble_zk_packet(cmd: ZKCommand, session_id: u16, reply_id: u16, data: &[u8]) -> Vec<u8> {
    let mut payload = Vec::with_capacity(8 + data.len());
    payload.extend_from_slice(&(cmd as u16).to_le_bytes());
    payload.extend_from_slice(&[0x00, 0x00]); // checksum
    payload.extend_from_slice(&session_id.to_le_bytes());
    payload.extend_from_slice(&reply_id.to_le_bytes());
    payload.extend_from_slice(data);

    let checksum = create_checksum(&payload);
    let cs = checksum.to_le_bytes();
    payload[2] = cs[0];
    payload[3] = cs[1];
    payload
}

fn create_checksum(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;
    let mut i = 0;
    while i + 1 < data.len() {
        sum += (data[i] as u32) | ((data[i + 1] as u32) << 8);
        i += 2;
    }
    if i < data.len() { sum += data[i] as u32; }
    while (sum >> 16) > 0 { sum = (sum & 0xffff) + (sum >> 16); }
    !(sum as u16)
}
