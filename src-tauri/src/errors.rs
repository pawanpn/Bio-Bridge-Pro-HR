use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database constraint failed: {0}")]
    DatabaseError(String),

    #[error("Hardware connection timeout after {0}s on attempt {1}")]
    TimeoutError(u64, u32),

    #[error("Hardware connection refused: {0}")]
    ConnectionError(String),

    #[error("Hardware sync failed after {0} retries: {1}")]
    RetryExhausted(u32, String),

    #[error("Cloud payload formatting error: {0}")]
    SerializationError(String),

    #[error("Cloud authentication failure: {0}")]
    AuthError(String),

    #[error("Driver not registered for brand: {0}")]
    UnknownDriver(String),

    #[error("Permission Denied: {0}")]
    PermissionDenied(String),

    #[error("Unmapped backend error: {0}")]
    Unknown(String),

    #[error("Licensing Error: {0}")]
    LicenseError(String),
}

// Serialize AppError as a plain string for Tauri IPC transport
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// Automatic From mappings to allow `?` bubbling
impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}
impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::SerializationError(err.to_string())
    }
}
impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::ConnectionError(err.to_string())
    }
}
