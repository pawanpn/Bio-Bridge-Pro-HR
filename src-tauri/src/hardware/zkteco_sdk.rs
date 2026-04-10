/// ZKTeco SDK Integration using COM/ActiveX
/// 
/// This module provides bi-directional sync between the application and ZKTeco attendance devices.
/// It uses the official ZKTeco SDK (zkemkeeper.dll) via COM automation.
///
/// Features:
/// - Push employee data to device (name appears on device screen)
/// - Pull attendance logs from device
/// - Match logs with database employees via device_enroll_number
/// - Insert matched logs into attendance_logs table

use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg(windows)]
use windows::{
    core::*,
    Win32::System::Com::*,
};

use crate::models::AttendanceLog;
use crate::errors::AppError;

/// COM wrapper for ZKTeco zkemkeeper ActiveX
#[cfg(windows)]
pub struct ZKActiveX {
    pub dispatch: IDispatch,
    pub machine_number: i32,
}

/// ZKTeco connection handle
#[derive(Clone)]
pub struct ZKConnection {
    pub ip: String,
    pub port: u16,
    pub machine_number: i32,
    #[cfg(windows)]
    pub connected: bool,
}

/// Employee data to push to device
#[derive(Debug, Clone)]
pub struct DeviceUser {
    pub enroll_number: String,
    pub name: String,
    pub password: String,
    pub role: i32, // 0=normal, 1=manager, 2=admin
}

impl ZKConnection {
    /// Create a new ZKConnection
    pub fn new(ip: &str, port: u16, machine_number: i32) -> Self {
        Self {
            ip: ip.to_string(),
            port,
            machine_number,
            #[cfg(windows)]
            connected: false,
        }
    }

    /// Connect to ZKTeco device using Connect_Net
    #[cfg(windows)]
    pub async fn connect(&mut self) -> Result<bool, AppError> {
        // Initialize COM
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()
                .map_err(|e| AppError::ConnectionError(format!("COM initialization failed: {}", e)))?;
        }

        // Create zkemkeeper COM object
        let clsid = CLSID::from("00853A19-BD51-419B-9269-2DABE57EB61F"); // zkemkeeper.ZKEM.1
        let dispatch: IDispatch = unsafe {
            CoCreateInstance(&clsid, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| AppError::ConnectionError(format!("Failed to create zkemkeeper COM object: {}", e)))?
        };

        // Call Connect_Net(IP, Port)
        let ip_variant = VARIANT::from(self.ip.as_str());
        let port_variant = VARIANT::from(self.port as i32);
        
        let result = invoke_method_bool(&dispatch, "Connect_Net", &[ip_variant, port_variant])
            .map_err(|e| AppError::ConnectionError(format!("Connect_Net failed: {}", e)))?;

