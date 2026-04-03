use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database constraint failed: {0}")]
    DatabaseError(String),
    
    #[error("Hardware connection timeout: {0}")]
    ConnectionError(String),
    
    #[error("Cloud Payload formatting error: {0}")]
    SerializationError(String),
    
    #[error("Cloud Authentication failure: {0}")]
    AuthError(String),

    #[error("Unmapped Backend Error: {0}")]
    Unknown(String)
}

// Ensure the Error handles can be wrapped directly back over Tauri channels mapping to IPC JSON
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

// From mappings allowing ? bubbles.
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
