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

/// Spawns a Tokio multi-threaded job to sweep a local IPv4 range.
/// Example bases: "192.168.1"
pub async fn scan_network(app: AppHandle, base_ip: String) {
    let mut join_handles = vec![];
    
    // Broadcast stating the scan has begun
    let _ = app.emit("scanner-start", base_ip.clone());

    // Iterate through all possible IPv4 host values (1 to 254)
    for i in 1..=254 {
        let ip = format!("{}.{}", base_ip, i);
        let app_handle = app.clone();
        
        let handle = tokio::spawn(async move {
            let zkteco_result = probe_port(&ip, 4370).await;
            if zkteco_result {
                let _ = app_handle.emit("device-found", DiscoveredDevice {
                    ip: ip.clone(),
                    brand: DeviceBrand::ZKTeco,
                    status: "online".to_string(),
                });
                return;
            }

            let hikvision_result = probe_port(&ip, 8000).await;
            if hikvision_result {
                let _ = app_handle.emit("device-found", DiscoveredDevice {
                    ip: ip.clone(),
                    brand: DeviceBrand::Hikvision,
                    status: "online".to_string(),
                });
                return;
            }
        });
        join_handles.push(handle);
    }
    
    // Wait for all 254 asynchronous port connections to timeout or resolve
    for handle in join_handles {
        let _ = handle.await;
    }
    
    let _ = app.emit("scanner-complete", ());
}

/// Helper function implementing aggressive 500ms bounds for network sweeps.
async fn probe_port(ip: &str, port: u16) -> bool {
    let addr = format!("{}:{}", ip, port);
    // Timeout set very aggressively since LAN hosts should echo instantly
    match tokio::time::timeout(Duration::from_millis(500), TcpStream::connect(&addr)).await {
        Ok(Ok(_stream)) => true,
        _ => false,
    }
}
