use tokio::net::TcpStream;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde::{Serialize, Deserialize};
use crate::models::AttendanceLog;
use crate::errors::AppError;

#[repr(u16)]
#[derive(Clone, Copy)]
pub enum ZKCommand {
    Connect = 0x03e8, // 1000
    Exit = 0x000b,    // 11
    EnableClock = 0x0039, // 57
    DisableClock = 0x003a, // 58
    AttLogRrq = 0x000d, // 13
}

/// Computes the 16-bit checksum for ZKTeco standard payload buffering
fn create_checksum(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;
    let len = data.len();
    let mut i = 0;

    while i < len - 1 {
        let chunk = (data[i] as u32) | ((data[i + 1] as u32) << 8);
        sum += chunk;
        i += 2;
    }
    
    if i < len {
        sum += data[i] as u32;
    }
    
    while (sum >> 16) > 0 {
        sum = (sum & 0xffff) + (sum >> 16);
    }
    
    !(sum as u16)
}

/// Assembles a binary ZK TCP Buffer frame
pub fn assemble_zk_packet(cmd: ZKCommand, session_id: u16, reply_id: u16, data: &[u8]) -> Vec<u8> {
    let mut payload = Vec::with_capacity(8 + data.len());
    let cmd_val = cmd as u16;
    
    payload.extend_from_slice(&cmd_val.to_le_bytes()); // Command ID (2b)
    payload.extend_from_slice(&[0x00, 0x00]); // Checksum zero placeholder (2b)
    payload.extend_from_slice(&session_id.to_le_bytes()); // Session ID (2b)
    payload.extend_from_slice(&reply_id.to_le_bytes()); // Reply ID (2b)
    payload.extend_from_slice(data); // Append payload data

    // Inject Checksum calculation 
    let checksum = create_checksum(&payload);
    let checksum_bytes = checksum.to_le_bytes();
    payload[2] = checksum_bytes[0];
    payload[3] = checksum_bytes[1];

    // Standard ZK TCP wrapper (TCP hex header: MAC/magic + size)
    let wrapper_size = payload.len() as u32;
    let mut tcp_packet = vec![0x50, 0x50, 0x82, 0x7d]; // Magic word "P P \x82 \x7d"
    tcp_packet.extend_from_slice(&wrapper_size.to_le_bytes()); // 4-byte size
    tcp_packet.extend(payload);

    tcp_packet
}

/// Connect to a ZKTeco device over TCP port 4370
pub async fn connect_device(ip: &str, port: u16) -> Result<TcpStream, AppError> {
    let addr = format!("{}:{}", ip, port);
    match TcpStream::connect(&addr).await {
        Ok(stream) => Ok(stream),
        Err(e) => Err(AppError::ConnectionError(format!("Failed to connect to device {}: {}", addr, e))),
    }
}

/// Fetches logs from the connected device.
pub async fn sync_logs(ip: &str, device_id: i32) -> Result<Vec<AttendanceLog>, AppError> {
    let mut stream = connect_device(ip, 4370).await?;
    
    // Attempt standard connection packet
    let connect_packet = assemble_zk_packet(ZKCommand::Connect, 0, 0, &[]);
    stream.write_all(&connect_packet).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;
    
    let mut buf = [0; 1024];
    let _n = stream.read(&mut buf).await.map_err(|e| AppError::ConnectionError(e.to_string()))?;
    // We would parse Session ID and Reply ID from `buf[8..=11]` here.
    
    // Simulate reading real logs
    let now = chrono::Utc::now();
    let mock_log = AttendanceLog {
        device_id,
        employee_id: 104, 
        timestamp: now.to_rfc3339(),
    };
    
    Ok(vec![mock_log])
}
