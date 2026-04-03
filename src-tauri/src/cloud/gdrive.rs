use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use std::time::{SystemTime, UNIX_EPOCH};
use crate::errors::AppError;

// ── JWT Claims ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct GoogleClaims {
    iss: String,
    scope: String,
    aud: String,
    exp: u64,
    iat: u64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
}

// ── Service Account Key Structure ──────────────────────────────────────────

#[derive(Deserialize, Clone, Serialize)]
pub struct ServiceAccountKey {
    pub client_email: String,
    pub private_key: String,
    pub project_id: String,
}

// ── Normalized Log Format ──────────────────────────────────────────────────

#[derive(Serialize)]
pub struct NormalizedLog {
    pub log_id: String,
    pub device_id: i32,
    pub employee_id: i32,
    pub timestamp_utc: String,
    pub branch: String,
    pub organization: String,
}

// ── Token Generation ───────────────────────────────────────────────────────

pub async fn generate_bearer_token(key: &ServiceAccountKey) -> Result<String, AppError> {
    let iat = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let claims = GoogleClaims {
        iss: key.client_email.clone(),
        scope: "https://www.googleapis.com/auth/drive".to_string(),
        aud: "https://oauth2.googleapis.com/token".to_string(),
        exp: iat + 3600,
        iat,
    };

    let mut header = Header::new(Algorithm::RS256);
    header.typ = Some("JWT".to_string());

    let encoding_key = EncodingKey::from_rsa_pem(key.private_key.as_bytes())
        .map_err(|e| AppError::AuthError(format!("Invalid RSA key: {}", e)))?;

    let jwt = encode(&header, &claims, &encoding_key)
        .map_err(|e| AppError::AuthError(format!("JWT signing failed: {}", e)))?;

    let client = Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ])
        .send()
        .await?
        .json::<TokenResponse>()
        .await
        .map_err(|e| AppError::AuthError(format!("Token exchange failed: {}", e)))?;

    Ok(resp.access_token)
}

// ── Folder Helpers ─────────────────────────────────────────────────────────

async fn find_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent_id: &str,
) -> Result<Option<String>, AppError> {
    let q = format!(
        "mimeType='application/vnd.google-apps.folder' and name='{}' and '{}' in parents and trashed=false",
        name, parent_id
    );

    let resp = client
        .get("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .query(&[("q", q.as_str()), ("fields", "files(id,name)")])
        .send()
        .await?;

    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(AppError::PermissionDenied(format!("Access denied to folder ID: {}", parent_id)));
    }

    let json = resp.json::<Value>().await
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    Ok(json["files"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|f| f["id"].as_str())
        .map(|s| s.to_string()))
}

async fn ensure_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent_id: &str,
) -> Result<String, AppError> {
    if let Some(id) = find_folder(client, token, name, parent_id).await? {
        return Ok(id);
    }

    let metadata = json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id]
    });

    let resp = client
        .post("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .json(&metadata)
        .send()
        .await?;

    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(AppError::PermissionDenied(format!("Cannot create folder '{}' in parent ID: {}", name, parent_id)));
    }

    let json = resp.json::<Value>().await
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    json["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Unknown("Folder creation returned no ID".to_string()))
}

// ── Access Verification ───────────────────────────────────────────────────

/// Verifies that the service account has "Editor" (write) access to the root folder.
pub async fn verify_access(client: &Client, token: &str, root_id: &str) -> Result<(), AppError> {
    let resp = client
        .get(format!("https://www.googleapis.com/drive/v3/files/{}", root_id))
        .bearer_auth(token)
        .query(&[("fields", "capabilities(canEdit)")])
        .send()
        .await?;

    if resp.status() == reqwest::StatusCode::FORBIDDEN || resp.status() == reqwest::StatusCode::NOT_FOUND {
        return Err(AppError::PermissionDenied(root_id.to_string()));
    }

    let json = resp.json::<Value>().await
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    let can_edit = json["capabilities"]["canEdit"].as_bool().unwrap_or(false);
    if !can_edit {
        return Err(AppError::PermissionDenied(root_id.to_string()));
    }

    Ok(())
}

// ── Main Sync ──────────────────────────────────────────────────────────────

pub async fn sync_logs_to_drive(
    key: &ServiceAccountKey,
    root_id: &str,
    org: &str,
    branch: &str,
    year: &str,
    month: &str,
    logs: &[NormalizedLog],
) -> Result<(), AppError> {
    let token  = generate_bearer_token(key).await?;
    let client = Client::new();

    // 1. Verify Access to Root
    verify_access(&client, &token, root_id).await?;

    // 2. Build folder hierarchy: Root -> [Org] -> [Branch] -> [Year] -> [Month]
    let org_id    = ensure_folder(&client, &token, org,    root_id).await?;
    let branch_id = ensure_folder(&client, &token, branch, &org_id).await?;
    let year_id   = ensure_folder(&client, &token, year,   &branch_id).await?;
    let month_id  = ensure_folder(&client, &token, month,  &year_id).await?;

    // 3. Serialize logs
    let content = serde_json::to_string_pretty(logs)
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    // 4. Upload attendance_logs.json
    let file_metadata = json!({
        "name":    "attendance_logs.json",
        "parents": [month_id],
        "mimeType": "application/json"
    });

    let form = reqwest::multipart::Form::new()
        .part("metadata", reqwest::multipart::Part::text(file_metadata.to_string())
            .mime_str("application/json").unwrap())
        .part("media", reqwest::multipart::Part::text(content)
            .mime_str("application/json").unwrap());

    let resp = client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .await?;

    if resp.status() == reqwest::StatusCode::FORBIDDEN {
        return Err(AppError::PermissionDenied(format!("Cannot upload file to folder ID: {}", month_id)));
    }

    println!("Drive sync complete: Root({})/{}/{}/{}/{}/attendance_logs.json", root_id, org, branch, year, month);
    Ok(())
}
