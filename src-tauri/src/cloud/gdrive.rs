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

// ── Service Account Key Structure (matches GCP JSON format) ───────────────

#[derive(Deserialize, Clone, Serialize)]
pub struct ServiceAccountKey {
    pub client_email: String,
    pub private_key: String,
    pub project_id: String,
}

// ── Normalized Log Format (brand-agnostic) ─────────────────────────────────

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

/// Generates an OAuth2 Bearer token from a Service Account private key (RS256 JWT).
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

    // Exchange JWT for Bearer token
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

/// Find a folder by name under a parent ID. Returns the folder ID if found.
async fn find_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent_id: Option<&str>,
) -> Result<Option<String>, AppError> {
    let parent_clause = parent_id
        .map(|p| format!(" and '{}' in parents", p))
        .unwrap_or_default();

    let q = format!(
        "mimeType='application/vnd.google-apps.folder' and name='{}' and trashed=false{}",
        name, parent_clause
    );

    let resp = client
        .get("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .query(&[("q", q.as_str()), ("fields", "files(id,name)")])
        .send()
        .await?
        .json::<Value>()
        .await
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    Ok(resp["files"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|f| f["id"].as_str())
        .map(|s| s.to_string()))
}

/// Find or create a folder under parent_id. Returns the folder ID.
async fn ensure_folder(
    client: &Client,
    token: &str,
    name: &str,
    parent_id: Option<&str>,
) -> Result<String, AppError> {
    if let Some(id) = find_folder(client, token, name, parent_id).await? {
        return Ok(id);
    }

    // Create folder
    let mut metadata = json!({
        "name": name,
        "mimeType": "application/vnd.google-apps.folder"
    });
    if let Some(p) = parent_id {
        metadata["parents"] = json!([p]);
    }

    let resp = client
        .post("https://www.googleapis.com/drive/v3/files")
        .bearer_auth(token)
        .json(&metadata)
        .send()
        .await?
        .json::<Value>()
        .await
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    resp["id"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Unknown("Folder creation returned no ID".to_string()))
}

// ── Main Sync ──────────────────────────────────────────────────────────────

/// Full dynamic Drive sync.
///
/// Path: Bio Bridge Pro HR → [Org] → [Branch] → [Year] → [Month] → logs.json
///
/// - Searches for each folder level, creates if missing.
/// - Uploads a brand-agnostic normalized JSON payload.
/// - Uses the Service Account key stored dynamically by the Admin.
pub async fn sync_logs_to_drive(
    key: &ServiceAccountKey,
    org: &str,
    branch: &str,
    year: i32,
    month: u32,
    logs: &[NormalizedLog],
) -> Result<(), AppError> {
    let token  = generate_bearer_token(key).await?;
    let client = Client::new();

    // Build folder hierarchy
    let root_id   = ensure_folder(&client, &token, "Bio Bridge Pro HR", None).await?;
    let org_id    = ensure_folder(&client, &token, org,                  Some(&root_id)).await?;
    let branch_id = ensure_folder(&client, &token, branch,               Some(&org_id)).await?;
    let year_id   = ensure_folder(&client, &token, &year.to_string(),    Some(&branch_id)).await?;
    let month_id  = ensure_folder(&client, &token, &month.to_string(),   Some(&year_id)).await?;

    // Serialize normalized logs
    let content = serde_json::to_string_pretty(logs)
        .map_err(|e| AppError::SerializationError(e.to_string()))?;

    // Upload logs.json (multipart: metadata + media)
    let file_metadata = json!({
        "name":    "logs.json",
        "parents": [month_id],
        "mimeType": "application/json"
    });

    let form = reqwest::multipart::Form::new()
        .part("metadata", reqwest::multipart::Part::text(file_metadata.to_string())
            .mime_str("application/json").unwrap())
        .part("media", reqwest::multipart::Part::text(content)
            .mime_str("application/json").unwrap());

    client
        .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
        .bearer_auth(&token)
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::ConnectionError(format!("Drive upload failed: {}", e)))?;

    println!("Drive sync complete: Bio Bridge Pro HR/{}/{}/{}/{}/logs.json", org, branch, year, month);
    Ok(())
}