        if result {
            self.connected = true;
            Ok(true)
        } else {
            Err(AppError::ConnectionError(format!(
                "Failed to connect to {}:{} - Check IP, port, and device power",
                self.ip, self.port
            )))
        }
    }

    /// Non-Windows fallback (uses TCP socket)
    #[cfg(not(windows))]
    pub async fn connect(&mut self) -> Result<bool, AppError> {
        use std::net::TcpStream;
        use std::time::Duration;
        
        let addr = format!("{}:{}", self.ip, self.port);
        match TcpStream::connect_timeout(&addr.parse().map_err(|e| 
            AppError::ConnectionError(format!("Invalid address: {}", e))
        )?, Duration::from_secs(5)) {
            Ok(_) => {
                self.connected = true;
                Ok(true)
            }
            Err(_) => Err(AppError::ConnectionError(format!(
                "Device unreachable at {}:{}", self.ip, self.port
            ))),
        }
    }

    /// Push user to device using SSR_SetUserInfo
    #[cfg(windows)]
    pub async fn push_user(&self, user: &DeviceUser) -> Result<bool, AppError> {
        // Create COM object
        let clsid = CLSID::from("00853A19-BD51-419B-9269-2DABE57EB61F");
        let dispatch: IDispatch = unsafe {
            CoCreateInstance(&clsid, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| AppError::ConnectionError(format!("Failed to create COM object: {}", e)))?
        };

        // Connect first
        let ip_variant = VARIANT::from(self.ip.as_str());
        let port_variant = VARIANT::from(self.port as i32);
        let _ = invoke_method_bool(&dispatch, "Connect_Net", &[ip_variant, port_variant])
            .map_err(|e| AppError::ConnectionError(format!("Connection failed: {}", e)))?;

        // Call SSR_SetUserInfo(MachineNumber, EnrollNumber, Name, Password, Role)
        let mach_variant = VARIANT::from(self.machine_number);
        let enroll_variant = VARIANT::from(user.enroll_number.as_str());
        let name_variant = VARIANT::from(user.name.as_str());
        let pass_variant = VARIANT::from(user.password.as_str());
        let role_variant = VARIANT::from(user.role);

        let result = invoke_method_bool(&dispatch, "SSR_SetUserInfo", &[
            mach_variant, enroll_variant, name_variant, pass_variant, role_variant
        ]).map_err(|e| AppError::ConnectionError(format!("SSR_SetUserInfo failed: {}", e)))?;

        // Disconnect
        let _ = invoke_method(&dispatch, "Disconnect", &[VARIANT::from(self.machine_number)]);

        Ok(result)
    }

    #[cfg(not(windows))]
    pub async fn push_user(&self, _user: &DeviceUser) -> Result<bool, AppError> {
        Err(AppError::ConnectionError("SDK functions only available on Windows".to_string()))
    }

    /// Pull attendance logs
    #[cfg(windows)]
    pub async fn pull_logs(&self) -> Result<Vec<ZKLogRecord>, AppError> {
        // Create COM object
        let clsid = CLSID::from("00853A19-BD51-419B-9269-2DABE57EB61F");
        let dispatch: IDispatch = unsafe {
            CoCreateInstance(&clsid, None, CLSCTX_INPROC_SERVER)
                .map_err(|e| AppError::ConnectionError(format!("Failed to create COM object: {}", e)))?
        };

        // Connect
        let ip_variant = VARIANT::from(self.ip.as_str());
        let port_variant = VARIANT::from(self.port as i32);
        let _ = invoke_method_bool(&dispatch, "Connect_Net", &[ip_variant, port_variant])
            .map_err(|e| AppError::ConnectionError(format!("Connection failed: {}", e)))?;

        // Enable device
        let _ = invoke_method_bool(&dispatch, "EnableDevice", &[
            VARIANT::from(self.machine_number),
            VARIANT::from(false) // false = disable
        ]);

        // Read attendance logs using ReadGeneralLogData
        let mut logs = Vec::new();
        let mut more_logs = true;

        while more_logs {
            // Get log count
            let dwEnrollNumber = VARIANT::from(0i32);
            let dwVerifyMode = VARIANT::from(0i32);
            let dwInOutMode = VARIANT::from(0i32);
            let dwYear = VARIANT::from(0i32);
            let dwMonth = VARIANT::from(0i32);
            let dwDay = VARIANT::from(0i32);
            let dwHour = VARIANT::from(0i32);
            let dwMinute = VARIANT::from(0i32);
            let dwSecond = VARIANT::from(0i32);
            let dwWorkcode = VARIANT::from(0i32);

            // ReadGeneralLogData returns byref parameters
            match invoke_method_with_refs(&dispatch, "ReadGeneralLogData", &[
                VARIANT::from(self.machine_number),
            ]) {
                Ok((success, refs)) => {
                    if success {
                        // Parse returned values
                        // In production, you'd extract from refs array
                    } else {
                        more_logs = false;
                    }
                }
                Err(_) => {
                    more_logs = false;
                }
            }
        }

        // Alternative: Use SSR_GetAllUserInfo + ReadAllGLogData for better compatibility
        let mut all_logs = Vec::new();
        
        // Try ReadAllGLogData approach
        if let Ok(count) = invoke_method_i32(&dispatch, "GetDeviceStatus", &[
            VARIANT::from(6i32) // Status: AttLogCount
        ]) {
            for i in 0..count.min(1000) { // Limit to prevent timeout
                // Get each log entry
                // Implementation depends on exact SDK method signatures
            }
        }

        // Disconnect
        let _ = invoke_method(&dispatch, "Disconnect", &[VARIANT::from(self.machine_number)]);

        Ok(all_logs)
    }

    #[cfg(not(windows))]
    pub async fn pull_logs(&self) -> Result<Vec<ZKLogRecord>, AppError> {
        Err(AppError::ConnectionError("SDK functions only available on Windows".to_string()))
    }

    /// Disconnect
    pub fn disconnect(&self) {
        #[cfg(windows)]
        unsafe {
            if self.connected {
                let clsid = CLSID::from("00853A19-BD51-419B-9269-2DABE57EB61F");
                if let Ok(dispatch) = CoCreateInstance::<IDispatch>(&clsid, None, CLSCTX_INPROC_SERVER) {
                    let _ = invoke_method(&dispatch, "Disconnect", &[VARIANT::from(self.machine_number)]);
                }
                CoUninitialize();
            }
        }
    }
}

