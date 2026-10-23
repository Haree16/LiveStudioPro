use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GuestState {
    Pending,
    Connected,
    Disconnected,
    Expired,
    Revoked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuestInvitation {
    pub id: String,
    pub guest_name: String,
    pub role: String,
    pub token: String,
    pub token_hash: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub state: GuestState,
    pub assigned_input_id: Option<String>,
    pub audio_return: bool,
    pub video_return: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GuestConnectionStats {
    pub guest_id: String,
    pub round_trip_time_ms: f32,
    pub packet_loss_percent: f32,
    pub jitter_ms: f32,
    pub video_bitrate_kbps: u32,
    pub audio_bitrate_kbps: u32,
    pub resolution: String,
    pub fps: u32,
    pub ice_state: String,
}

impl Default for GuestConnectionStats {
    fn default() -> Self {
        Self {
            guest_id: String::new(),
            round_trip_time_ms: 0.0,
            packet_loss_percent: 0.0,
            jitter_ms: 0.0,
            video_bitrate_kbps: 0,
            audio_bitrate_kbps: 0,
            resolution: "1280x720".into(),
            fps: 30,
            ice_state: "new".into(),
        }
    }
}

pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[derive(Clone)]
pub struct GuestManager {
    invitations: Arc<RwLock<HashMap<String, GuestInvitation>>>,
    stats: Arc<RwLock<HashMap<String, GuestConnectionStats>>>,
    max_guests: Arc<RwLock<u32>>,
}

impl GuestManager {
    pub fn new(max_guests: u32) -> Self {
        Self {
            invitations: Arc::new(RwLock::new(HashMap::new())),
            stats: Arc::new(RwLock::new(HashMap::new())),
            max_guests: Arc::new(RwLock::new(max_guests)),
        }
    }

    pub fn set_max_guests(&self, max: u32) {
        *self.max_guests.write() = max;
    }

    pub fn get_max_guests(&self) -> u32 {
        *self.max_guests.read()
    }

    pub fn create_invitation(
        &self,
        guest_name: String,
        role: String,
        duration_minutes: i64,
        assigned_input_id: Option<String>,
        audio_return: bool,
        video_return: bool,
    ) -> Result<GuestInvitation, LiveStudioError> {
        let current_active = self
            .invitations
            .read()
            .values()
            .filter(|i| i.state == GuestState::Connected || i.state == GuestState::Pending)
            .count();

        if current_active >= *self.max_guests.read() as usize {
            return Err(LiveStudioError::validation(
                format!(
                    "Maximum guest capacity ({}) reached. Cannot create new invitation.",
                    *self.max_guests.read()
                ),
                Some("maxGuests"),
            ));
        }

        let token = Uuid::new_v4().to_string();
        let token_hash = hash_token(&token);
        let now = Utc::now();
        let expires_at = now + Duration::minutes(duration_minutes.max(5));
        let id = Uuid::new_v4().to_string();

        let invitation = GuestInvitation {
            id: id.clone(),
            guest_name,
            role,
            token,
            token_hash,
            created_at: now,
            expires_at,
            state: GuestState::Pending,
            assigned_input_id,
            audio_return,
            video_return,
        };

        self.invitations.write().insert(id.clone(), invitation.clone());
        Ok(invitation)
    }

    pub fn list_invitations(&self) -> Vec<GuestInvitation> {
        let now = Utc::now();
        let mut list: Vec<GuestInvitation> = self
            .invitations
            .read()
            .values()
            .map(|inv| {
                let mut item = inv.clone();
                if item.state == GuestState::Pending && now > item.expires_at {
                    item.state = GuestState::Expired;
                }
                item
            })
            .collect();
        list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        list
    }

    pub fn get_by_token(&self, token: &str) -> Option<GuestInvitation> {
        let hash = hash_token(token);
        let now = Utc::now();
        let mut map = self.invitations.write();
        for inv in map.values_mut() {
            if inv.token_hash == hash || inv.token == token {
                if inv.state == GuestState::Pending && now > inv.expires_at {
                    inv.state = GuestState::Expired;
                }
                return Some(inv.clone());
            }
        }
        None
    }

    pub fn verify_token_and_connect(&self, token: &str) -> Result<GuestInvitation, LiveStudioError> {
        let hash = hash_token(token);
        let now = Utc::now();
        let mut map = self.invitations.write();
        for inv in map.values_mut() {
            if inv.token_hash == hash || inv.token == token {
                if inv.state == GuestState::Revoked {
                    return Err(LiveStudioError::validation("Invitation has been revoked", Some("token")));
                }
                if now > inv.expires_at {
                    inv.state = GuestState::Expired;
                    return Err(LiveStudioError::validation("Invitation has expired", Some("token")));
                }
                inv.state = GuestState::Connected;
                return Ok(inv.clone());
            }
        }
        Err(LiveStudioError::validation("Invalid guest invitation token", Some("token")))
    }

    pub fn disconnect_guest(&self, id: &str) {
        if let Some(inv) = self.invitations.write().get_mut(id) {
            if inv.state == GuestState::Connected {
                inv.state = GuestState::Disconnected;
            }
        }
    }

    pub fn revoke_invitation(&self, id: &str) -> Result<(), LiveStudioError> {
        let mut map = self.invitations.write();
        if let Some(inv) = map.get_mut(id) {
            inv.state = GuestState::Revoked;
            Ok(())
        } else {
            Err(LiveStudioError::validation("Invitation not found", Some("id")))
        }
    }

    pub fn remove_invitation(&self, id: &str) -> bool {
        self.invitations.write().remove(id).is_some()
    }

    pub fn update_stats(&self, guest_id: String, stats: GuestConnectionStats) {
        self.stats.write().insert(guest_id, stats);
    }

    pub fn get_stats(&self, guest_id: &str) -> Option<GuestConnectionStats> {
        self.stats.read().get(guest_id).cloned()
    }

    pub fn get_all_stats(&self) -> Vec<GuestConnectionStats> {
        self.stats.read().values().cloned().collect()
    }
}
