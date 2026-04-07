use tokio::net::UdpSocket;
use async_trait::async_trait;
use std::time::Duration;
use tauri::Emitter;
use crate::models::AttendanceLog;
use crate::errors::AppError;
use super::DeviceDriver;

const CONNECT_TIMEOUT_SECS: u64 = 10;

pub struct ZKTecoDriver;

#[async_trait]
impl DeviceDriver for ZKTecoDriver {
    fn brand_name(&self) -> &'static str { "ZKTeco" }

    async fn sync_logs(&self, ip: &str, port: u16, comm_key: i32, device_id: i32, machine_number: i32) -> Result<Vec<AttendanceLog>, AppError> {
        let socket = connect_device_udp(ip, port).await?;
        
        let session_id = establish_zk_session_udp(&socket, ip, port, comm_key, machine_number).await?;
        println!("[ZK @ {}] UDP Session ID: {}", ip, session_id);

        let log_packet = assemble_zk_packet(ZKCommand::AttLogRrq, session_id, 1, &[]);
        socket.send_to(&log_packet, format!("{}:{}", ip, port)).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut attendance_logs = Vec::new();
        let mut full_log_buf = Vec::new();
        
        // Read chunks (UDP might fragment or require multiple reads for large data)
        let mut buf = [0u8; 2048];
        loop {
            let result = tokio::time::timeout(Duration::from_secs(3), socket.recv_from(&mut buf)).await;
            match result {
                Ok(Ok((n, _))) if n > 8 => {
                    full_log_buf.extend_from_slice(&buf[0..n]);
                    // If we receive a packet smaller than buffer or containing ACK, we might be done
                    if n < 2048 { break; }
                }
                _ => break,
            }
        }

        if full_log_buf.is_empty() {
             return Err(AppError::HardwareError("Device returned no data (UDP Timeout)".into()));
        }

        let mut offset = 8;
        while offset + 12 <= full_log_buf.len() {
            let employee_id = u32::from_le_bytes([full_log_buf[offset], full_log_buf[offset+1], full_log_buf[offset+2], full_log_buf[offset+3]]) as i32;
            let raw_ts = u32::from_le_bytes([full_log_buf[offset+6], full_log_buf[offset+7], full_log_buf[offset+8], full_log_buf[offset+9]]);
            
            let year  = ((raw_ts >> 26) & 0x3f) + 2000;
            let month = (raw_ts >> 22) & 0x0f;
            let day   = (raw_ts >> 17) & 0x1f;
            let hour  = (raw_ts >> 12) & 0x1f;
            let min   = (raw_ts >> 6) & 0x3f;
            let sec   = raw_ts & 0x3f;

            let verify_mode = full_log_buf[offset+4];
            let punch_method = match verify_mode {
                1 => "Finger".to_string(),
                2 => "Card".to_string(),
                15 | 25 => "Face".to_string(),
                0 => "Password".to_string(),
                _ => format!("Mode {}", verify_mode)
            };

            let timestamp = format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec);

            if employee_id > 0 {
                attendance_logs.push(AttendanceLog { device_id, employee_id, timestamp, punch_method });
            }
            offset += 12;
        }