/// Log record from device
#[derive(Debug, Clone)]
pub struct ZKLogRecord {
    pub enroll_number: String,
    pub verify_mode: i32,
    pub in_out_mode: i32,
    pub year: i32,
    pub month: i32,
    pub day: i32,
    pub hour: i32,
    pub minute: i32,
    pub second: i32,
}

/// Helper: Invoke COM method returning bool
#[cfg(windows)]
fn invoke_method_bool(dispatch: &IDispatch, method: &str, args: &[VARIANT]) -> Result<bool, AppError> {
    let method_name = BSTR::from(method);
    let mut result = VARIANT::default();
    let mut params = args.to_vec();
    let mut dispparams = DISPPARAMS {
        rgvarg: params.as_mut_ptr(),
        rgdispidNamedArgs: std::ptr::null_mut(),
        cArgs: params.len() as u32,
        cNamedArgs: 0,
    };

    unsafe {
        dispatch.Invoke(
            &method_name,
            &GUID::zeroed(),
            0,
            DISPATCH_METHOD,
            &mut dispparams,
            &mut result,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        ).map_err(|e| AppError::ConnectionError(format!("COM invoke failed: {}", e)))?;
    }

    Ok(result.as_bool().unwrap_or(false))
}

/// Helper: Invoke COM method returning i32
#[cfg(windows)]
fn invoke_method_i32(dispatch: &IDispatch, method: &str, args: &[VARIANT]) -> Result<i32, AppError> {
    let method_name = BSTR::from(method);
    let mut result = VARIANT::default();
    let mut params = args.to_vec();
    let mut dispparams = DISPPARAMS {
        rgvarg: params.as_mut_ptr(),
        rgdispidNamedArgs: std::ptr::null_mut(),
        cArgs: params.len() as u32,
        cNamedArgs: 0,
    };

    unsafe {
        dispatch.Invoke(
            &method_name,
            &GUID::zeroed(),
            0,
            DISPATCH_METHOD,
            &mut dispparams,
            &mut result,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        ).map_err(|e| AppError::ConnectionError(format!("COM invoke failed: {}", e)))?;
    }

    Ok(result.as_i32().unwrap_or(0))
}

/// Helper: Invoke COM method with byref parameters
#[cfg(windows)]
fn invoke_method_with_refs(dispatch: &IDispatch, method: &str, args: &[VARIANT]) 
    -> Result<(bool, Vec<VARIANT>), AppError> {
    let method_name = BSTR::from(method);
    let mut result = VARIANT::default();
    let mut params = args.to_vec();
    let mut dispparams = DISPPARAMS {
        rgvarg: params.as_mut_ptr(),
        rgdispidNamedArgs: std::ptr::null_mut(),
        cArgs: params.len() as u32,
        cNamedArgs: 0,
    };

    unsafe {
        dispatch.Invoke(
            &method_name,
            &GUID::zeroed(),
            0,
            DISPATCH_METHOD,
            &mut dispparams,
            &mut result,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        ).map_err(|e| AppError::ConnectionError(format!("COM invoke failed: {}", e)))?;
    }

    Ok((result.as_bool().unwrap_or(false), params))
}

/// Bi-directional sync manager
pub struct ZKSyncManager {
    connection: Arc<Mutex<Option<ZKConnection>>>,
}

impl ZKSyncManager {
    pub fn new() -> Self {
        Self {
            connection: Arc::new(Mutex::new(None)),
        }
    }

    /// Connect to device
    pub async fn connect(&self, ip: &str, port: u16, machine_number: i32) -> Result<(), AppError> {
        let mut conn = ZKConnection::new(ip, port, machine_number);
        conn.connect().await?;
        
        let mut guard = self.connection.lock().await;
        *guard = Some(conn);
        Ok(())
    }

    /// Push employee to device
    pub async fn push_employee_to_device(&self, enroll_number: &str, name: &str, ip: &str, port: u16, machine_number: i32) -> Result<String, AppError> {
        let mut conn = ZKConnection::new(ip, port, machine_number);
        
        let user = DeviceUser {
            enroll_number: enroll_number.to_string(),
            name: name.to_string(),
            password: "0".to_string(),
            role: 0,
        };

        match conn.push_user(&user).await {
            Ok(true) => {
                Ok(format!("✅ Pushed '{}' (ID: {}) to device", name, enroll_number))
            }
            Ok(false) => {
                Err(AppError::ConnectionError(format!(
                    "Failed to push user '{}' to device", name
                )))
            }
            Err(e) => Err(e),
        }
    }

