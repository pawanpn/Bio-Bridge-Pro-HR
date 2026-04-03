use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use async_trait::async_trait;
use std::time::Duration;
use crate::models::AttendanceLog;
use crate::errors::AppError;
use super::DeviceDriver;

const CONNECT_TIMEOUT_SECS: u64 = 10;

pub struct ZKTecoDriver;

#[async_trait]
impl DeviceDriver for ZKTecoDriver {
    fn brand_name(&self) -> &'static str { "ZKTeco" }

    async fn sync_logs(&self, ip: &str, device_id: i32) -> Result<Vec<AttendanceLog>, AppError> {
        let mut stream = connect_device(ip, 4370).await?;

        // 1. Send Connect CMD (0x03e8)
        let connect_packet = assemble_zk_packet(ZKCommand::Connect, 0, 0, &[]);
        stream.write_all(&connect_packet).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut buf = [0u8; 1024];
        let n = stream.read(&mut buf).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;
        if n < 8 { return Err(AppError::ConnectionError("Invalid response from device".to_string())); }

        // 2. Clear Session ID
        let session_id = u16::from_le_bytes([buf[8+4], buf[8+5]]);

        // 3. Request Attendance Logs (0x000d)
        let log_packet = assemble_zk_packet(ZKCommand::AttLogRrq, session_id, 1, &[]);
        stream.write_all(&log_packet).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut log_buf = vec![0u8; 8192]; // Large buffer for logs
        let bytes_read = stream.read(&mut log_buf).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // 4. Parse Logs
        // ZKTeco Attendance logs in the binary buffer start after the 8-byte header.
        // Each record is typically 12 bytes: UserID(4), Type(1), Timestamp(4), etc.
        let mut attendance_logs = Vec::new();
        let mut offset = 8; // skip header
        
        while offset + 12 <= bytes_read {
            let employee_id = u32::from_le_bytes([log_buf[offset], log_buf[offset+1], log_buf[offset+2], log_buf[offset+3]]) as i32;
            // Simplified timestamp extraction (in a real scenario, this is a bit-packed 32-bit int)
            // For now, we use a placeholder or convert correctly if possible.
            let raw_ts = u32::from_le_bytes([log_buf[offset+6], log_buf[offset+7], log_buf[offset+8], log_buf[offset+9]]);
            
            // Decoded ZK Timestamp logic:
            // Year: ((ts >> 26) & 0x3f) + 2000
            // Month: (ts >> 22) & 0x0f
            // Day: (ts >> 17) & 0x1f
            // Hour: (ts >> 12) & 0x1f
            // Min: (ts >> 6) & 0x3f
            // Sec: ts & 0x3f
            let year  = ((raw_ts >> 26) & 0x3f) + 2000;
            let month = (raw_ts >> 22) & 0x0f;
            let day   = (raw_ts >> 17) & 0x1f;
            let hour  = (raw_ts >> 12) & 0x1f;
            let min   = (raw_ts >> 6) & 0x3f;
            let sec   = raw_ts & 0x3f;

            let timestamp = format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec);

            if employee_id > 0 {
                attendance_logs.push(AttendanceLog {
                    device_id,
                    employee_id,
                    timestamp,
                });
            }
            offset += 12;
        }

        // 5. Cleanup session (Disconnect)
        let _ = stream.write_all(&assemble_zk_packet(ZKCommand::Exit, session_id, 2, &[])).await;

        Ok(attendance_logs)
    }
}

#[repr(u16)]
#[derive(Clone, Copy)]
pub enum ZKCommand {
    Connect    = 0x03e8, 
    Exit       = 0x000b, 
    EnableClock  = 0x0039, 
    DisableClock = 0x003a, 
    AttLogRrq  = 0x000d, 
}

fn create_checksum(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;
    let mut i = 0;
    let len = data.len();
    while i + 1 < len {
        let chunk = (data[i] as u32) | ((data[i + 1] as u32) << 8);
        sum += chunk;
        i += 2;
    }
    if i < len { sum += data[i] as u32; }
    while (sum >> 16) > 0 { sum = (sum & 0xffff) + (sum >> 16); }
    !(sum as u16)
}

pub fn assemble_zk_packet(cmd: ZKCommand, session_id: u16, reply_id: u16, data: &[u8]) -> Vec<u8> {
    let mut payload = Vec::with_capacity(8 + data.len());
    let cmd_val = cmd as u16;
    payload.extend_from_slice(&cmd_val.to_le_bytes());
    payload.extend_from_slice(&[0x00, 0x00]); // checksum placeholder
    payload.extend_from_slice(&session_id.to_le_bytes());
    payload.extend_from_slice(&reply_id.to_le_bytes());
    payload.extend_from_slice(data);

    let checksum = create_checksum(&payload);
    let cs = checksum.to_le_bytes();
    payload[2] = cs[0];
    payload[3] = cs[1];

    let size = payload.len() as u32;
    let mut pkt = vec![0x50, 0x50, 0x82, 0x7d];
    pkt.extend_from_slice(&size.to_le_bytes());
    pkt.extend(payload);
    pkt
}

pub async fn connect_device(ip: &str, port: u16) -> Result<TcpStream, AppError> {
    let addr = format!("{}:{}", ip, port);
    match tokio::time::timeout(
        Duration::from_secs(CONNECT_TIMEOUT_SECS),
        TcpStream::connect(&addr),
    )
    .await
    {
        Ok(Ok(stream)) => Ok(stream),
        Ok(Err(e)) => Err(AppError::ConnectionError(format!("Refused on {}: {}", addr, e))),
        Err(_) => Err(AppError::TimeoutError(CONNECT_TIMEOUT_SECS, 1)),
    }
}
