use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionCategory {
    Switcher,
    MediaPlayback,
    Graphics,
    Audio,
    Output,
    Ptz,
    Remote,
    Application,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ActionSafetyTier {
    ReadOnly,
    PreviewOnly,
    ProgramAffecting,
    OutputAffecting,
    Destructive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionDefinition {
    pub id: String,
    pub name: String,
    pub category: ActionCategory,
    pub safety_tier: ActionSafetyTier,
    pub description: String,
    pub parameters: Vec<ActionParameterSchema>,
    pub is_reversible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionParameterSchema {
    pub name: String,
    pub param_type: String, // "string", "number", "boolean", "select"
    pub required: bool,
    pub default_value: Option<Value>,
    pub description: String,
    pub options: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ActionInvocation {
    pub action_id: String,
    pub parameters: HashMap<String, Value>,
}

pub struct ActionRegistry {
    definitions: HashMap<String, ActionDefinition>,
}

impl ActionRegistry {
    pub fn new() -> Self {
        let mut reg = Self {
            definitions: HashMap::new(),
        };
        reg.register_builtin_actions();
        reg
    }

    fn register_builtin_actions(&mut self) {
        // Switcher Actions
        self.register(ActionDefinition {
            id: "switcher.cut".into(),
            name: "Cut Preview to Program".into(),
            category: ActionCategory::Switcher,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Instantly swaps Preview and Program sources".into(),
            parameters: vec![],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "switcher.auto".into(),
            name: "Auto Transition".into(),
            category: ActionCategory::Switcher,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Executes smooth transition between Preview and Program".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "durationMs".into(),
                    param_type: "number".into(),
                    required: false,
                    default_value: Some(serde_json::json!(500)),
                    description: "Transition duration in milliseconds".into(),
                    options: None,
                },
                ActionParameterSchema {
                    name: "transitionType".into(),
                    param_type: "select".into(),
                    required: false,
                    default_value: Some(serde_json::json!("fade")),
                    description: "Transition visual style".into(),
                    options: Some(vec!["cut".into(), "fade".into(), "wipe".into(), "slide".into()]),
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "switcher.setPreview".into(),
            name: "Set Preview Source".into(),
            category: ActionCategory::Switcher,
            safety_tier: ActionSafetyTier::PreviewOnly,
            description: "Cues an input to the Preview bus".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "inputId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "ID of the input to preview".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "switcher.setProgram".into(),
            name: "Set Program Source Directly (Direct Take)".into(),
            category: ActionCategory::Switcher,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Immediately cuts specified input directly to Program".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "inputId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "ID of the input to take live".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        // Media Playback Actions
        self.register(ActionDefinition {
            id: "playback.play".into(),
            name: "Play Media Input".into(),
            category: ActionCategory::MediaPlayback,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Starts playback of video or audio source".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "inputId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Media input ID".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "playback.pause".into(),
            name: "Pause Media Input".into(),
            category: ActionCategory::MediaPlayback,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Pauses active playback of media source".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "inputId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Media input ID".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "playlist.next".into(),
            name: "Advance Playlist to Next Item".into(),
            category: ActionCategory::MediaPlayback,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Advances specified playlist to its next sequential clip".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "playlistId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Target playlist ID".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "replay.markQuickClip".into(),
            name: "Mark Instant Replay Clip".into(),
            category: ActionCategory::MediaPlayback,
            safety_tier: ActionSafetyTier::ReadOnly,
            description: "Captures past buffer frames into a replay clip".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "durationSeconds".into(),
                    param_type: "number".into(),
                    required: false,
                    default_value: Some(serde_json::json!(10)),
                    description: "Duration of buffer to capture".into(),
                    options: None,
                },
                ActionParameterSchema {
                    name: "label".into(),
                    param_type: "string".into(),
                    required: false,
                    default_value: Some(serde_json::json!("Highlight")),
                    description: "Operator label".into(),
                    options: None,
                },
            ],
            is_reversible: false,
        });

        // Audio Actions
        self.register(ActionDefinition {
            id: "audio.setFader".into(),
            name: "Set Audio Fader Level".into(),
            category: ActionCategory::Audio,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Sets channel volume in decibels (-60dB to +12dB)".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "channelId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Channel ID or input ID".into(),
                    options: None,
                },
                ActionParameterSchema {
                    name: "faderDb".into(),
                    param_type: "number".into(),
                    required: true,
                    default_value: Some(serde_json::json!(0.0)),
                    description: "Volume level in dB".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "audio.setMute".into(),
            name: "Mute / Unmute Channel".into(),
            category: ActionCategory::Audio,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Toggles or sets mute state on an audio strip".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "channelId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Channel ID".into(),
                    options: None,
                },
                ActionParameterSchema {
                    name: "muted".into(),
                    param_type: "boolean".into(),
                    required: true,
                    default_value: Some(serde_json::json!(true)),
                    description: "True to mute, false to unmute".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        // Graphics Overlays
        self.register(ActionDefinition {
            id: "graphics.takeOnAir".into(),
            name: "Take Overlay On Air".into(),
            category: ActionCategory::Graphics,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Animates lower third, scoreboard, or bug overlay onto Program".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "channelIndex".into(),
                    param_type: "number".into(),
                    required: true,
                    default_value: Some(serde_json::json!(1)),
                    description: "Overlay channel index (1 to 4)".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "graphics.takeOffAir".into(),
            name: "Take Overlay Off Air".into(),
            category: ActionCategory::Graphics,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Animates overlay channel off Program".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "channelIndex".into(),
                    param_type: "number".into(),
                    required: true,
                    default_value: Some(serde_json::json!(1)),
                    description: "Overlay channel index (1 to 4)".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        // Output Streaming & Recording
        self.register(ActionDefinition {
            id: "output.startStream".into(),
            name: "Start Live Stream".into(),
            category: ActionCategory::Output,
            safety_tier: ActionSafetyTier::OutputAffecting,
            description: "Begins RTMP / SRT broadcast transmission".into(),
            parameters: vec![],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "output.stopStream".into(),
            name: "Stop Live Stream".into(),
            category: ActionCategory::Output,
            safety_tier: ActionSafetyTier::OutputAffecting,
            description: "Halts live broadcast stream".into(),
            parameters: vec![],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "output.startRecording".into(),
            name: "Start Master Recording".into(),
            category: ActionCategory::Output,
            safety_tier: ActionSafetyTier::OutputAffecting,
            description: "Begins recording Program to disk".into(),
            parameters: vec![],
            is_reversible: true,
        });

        self.register(ActionDefinition {
            id: "output.stopRecording".into(),
            name: "Stop Master Recording".into(),
            category: ActionCategory::Output,
            safety_tier: ActionSafetyTier::OutputAffecting,
            description: "Stops recording and finalizes MP4/MKV container".into(),
            parameters: vec![],
            is_reversible: true,
        });

        // PTZ Camera
        self.register(ActionDefinition {
            id: "ptz.recallPreset".into(),
            name: "Recall PTZ Preset".into(),
            category: ActionCategory::Ptz,
            safety_tier: ActionSafetyTier::ProgramAffecting,
            description: "Drives PTZ camera to stored pan/tilt/zoom preset".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "cameraId".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: None,
                    description: "Target PTZ Camera ID".into(),
                    options: None,
                },
                ActionParameterSchema {
                    name: "presetId".into(),
                    param_type: "number".into(),
                    required: true,
                    default_value: Some(serde_json::json!(1)),
                    description: "Preset number (1 to 8)".into(),
                    options: None,
                },
            ],
            is_reversible: true,
        });

        // Application
        self.register(ActionDefinition {
            id: "app.logMarker".into(),
            name: "Write Production Log Marker".into(),
            category: ActionCategory::Application,
            safety_tier: ActionSafetyTier::ReadOnly,
            description: "Writes an operator timestamp bookmark into production audit logs".into(),
            parameters: vec![
                ActionParameterSchema {
                    name: "message".into(),
                    param_type: "string".into(),
                    required: true,
                    default_value: Some(serde_json::json!("Operator Cue Marker")),
                    description: "Annotation message".into(),
                    options: None,
                },
            ],
            is_reversible: false,
        });
    }

    pub fn register(&mut self, def: ActionDefinition) {
        self.definitions.insert(def.id.clone(), def);
    }

    pub fn get(&self, action_id: &str) -> Option<&ActionDefinition> {
        self.definitions.get(action_id)
    }

    pub fn list(&self) -> Vec<ActionDefinition> {
        let mut list: Vec<ActionDefinition> = self.definitions.values().cloned().collect();
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    pub fn validate_invocation(&self, inv: &ActionInvocation) -> Result<(), LiveStudioError> {
        let def = self.get(&inv.action_id).ok_or_else(|| {
            LiveStudioError::validation(
                format!("Unknown action ID: '{}'", inv.action_id),
                Some("actionId"),
            )
        })?;

        for param in &def.parameters {
            if param.required && !inv.parameters.contains_key(&param.name) {
                return Err(LiveStudioError::validation(
                    format!(
                        "Action '{}' is missing required parameter '{}'",
                        def.id, param.name
                    ),
                    Some(&param.name),
                ));
            }
        }

        Ok(())
    }
}