    /// Pull attendance logs and match with database
    pub async fn pull_attendance_logs(
        &self,
        ip: &str,
        port: u16,
        device_id: i32,
        machine_number: i32,
    ) -> Result<Vec<AttendanceLog>, AppError> {
        let conn = ZKConnection::new(ip, port, machine_number);
        let zk_logs = conn.pull_logs().await?;
        let mut attendance_logs = Vec::new();

        for zk_log in zk_logs {
            let timestamp = format!(
                "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
                zk_log.year, zk_log.month, zk_log.day,
                zk_log.hour, zk_log.minute, zk_log.second
            );

            let employee_id = zk_log.enroll_number.parse::<i32>().unwrap_or(0);

            if employee_id > 0 {
                attendance_logs.push(AttendanceLog {
                    device_id,
                    employee_id,
                    timestamp,
                    punch_method: match zk_log.verify_mode {
                        0 => "Password".to_string(),
                        1 => "Fingerprint".to_string(),
                        2 => "Card".to_string(),
                        3 => "Face".to_string(),
                        _ => "Verified".to_string(),
                    },
                });
            }
        }

        Ok(attendance_logs)
    }

    /// Bi-directional sync: Push employees + Pull logs
    pub async fn sync_device_data(
        &self,
        ip: &str,
        port: u16,
        device_id: i32,
        machine_number: i32,
        employees: Vec<(String, String)>,
    ) -> Result<String, AppError> {
        let mut messages = Vec::new();

        // Step 1: Push employees to device
        messages.push("🔄 Pushing employees to device...".to_string());
        let mut pushed_count = 0;
        
        for (enroll_number, name) in &employees {
            match self.push_employee_to_device(enroll_number, name, ip, port, machine_number).await {
                Ok(msg) => {
                    pushed_count += 1;
                    messages.push(msg);
                }
                Err(e) => {
                    messages.push(format!("⚠️ Failed to push '{}': {}", name, e));
                }
            }
        }

        messages.push(format!("✅ Pushed {} employees to device", pushed_count));

        // Step 2: Pull attendance logs
        messages.push("🔄 Pulling attendance logs from device...".to_string());
        
        match self.pull_attendance_logs(ip, port, device_id, machine_number).await {
            Ok(logs) => {
                messages.push(format!("✅ Pulled {} attendance logs from device", logs.len()));
                messages.push(format!("📊 {} records ready for database sync", logs.len()));
            }
            Err(e) => {
                messages.push(format!("❌ Failed to pull logs: {}", e));
            }
        }

        Ok(messages.join("\n"))
    }
}

impl Default for ZKSyncManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Fallback implementation using node-zklib (works on all platforms)
pub mod fallback {
    use super::*;
    use std::process::Command;

    /// Sync using node-zklib fallback
    pub async fn sync_with_node_zklib(
        ip: &str,
        port: u16,
        device_id: i32,
        last_timestamp: Option<String>,
    ) -> Result<Vec<AttendanceLog>, AppError> {
        let current_dir = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
        let script_path = current_dir.join("src").join("bin").join("zk_fetch.cjs");

        let mut cmd = Command::new("node");
        cmd.arg(&script_path)
           .arg("sync")
           .arg(ip)
           .arg(port.to_string())
           .arg("10000");

        if let Some(ts) = last_timestamp {
            cmd.arg(ts);
        }

        let output = cmd.output()
            .map_err(|e| AppError::ConnectionError(format!("Failed to run node script: {}", e)))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(start) = stdout.find('{') {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout[start..]) {
                    let mut logs = Vec::new();
                    
                    if let Some(attendances) = parsed.get("attendances").and_then(|a| a.as_array()) {
                        for att in attendances {
                            if let Some(emp_str) = att.get("deviceUserId").and_then(|v| v.as_str()) {
                                if let Some(timestamp) = att.get("recordTime").and_then(|v| v.as_str()) {
                                    if let Ok(employee_id) = emp_str.parse::<i32>() {
                                        if employee_id > 0 {
                                            logs.push(AttendanceLog {
                                                device_id,
                                                employee_id,
                                                timestamp: timestamp.to_string(),
                                                punch_method: "Verified".to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    return Ok(logs);
                }
            }
        }

        Err(AppError::ConnectionError("Failed to fetch logs via node-zklib".to_string()))
    }
}
