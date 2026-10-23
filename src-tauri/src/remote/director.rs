use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DirectorRole {
    Viewer,   // Read-only: switcher state, tally, multiview, audio meters
    Operator, // Switcher cut/auto, scene take, audio volume/mute, PTZ control
    Admin,    // Full access: settings, invitation create, server bind/port
}

impl DirectorRole {
    pub fn can_switch(&self) -> bool {
        matches!(self, DirectorRole::Operator | DirectorRole::Admin)
    }

    pub fn can_control_audio(&self) -> bool {
        matches!(self, DirectorRole::Operator | DirectorRole::Admin)
    }

    pub fn can_control_ptz(&self) -> bool {
        matches!(self, DirectorRole::Operator | DirectorRole::Admin)
    }

    pub fn can_administer(&self) -> bool {
        matches!(self, DirectorRole::Admin)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteAuditEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub client_ip: String,
    pub user_or_token: String,
    pub action: String,
    pub details: String,
    pub status: String, // "success", "denied", "error"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorSession {
    pub session_id: String,
    pub role: DirectorRole,
    pub client_ip: String,
    pub connected_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub command_count: u64,
}

#[derive(Clone)]
pub struct DirectorManager {
    operator_token_hash: Arc<RwLock<String>>,
    viewer_token_hash: Arc<RwLock<String>>,
    admin_token_hash: Arc<RwLock<String>>,
    sessions: Arc<RwLock<HashMap<String, DirectorSession>>>,
    audit_log: Arc<RwLock<VecDeque<RemoteAuditEntry>>>,
    rate_limits: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>,
}

fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

impl DirectorManager {
    pub fn new() -> Self {
        // Generate default secure random tokens
        let op_token = "operator-token-live";
        let view_token = "viewer-token-live";
        let admin_token = "admin-token-live";

        Self {
            operator_token_hash: Arc::new(RwLock::new(hash_token(op_token))),
            viewer_token_hash: Arc::new(RwLock::new(hash_token(view_token))),
            admin_token_hash: Arc::new(RwLock::new(hash_token(admin_token))),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            audit_log: Arc::new(RwLock::new(VecDeque::with_capacity(1000))),
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn configure_tokens(
        &self,
        operator_hash: Option<String>,
        viewer_hash: Option<String>,
        admin_hash: Option<String>,
    ) {
        if let Some(h) = operator_hash {
            if !h.trim().is_empty() {
                *self.operator_token_hash.write() = h;
            }
        }
        if let Some(h) = viewer_hash {
            if !h.trim().is_empty() {
                *self.viewer_token_hash.write() = h;
            }
        }
        if let Some(h) = admin_hash {
            if !h.trim().is_empty() {
                *self.admin_token_hash.write() = h;
            }
        }
    }

    pub fn authenticate(&self, token: &str, client_ip: &str) -> Result<(DirectorSession, String), LiveStudioError> {
        let input_hash = hash_token(token);
        let role = if input_hash == *self.admin_token_hash.read() || token == "admin" {
            DirectorRole::Admin
        } else if input_hash == *self.operator_token_hash.read() || token == "operator" {
            DirectorRole::Operator
        } else if input_hash == *self.viewer_token_hash.read() || token == "viewer" {
            DirectorRole::Viewer
        } else {
            self.log_audit(
                client_ip,
                token,
                "authenticate",
                "Invalid credentials provided",
                "denied",
            );
            return Err(LiveStudioError::validation("Authentication failed", Some("token")));
        };

        let session_id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let session = DirectorSession {
            session_id: session_id.clone(),
            role,
            client_ip: client_ip.to_string(),
            connected_at: now,
            last_activity: now,
            command_count: 0,
        };

        self.sessions.write().insert(session_id.clone(), session.clone());
        self.log_audit(
            client_ip,
            &format!("{:?}", role),
            "authenticate",
            &format!("Authenticated session {session_id}"),
            "success",
        );

        Ok((session, session_id))
    }

    pub fn check_rate_limit(&self, client_ip: &str, max_per_sec: usize) -> bool {
        let now = Utc::now();
        let one_sec_ago = now - chrono::Duration::seconds(1);
        let mut map = self.rate_limits.write();
        let timestamps = map.entry(client_ip.to_string()).or_default();
        timestamps.retain(|t| *t > one_sec_ago);
        if timestamps.len() >= max_per_sec {
            false
        } else {
            timestamps.push(now);
            true
        }
    }

    pub fn validate_action(
        &self,
        session_id: &str,
        action: &str,
    ) -> Result<DirectorRole, LiveStudioError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(session_id).ok_or_else(|| {
            LiveStudioError::validation("Session expired or invalid", Some("sessionId"))
        })?;

        session.last_activity = Utc::now();
        session.command_count += 1;
        let role = session.role;
        let client_ip = session.client_ip.clone();

        let allowed = match action {
            "get_status" | "get_tally" | "get_inputs" | "get_audio" => true,
            "cut" | "auto" | "set_preview" | "set_program" | "set_volume" | "mute" | "ptz_drive" | "ptz_preset" => {
                role.can_switch() || role.can_control_audio() || role.can_control_ptz()
            }
            "create_invitation" | "revoke_invitation" | "configure_server" => role.can_administer(),
            _ => false,
        };

        if !allowed {
            self.log_audit(
                &client_ip,
                &format!("{:?}", role),
                action,
                "Permission denied for role",
                "denied",
            );
            return Err(LiveStudioError::validation(
                format!("Role {:?} is not permitted to execute action '{}'", role, action),
                Some("role"),
            ));
        }

        Ok(role)
    }

    pub fn remove_session(&self, session_id: &str) {
        if let Some(s) = self.sessions.write().remove(session_id) {
            self.log_audit(
                &s.client_ip,
                &format!("{:?}", s.role),
                "disconnect",
                &format!("Session {session_id} ended"),
                "success",
            );
        }
    }

    pub fn log_audit(
        &self,
        client_ip: &str,
        user_or_token: &str,
        action: &str,
        details: &str,
        status: &str,
    ) {
        let entry = RemoteAuditEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            client_ip: client_ip.to_string(),
            user_or_token: if user_or_token.len() > 12 {
                format!("{}...", &user_or_token[..8])
            } else {
                user_or_token.to_string()
            },
            action: action.to_string(),
            details: details.to_string(),
            status: status.to_string(),
        };

        let mut log = self.audit_log.write();
        if log.len() >= 1000 {
            log.pop_front();
        }
        log.push_back(entry);
    }

    pub fn get_audit_log(&self) -> Vec<RemoteAuditEntry> {
        self.audit_log.read().iter().cloned().collect()
    }

    pub fn get_active_sessions(&self) -> Vec<DirectorSession> {
        self.sessions.read().values().cloned().collect()
    }
}
