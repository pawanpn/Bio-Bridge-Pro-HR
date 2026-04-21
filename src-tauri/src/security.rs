use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::RngCore;
use sha2::{Digest, Sha256};

const ENCRYPTION_KEY: &[u8] = b"BioBridgeProERP2026SecureKey32ch"; // Exactly 32 bytes

/// Encrypt sensitive data before storing
pub fn encrypt_data(plaintext: &str) -> Result<String, String> {
    if plaintext.is_empty() {
        return Ok(String::new());
    }

    let key = Key::<Aes256Gcm>::from_slice(ENCRYPTION_KEY);
    let cipher = Aes256Gcm::new(key);

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce and ciphertext, then encode
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(&combined))
}

/// Decrypt sensitive data after retrieval
pub fn decrypt_data(encrypted: &str) -> Result<String, String> {
    if encrypted.is_empty() {
        return Ok(String::new());
    }

    let key = Key::<Aes256Gcm>::from_slice(ENCRYPTION_KEY);
    let cipher = Aes256Gcm::new(key);

    let combined = general_purpose::STANDARD
        .decode(encrypted)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 13 {
        return Err("Invalid encrypted data".to_string());
    }

    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
}

/// Hash password for secure storage
#[allow(dead_code)]
pub fn _hash_password(password: &str) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

/// Verify password against hash
#[allow(dead_code)]
pub fn _verify_password(password: &str, hash: &str) -> bool {
    if let Ok(computed_hash) = _hash_password(password) {
        computed_hash == hash
    } else {
        false
    }
}

/// Sanitize input to prevent SQL injection
pub fn sanitize_input(input: &str) -> String {
    input
        .replace("'", "''")
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .trim()
        .to_string()
}

/// Validate email format
pub fn validate_email(email: &str) -> bool {
    let email_regex =
        regex::Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    email_regex.is_match(email)
}

/// Validate date format
pub fn validate_date(date: &str) -> bool {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let original = "Sensitive Data 123";
        let encrypted = encrypt_data(original).unwrap();
        let decrypted = decrypt_data(&encrypted).unwrap();
        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_password_hash() {
        let password = "SecurePass123!";
        let hash = _hash_password(password).unwrap();
        assert!(_verify_password(password, &hash));
        assert!(!_verify_password("WrongPass", &hash));
    }
}
