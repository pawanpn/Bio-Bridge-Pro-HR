use std::process::Command;
use sha2::{Sha256, Digest};
use hex;

pub fn get_hardware_fingerprint() -> String {
    let uuid = get_command_output("powershell -Command \"(Get-CimInstance Win32_ComputerSystemProduct).UUID\"");
    let serial = get_command_output("powershell -Command \"(Get-CimInstance Win32_BaseBoard).SerialNumber\"");
    
    let combined = format!("{}{}", uuid.trim(), serial.trim());
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let result = hasher.finalize();
    
    hex::encode(result)
}

fn get_command_output(cmd: &str) -> String {
    let output = if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args(["-Command", &cmd.replace("powershell -Command ", "").replace("\"", "")])
            .output()
    } else {
        Command::new("sh")
            .arg("-c")
            .arg(cmd)
            .output()
    };

    match output {
        Ok(o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => "UNKNOWN_HW".to_string(),
    }
}
