use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ControlSurfaceButton {
    pub button_id: String,
    pub title: String,
    pub target_action_id: Option<String>,
    pub target_macro_id: Option<String>,
    pub default_color: String,
    pub active_color: String,
    pub feedback_type: String, // "program_tally", "preview_tally", "streaming", "recording", "mute"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ControlSurfaceProfile {
    pub id: String,
    pub name: String,
    pub surface_type: String, // "stream_deck", "stream_deck_xl", "companion", "generic"
    pub buttons: Vec<ControlSurfaceButton>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurfaceStateFeedback {
    pub button_id: String,
    pub is_active: bool,
    pub display_text: String,
    pub background_hex: String,
}

#[derive(Clone)]
pub struct ControlSurfaceBridge {
    profiles: Arc<RwLock<HashMap<String, ControlSurfaceProfile>>>,
}

impl ControlSurfaceBridge {
    pub fn new() -> Self {
        let mut bridge = Self {
            profiles: Arc::new(RwLock::new(HashMap::new())),
        };
        bridge.load_default_profile();
        bridge
    }

    fn load_default_profile(&mut self) {
        let default_profile = ControlSurfaceProfile {
            id: "profile-stream-deck".into(),
            name: "Default Stream Deck 15-Key".into(),
            surface_type: "stream_deck".into(),
            buttons: vec![
                ControlSurfaceButton {
                    button_id: "btn-1".into(),
                    title: "CAM 1".into(),
                    target_action_id: Some("switcher.setPreview".into()),
                    target_macro_id: None,
                    default_color: "#1e293b".into(),
                    active_color: "#16a34a".into(),
                    feedback_type: "preview_tally".into(),
                },
                ControlSurfaceButton {
                    button_id: "btn-2".into(),
                    title: "CAM 2".into(),
                    target_action_id: Some("switcher.setPreview".into()),
                    target_macro_id: None,
                    default_color: "#1e293b".into(),
                    active_color: "#16a34a".into(),
                    feedback_type: "preview_tally".into(),
                },
                ControlSurfaceButton {
                    button_id: "btn-5".into(),
                    title: "CUT".into(),
                    target_action_id: Some("switcher.cut".into()),
                    target_macro_id: None,
                    default_color: "#b91c1c".into(),
                    active_color: "#dc2626".into(),
                    feedback_type: "program_tally".into(),
                },
                ControlSurfaceButton {
                    button_id: "btn-6".into(),
                    title: "AUTO".into(),
                    target_action_id: Some("switcher.auto".into()),
                    target_macro_id: None,
                    default_color: "#0369a1".into(),
                    active_color: "#0284c7".into(),
                    feedback_type: "none".into(),
                },
                ControlSurfaceButton {
                    button_id: "btn-10".into(),
                    title: "REC".into(),
                    target_action_id: Some("output.startRecording".into()),
                    target_macro_id: None,
                    default_color: "#1e293b".into(),
                    active_color: "#ef4444".into(),
                    feedback_type: "recording".into(),
                },
            ],
        };

        self.profiles
            .write()
            .insert(default_profile.id.clone(), default_profile);
    }

    pub fn set_profiles(&self, list: Vec<ControlSurfaceProfile>) {
        let mut map = self.profiles.write();
        map.clear();
        for p in list {
            map.insert(p.id.clone(), p);
        }
    }

    pub fn list_profiles(&self) -> Vec<ControlSurfaceProfile> {
        self.profiles.read().values().cloned().collect()
    }

    /// Evaluates button visual states given current production state
    pub fn generate_feedback(
        &self,
        profile_id: &str,
        program_id: Option<&str>,
        preview_id: Option<&str>,
        is_streaming: bool,
        is_recording: bool,
    ) -> Vec<SurfaceStateFeedback> {
        let profiles = self.profiles.read();
        let profile = match profiles.get(profile_id) {
            Some(p) => p,
            None => return Vec::new(),
        };

        profile
            .buttons
            .iter()
            .map(|btn| {
                let is_active = match btn.feedback_type.as_str() {
                    "program_tally" => program_id.map_or(false, |p| p.contains(&btn.title)),
                    "preview_tally" => preview_id.map_or(false, |p| p.contains(&btn.title)),
                    "streaming" => is_streaming,
                    "recording" => is_recording,
                    _ => false,
                };

                let bg = if is_active {
                    btn.active_color.clone()
                } else {
                    btn.default_color.clone()
                };

                SurfaceStateFeedback {
                    button_id: btn.button_id.clone(),
                    is_active,
                    display_text: btn.title.clone(),
                    background_hex: bg,
                }
            })
            .collect()
    }
}
