use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

/// Secure vault for sensitive output credentials like RTMP stream keys
pub struct CredentialVault {
    secrets: RwLock<HashMap<String, String>>,
    storage_path: Option<PathBuf>,
}

impl CredentialVault {
    pub fn new() -> Self {
        let storage_path = std::env::var("HOME")
            .ok()
            .map(|h| PathBuf::from(h).join(".local/share/LiveStudioPro/credentials.json"));

        let initial_map = storage_path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str::<HashMap<String, String>>(&s).ok())
            .unwrap_or_default();

        Self {
            secrets: RwLock::new(initial_map),
            storage_path,
        }
    }

    fn persist(&self) {
        if let Some(ref path) = self.storage_path {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Ok(json) = serde_json::to_string_pretty(&*self.secrets.read()) {
                let _ = std::fs::write(path, json);
            }
        }
    }

    /// Stores a secret stream key and returns an opaque reference key ID
    pub fn store_secret(&self, secret: &str) -> String {
        let key_ref = format!("sec-{}", Uuid::new_v4().simple());
        self.secrets.write().insert(key_ref.clone(), secret.to_string());
        self.persist();
        key_ref
    }

    /// Updates an existing secret reference or creates a new one
    pub fn set_secret(&self, key_ref: &str, secret: &str) {
        self.secrets.write().insert(key_ref.to_string(), secret.to_string());
        self.persist();
    }

    /// Retrieves the secret if it exists
    pub fn get_secret(&self, key_ref: &str) -> Option<String> {
        self.secrets.read().get(key_ref).cloned()
    }

    /// Removes a secret from storage
    pub fn remove_secret(&self, key_ref: &str) -> bool {
        let removed = self.secrets.write().remove(key_ref).is_some();
        if removed {
            self.persist();
        }
        removed
    }

    /// Returns a masked representation of the secret for UI display (e.g., "••••••••••••")
    pub fn get_masked(&self, key_ref: &str) -> String {
        if let Some(secret) = self.get_secret(key_ref) {
            if secret.is_empty() {
                String::new()
            } else {
                "•".repeat(secret.len().clamp(8, 16))
            }
        } else {
            String::new()
        }
    }

    /// Checks if a valid non-empty secret is configured for a reference
    pub fn has_secret(&self, key_ref: &str) -> bool {
        self.secrets
            .read()
            .get(key_ref)
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
    }
}

/// Redacts secrets and stream keys from URLs and connection strings.
/// RTMP URLs often follow the format: `rtmp://host/app/stream_key` or `rtmp://host/app?key=...`
pub fn redact_stream_url(url: &str) -> String {
    if url.is_empty() {
        return String::new();
    }

    // Handle query parameter stream key: ?key=xxx or ?token=xxx
    let mut sanitized = url.to_string();
    for query_param in &["key", "token", "stream_key", "password", "secret"] {
        let pattern = format!("{}=", query_param);
        if let Some(pos) = sanitized.find(&pattern) {
            let start = pos + pattern.len();
            let end = sanitized[start..].find('&').map(|idx| start + idx).unwrap_or(sanitized.len());
            let before = &sanitized[..start];
            let after = &sanitized[end..];
            sanitized = format!("{before}******{after}");
        }
    }

    // Handle path-based stream key: rtmp://.../live/<secret>
    if sanitized.starts_with("rtmp://") || sanitized.starts_with("rtmps://") {
        let scheme_offset = if sanitized.starts_with("rtmps://") { 8 } else { 7 };
        let after_scheme = &sanitized[scheme_offset..];
        let segments: Vec<&str> = after_scheme.split('/').collect();
        // If there are 3 segments: host/app/streamkey (e.g., a.rtmp.youtube.com/live2/xxxx)
        if segments.len() >= 3 {
            let scheme = &sanitized[..scheme_offset];
            let host_and_app = segments[..segments.len() - 1].join("/");
            return format!("{scheme}{host_and_app}/******");
        }
    }

    sanitized
}

/// Redacts sensitive stream keys from log messages or error details
pub fn redact_secret_from_message(message: &str, known_secret: Option<&str>) -> String {
    let mut result = message.to_string();
    if let Some(secret) = known_secret {
        if !secret.trim().is_empty() {
            result = result.replace(secret, "******");
        }
    }
    // Also catch any obvious RTMP paths
    redact_stream_url(&result)
}
