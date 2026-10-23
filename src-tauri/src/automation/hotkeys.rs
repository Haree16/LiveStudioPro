use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyMapping {
    pub id: String,
    pub key_combination: String, // e.g. "Control+Shift+1" or "F1" or "Space"
    pub target_action_id: Option<String>,
    pub target_macro_id: Option<String>,
    pub description: String,
    pub enabled: bool,
    pub is_global: bool,
}

#[derive(Clone)]
pub struct HotkeyManager {
    mappings: Arc<RwLock<HashMap<String, HotkeyMapping>>>,
}

impl HotkeyManager {
    pub fn new() -> Self {
        let mut mgr = Self {
            mappings: Arc::new(RwLock::new(HashMap::new())),
        };
        mgr.load_default_hotkeys();
        mgr
    }

    fn load_default_hotkeys(&mut self) {
        let defaults = vec![
            HotkeyMapping {
                id: "hk-cut".into(),
                key_combination: "Space".into(),
                target_action_id: Some("switcher.cut".into()),
                target_macro_id: None,
                description: "Cut Preview to Program".into(),
                enabled: true,
                is_global: false,
            },
            HotkeyMapping {
                id: "hk-auto".into(),
                key_combination: "Enter".into(),
                target_action_id: Some("switcher.auto".into()),
                target_macro_id: None,
                description: "Execute Auto Transition".into(),
                enabled: true,
                is_global: false,
            },
            HotkeyMapping {
                id: "hk-replay".into(),
                key_combination: "F10".into(),
                target_action_id: Some("replay.markQuickClip".into()),
                target_macro_id: None,
                description: "Quick Replay Mark".into(),
                enabled: true,
                is_global: false,
            },
        ];

        let mut map = self.mappings.write();
        for hk in defaults {
            map.insert(hk.id.clone(), hk);
        }
    }

    pub fn set_mappings(&self, list: Vec<HotkeyMapping>) -> Result<(), LiveStudioError> {
        self.detect_conflicts(&list)?;
        let mut map = self.mappings.write();
        map.clear();
        for hk in list {
            map.insert(hk.id.clone(), hk);
        }
        Ok(())
    }

    pub fn list_mappings(&self) -> Vec<HotkeyMapping> {
        self.mappings.read().values().cloned().collect()
    }

    pub fn detect_conflicts(&self, list: &[HotkeyMapping]) -> Result<(), LiveStudioError> {
        let mut seen = HashMap::new();
        for hk in list {
            if !hk.enabled {
                continue;
            }
            let key = hk.key_combination.to_lowercase().replace(" ", "");
            if let Some(existing_desc) = seen.insert(key.clone(), &hk.description) {
                return Err(LiveStudioError::validation(
                    format!(
                        "Hotkey collision detected on '{}': '{}' conflicts with '{}'",
                        hk.key_combination, hk.description, existing_desc
                    ),
                    Some("keyCombination"),
                ));
            }
        }
        Ok(())
    }

    pub fn resolve_key(&self, combo: &str) -> Option<HotkeyMapping> {
        let clean = combo.to_lowercase().replace(" ", "");
        let map = self.mappings.read();
        for hk in map.values() {
            if hk.enabled && hk.key_combination.to_lowercase().replace(" ", "") == clean {
                return Some(hk.clone());
            }
        }
        None
    }
}