        let _ = socket.send_to(&assemble_zk_packet(ZKCommand::Exit, session_id, 2, &[]), format!("{}:{}", ip, port)).await;
        Ok(attendance_logs)
    }

    async fn get_all_user_info(&self, ip: &str, port: u16, comm_key: i32, machine_number: i32) -> Result<Vec<crate::models::UserInfo>, AppError> {
        let socket = connect_device_udp(ip, port).await?;
        let session_id = establish_zk_session_udp(&socket, ip, port, comm_key, machine_number).await?;

        let user_packet = assemble_zk_packet(ZKCommand::UserInfoRrq, session_id, 1, &[]);
        socket.send_to(&user_packet, format!("{}:{}", ip, port)).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut users = Vec::new();
        let mut buf = [0u8; 2048];
        let mut full_buf = Vec::new();

        loop {
            let result = tokio::time::timeout(Duration::from_secs(3), socket.recv_from(&mut buf)).await;
            match result {
                Ok(Ok((n, _))) if n > 8 => {
                    full_buf.extend_from_slice(&buf[0..n]);
                    if n < 2048 { break; }
                }
                _ => break,
            }
        }

        let mut offset = 8;
        while offset + 72 <= full_buf.len() {
            let employee_id = u32::from_le_bytes([full_buf[offset], full_buf[offset+1], full_buf[offset+2], full_buf[offset+3]]) as i32;
            let mut name_bytes = Vec::new();
            for i in 0..24 {
                let p = full_buf[offset + 24 + i];
                if p == 0 { break; }
                name_bytes.push(p);
            }
            let name = String::from_utf8_lossy(&name_bytes).trim().to_string();
            if employee_id > 0 {
                users.push(crate::models::UserInfo { employee_id, name: if name.is_empty() { format!("User {}", employee_id) } else { name } });
            }
            offset += 72;
        }

        let _ = socket.send_to(&assemble_zk_packet(ZKCommand::Exit, session_id, 2, &[]), format!("{}:{}", ip, port)).await;
        Ok(users)
    }

    async fn test_connectivity(&self, ip: &str, port: u16, comm_key: i32, machine_number: i32) -> Result<(), AppError> {
        // 1. Try UDP first (standard)
        let socket = connect_device_udp(ip, port).await?;
        if establish_zk_session_udp(&socket, ip, port, comm_key, machine_number).await.is_ok() {
            return Ok(());
        }

        // 2. Try TCP fallback (some devices/networks prefer TCP)
        let addr = format!("{}:{}", ip, port);
        match tokio::time::timeout(Duration::from_secs(3), tokio::net::TcpStream::connect(&addr)).await {
            Ok(Ok(mut stream)) => {
                use tokio::io::{AsyncWriteExt, AsyncReadExt};
                let pkt = assemble_zk_packet(ZKCommand::Connect, 0, 0, &[]); // Simple TCP probe
                let mut tcp_pkt = vec![0x50, 0x50, 0x82, 0x7d, pkt.len() as u8, 0x00]; // TCP Header (simplified)
                tcp_pkt.extend_from_slice(&pkt);
                let _ = stream.write_all(&tcp_pkt).await;
                let mut buf = [0u8; 64];
                if let Ok(Ok(n)) = tokio::time::timeout(Duration::from_secs(2), stream.read(&mut buf)).await {
                    if n > 0 { return Ok(()); }
                }
            }
            _ => {}
        }
        
        Err(AppError::ConnectionError(format!("Device at {} unreachable via UDP or TCP on port {}", ip, port)))
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
    // Explicitly connect the socket to the remote address to help with some OS firewall filters
    let _ = socket.connect(&addr).await;

    // If comm_key is provided, use it. Some devices also want the machine_number (Device ID) 
    // for identification in the data block if it's not the default 1.
    let mut data = if comm_key > 0 { comm_key.to_le_bytes().to_vec() } else { vec![] };
    if machine_number > 1 && data.is_empty() {
        data.extend_from_slice(&(machine_number as u16).to_le_bytes());
    }

    let pkt = assemble_zk_packet(ZKCommand::Connect, 0, 0, &data);

    // ZK UDP is unreliable; retry the first handshake packet up to 3 times
    let mut buf = [0u8; 1024];
    for attempt in 1..=3 {
        if let Err(e) = socket.send(&pkt).await {
            if attempt == 3 { return Err(AppError::ConnectionError(e.to_string())); }
            continue;
        }

        match tokio::time::timeout(Duration::from_secs(3), socket.recv(&mut buf)).await {
            Ok(Ok(n)) if n >= 8 => {
                let reply_code = u16::from_le_bytes([buf[0], buf[1]]);
                if reply_code == 0x07d5 { return Err(AppError::ConnectionError("Authentication Failed: Check Comm Key".into())); }
                let session_id = u16::from_le_bytes([buf[4], buf[5]]);
                return Ok(session_id);
            }
            _ => {
                eprintln!("[ZK @ {}] Connect attempt {}/3 timed out, retrying...", ip, attempt);
                if attempt == 3 { return Err(AppError::TimeoutError(9, attempt)); }
            }
        }
    }
    Err(AppError::TimeoutError(9, 3))
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
