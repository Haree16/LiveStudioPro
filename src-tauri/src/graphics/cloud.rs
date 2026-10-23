use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloudGraphicControlPayload {
    pub subkey: String, // e.g. "Headline", "Subtitle", "HomeScore"
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CloudGraphicAppConfig {
    pub app_id: String,
    pub name: String,
    pub provider: String, // "SingularLive", "UnoOverlays", "CustomWebhook"
    pub app_token: String,
    pub control_url: String,
    pub active_overlay_channel: u8,
    pub enabled: bool,
}

pub struct CloudGraphicsBridge;

impl CloudGraphicsBridge {
    /// Formats a payload for Singular.live / Uno REST control endpoint
    pub fn format_singular_payload(subkeys: &[CloudGraphicControlPayload]) -> HashMap<String, String> {
        let mut map = HashMap::new();
        for item in subkeys {
            map.insert(item.subkey.clone(), item.value.clone());
        }
        map
    }

    /// Validates cloud app authorization token and endpoint structure
    pub fn validate_app_config(config: &CloudGraphicAppConfig) -> Result<(), String> {
        if config.app_token.trim().is_empty() {
            return Err("Cloud graphics application token cannot be empty".into());
        }
        if !config.control_url.starts_with("http://") && !config.control_url.starts_with("https://") {
            return Err("Control URL must be a valid HTTP or HTTPS endpoint".into());
        }
        if config.active_overlay_channel == 0 || config.active_overlay_channel > 8 {
            return Err("Overlay channel must be between 1 and 8".into());
        }
        Ok(())
    }
}
