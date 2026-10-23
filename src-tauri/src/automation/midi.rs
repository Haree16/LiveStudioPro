use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::info;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MidiMessageType {
    NoteOn,
    NoteOff,
    ControlChange,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MidiControlMode {
    ButtonPress,
    Toggle,
    ContinuousFader,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MidiMapping {
    pub id: String,
    pub name: String,
    pub device_name: Option<String>,
    pub channel: Option<u8>, // 0..15 or None for omni
    pub message_type: MidiMessageType,
    pub note_or_cc: u8, // 0..127
    pub control_mode: MidiControlMode,
    pub target_action_id: Option<String>,
    pub target_macro_id: Option<String>,
    pub min_value: f32, // e.g. -60.0 dB
    pub max_value: f32, // e.g. +6.0 dB
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiLearnedMessage {
    pub device_name: String,
    pub channel: u8,
    pub message_type: MidiMessageType,
    pub note_or_cc: u8,
    pub value: u8,
}

#[derive(Clone)]
pub struct MidiSubsystem {
    mappings: Arc<RwLock<HashMap<String, MidiMapping>>>,
    learning_mode: Arc<AtomicBool>,
    last_learned: Arc<RwLock<Option<MidiLearnedMessage>>>,
}

impl MidiSubsystem {
    pub fn new() -> Self {
        Self {
            mappings: Arc::new(RwLock::new(HashMap::new())),
            learning_mode: Arc::new(AtomicBool::new(false)),
            last_learned: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_mappings(&self, list: Vec<MidiMapping>) {
        let mut map = self.mappings.write();
        map.clear();
        for m in list {
            map.insert(m.id.clone(), m);
        }
    }

    pub fn list_mappings(&self) -> Vec<MidiMapping> {
        self.mappings.read().values().cloned().collect()
    }

    pub fn set_learning_mode(&self, enabled: bool) {
        self.learning_mode.store(enabled, Ordering::SeqCst);
        if !enabled {
            *self.last_learned.write() = None;
        }
    }

    pub fn is_learning(&self) -> bool {
        self.learning_mode.load(Ordering::SeqCst)
    }

    pub fn get_last_learned(&self) -> Option<MidiLearnedMessage> {
        self.last_learned.read().clone()
    }

    /// Enumerates available physical MIDI input devices via midir
    pub fn enumerate_devices(&self) -> Result<Vec<String>, LiveStudioError> {
        let midi_in = midir::MidiInput::new("LiveStudioPro-Enumerate").map_err(|e| {
            LiveStudioError::device(format!("Failed to initialize MIDI input: {e}"), None)
        })?;

        let ports = midi_in.ports();
        let mut names = Vec::new();
        for port in ports {
            if let Ok(name) = midi_in.port_name(&port) {
                names.push(name);
            }
        }
        Ok(names)
    }

    /// Processes an incoming raw 3-byte MIDI packet (status, data1, data2)
    pub fn process_raw_message(
        &self,
        device: &str,
        bytes: &[u8],
    ) -> Option<(MidiMapping, Option<f32>)> {
        if bytes.len() < 3 {
            return None;
        }

        let status = bytes[0];
        let data1 = bytes[1]; // note or CC number
        let data2 = bytes[2]; // velocity or CC value

        let msg_type = match status & 0xF0 {
            0x90 => {
                if data2 == 0 {
                    MidiMessageType::NoteOff
                } else {
                    MidiMessageType::NoteOn
                }
            }
            0x80 => MidiMessageType::NoteOff,
            0xB0 => MidiMessageType::ControlChange,
            _ => return None,
        };

        let channel = status & 0x0F;

        // If in learn mode, capture and store
        if self.learning_mode.load(Ordering::SeqCst) {
            *self.last_learned.write() = Some(MidiLearnedMessage {
                device_name: device.to_string(),
                channel,
                message_type: msg_type,
                note_or_cc: data1,
                value: data2,
            });
            info!("MIDI Learned: {msg_type:?} Ch:{channel} Data1:{data1} Data2:{data2}");
            return None;
        }

        // Match against registered mappings
        let mappings = self.mappings.read();
        for m in mappings.values() {
            if !m.enabled {
                continue;
            }
            if let Some(ch) = m.channel {
                if ch != channel {
                    continue;
                }
            }
            if m.message_type == msg_type && m.note_or_cc == data1 {
                let normalized_value = if m.control_mode == MidiControlMode::ContinuousFader {
                    // Normalize 0..127 to min_value..max_value
                    let t = (data2 as f32) / 127.0;
                    Some(m.min_value + t * (m.max_value - m.min_value))
                } else {
                    None
                };

                return Some((m.clone(), normalized_value));
            }
        }

        None
    }
}
