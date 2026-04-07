use tauri::{AppHandle, Emitter};
use tokio::net::TcpStream;
use std::time::Duration;
use serde::Serialize;
use super::DeviceBrand;

#[derive(Serialize, Clone)]
pub struct DiscoveredDevice {
    pub ip: String,
    pub brand: DeviceBrand,
    pub status: String,
}

pub async fn scan_network(app: AppHandle, base_ip: String) {
    let subnets = if base_ip.is_empty() {
        vec!["192.168.1".to_string(), "192.168.0".to_string(), "10.0.0".to_string()]
    } else {
        vec![base_ip.clone()]
    };

    let _ = app.emit("scanner-start", format!("{:?}", subnets));
    let mut join_handles = vec![];
    
    for subnet in subnets {
        for i in 1..=254 {
            let ip = format!("{}.{}", subnet, i);
            let app_handle = app.clone();
            
            let handle = tokio::spawn(async move {
                // Multi-protocol probe
                if probe_zkteco_udp(&ip).await {
                    let _ = app_handle.emit("device-found", DiscoveredDevice {
                        ip: ip.clone(),
                        brand: DeviceBrand::ZKTeco,
                        status: "online (UDP)".to_string(),
                    });
                    return;
                }

                if probe_port(&ip, 4370).await {
                    let _ = app_handle.emit("device-found", DiscoveredDevice {
                        ip: ip.clone(),
                        brand: DeviceBrand::ZKTeco,
                        status: "online (TCP)".to_string(),
                    });
                    return;
                }

                if probe_port(&ip, 8000).await {
                    let _ = app_handle.emit("device-found", DiscoveredDevice {
                        ip: ip.clone(),
                        brand: DeviceBrand::Hikvision,
                        status: "online (ISAPI)".to_string(),
                    });
                    return;
                }
            });
            join_handles.push(handle);
        }
    }
    
    for handle in join_handles { let _ = handle.await; }
    let _ = app.emit("scanner-complete", ());
}

async fn probe_port(ip: &str, port: u16) -> bool {
    let addr = format!("{}:{}", ip, port);
    match tokio::time::timeout(Duration::from_millis(600), TcpStream::connect(&addr)).await {
        Ok(Ok(_)) => true,
        _ => false,
    }
}

async fn probe_zkteco_udp(ip: &str) -> bool {
   use tokio::net::UdpSocket;
   let socket = match UdpSocket::bind("0.0.0.0:0").await { Ok(s) => s, _ => return false };
   let _ = socket.connect(format!("{}:4370", ip)).await;
   
   // Send a standard ZK UDP Connect packet (CMD_CONNECT = 1000)
   let pkt = vec![
       0xe8, 0x03,       // CMD_CONNECT
       0x17, 0xfc,       // Checksum (empty data)
       0x00, 0x00,       // Session ID
       0x00, 0x00,       // Reply Number
   ];
   
   if socket.send(&pkt).await.is_err() { return false; }
   let mut buf = [0u8; 32];
   match tokio::time::timeout(Duration::from_millis(800), socket.recv(&mut buf)).await {
       Ok(Ok(n)) if n >= 8 => true,
       _ => false,
   }
}
