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

        let connect_packet = assemble_zk_packet(ZKCommand::Connect, 0, 0, &[]);
        stream
            .write_all(&connect_packet)
            .await
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        let mut buf = [0u8; 1024];
        stream
            .read(&mut buf)
            .await
            .map_err(|e| AppError::ConnectionError(e.to_string()))?;

        // Parse session_id from response bytes[8..10]
        let _session_id = u16::from_le_bytes([buf[8], buf[9]]);

        // Mock attendance log — real impl would iterate buf for CMD_ATTLOG records
        let now = chrono::Utc::now();
        Ok(vec![AttendanceLog {
            device_id,
            employee_id: 104,
            timestamp: now.to_rfc3339(),
        }])
    }
}

#[repr(u16)]
#[derive(Clone, Copy)]
pub enum ZKCommand {
    Connect    = 0x03e8, // 1000
    Exit       = 0x000b, // 11
    EnableClock  = 0x0039, // 57
    DisableClock = 0x003a, // 58
    AttLogRrq  = 0x000d, // 13
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

    // TCP magic header: 0x5050827d + 4-byte payload length
    let size = payload.len() as u32;
    let mut pkt = vec![0x50, 0x50, 0x82, 0x7d];
    pkt.extend_from_slice(&size.to_le_bytes());
    pkt.extend(payload);
    pkt
}

/// Opens a TCP connection with a hard 10-second timeout
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
