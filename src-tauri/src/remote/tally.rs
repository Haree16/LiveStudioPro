use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::debug;

use crate::core::error::LiveStudioError;
use crate::project::model::TallyMappingConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TallyState {
    Offline,
    Idle,
    Preview,
    Program,
}

impl TallyState {
    pub fn is_program(&self) -> bool {
        matches!(self, TallyState::Program)
    }

    pub fn is_preview(&self) -> bool {
        matches!(self, TallyState::Preview)
    }

    pub fn color_hex(&self) -> &'static str {
        match self {
            TallyState::Program => "#E53E3E", // Red
            TallyState::Preview => "#38A169", // Green
            TallyState::Idle => "#4A5568",    // Slate Gray
            TallyState::Offline => "#1A202C", // Dark
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputTallyStatus {
    pub input_id: String,
    pub label: String,
    pub tally_number: u32,
    pub state: TallyState,
    pub color_hex: String,
}

#[derive(Clone)]
pub struct TallyManager {
    mappings: Arc<parking_lot::RwLock<HashMap<String, TallyMappingConfig>>>,
    current_status: Arc<parking_lot::RwLock<HashMap<String, InputTallyStatus>>>,
    notifier: broadcast::Sender<Vec<InputTallyStatus>>,
}

impl TallyManager {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(100);
        Self {
            mappings: Arc::new(parking_lot::RwLock::new(HashMap::new())),
            current_status: Arc::new(parking_lot::RwLock::new(HashMap::new())),
            notifier: tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Vec<InputTallyStatus>> {
        self.notifier.subscribe()
    }

    pub fn set_mappings(&self, configs: Vec<TallyMappingConfig>) {
        let mut map = self.mappings.write();
        map.clear();
        for c in configs {
            map.insert(c.input_id.clone(), c);
        }
    }

    pub fn add_or_update_mapping(&self, config: TallyMappingConfig) {
        self.mappings.write().insert(config.input_id.clone(), config);
    }

    /// Evaluates tally states given active Program and Preview input IDs
    /// Precedence rule: Program > Preview (if an input is both, Program wins)
    pub fn update_switcher_state(
        &self,
        program_id: Option<&str>,
        preview_id: Option<&str>,
        all_input_ids: &[String],
    ) -> Vec<InputTallyStatus> {
        let mappings = self.mappings.read();
        let mut new_statuses = Vec::new();

        for (idx, id) in all_input_ids.iter().enumerate() {
            let label = mappings
                .get(id)
                .map(|m| m.label.clone())
                .unwrap_or_else(|| format!("Input {}", idx + 1));

            let tally_number = mappings
                .get(id)
                .map(|m| m.tally_number)
                .unwrap_or((idx + 1) as u32);

            let is_pgm = program_id.map_or(false, |p| p == id);
            let is_pvw = preview_id.map_or(false, |p| p == id);

            let state = if is_pgm {
                TallyState::Program // Highest priority
            } else if is_pvw {
                TallyState::Preview
            } else {
                TallyState::Idle
            };

            let status = InputTallyStatus {
                input_id: id.clone(),
                label,
                tally_number,
                color_hex: state.color_hex().to_string(),
                state,
            };

            new_statuses.push(status);
        }

        {
            let mut current = self.current_status.write();
            current.clear();
            for s in &new_statuses {
                current.insert(s.input_id.clone(), s.clone());
            }
        }

        // Broadcast to WebSocket clients
        let _ = self.notifier.send(new_statuses.clone());
        new_statuses
    }

    pub fn get_all_tally(&self) -> Vec<InputTallyStatus> {
        self.current_status.read().values().cloned().collect()
    }

    pub fn get_tally_for_input(&self, input_id: &str) -> Option<InputTallyStatus> {
        self.current_status.read().get(input_id).cloned()
    }

    /// Generates a standard TSL UMD v3.1 18-byte tally frame
    pub fn format_tsl_umd_v31(
        &self,
        address: u8,
        label: &str,
        is_program: bool,
        is_preview: bool,
    ) -> [u8; 18] {
        let mut frame = [0u8; 18];
        // Byte 0: Header (0x80 | (address & 0x7F))
        frame[0] = 0x80 | (address & 0x7F);

        // Control Byte (Byte 1)
        // Bit 0: Tally 1 (Program / Red)
        // Bit 1: Tally 2 (Preview / Green)
        let mut ctrl = 0u8;
        if is_program {
            ctrl |= 0x01;
        }
        if is_preview {
            ctrl |= 0x02;
        }
        frame[1] = ctrl;

        // Bytes 2..17: 16-character label padded with spaces
        let bytes = label.as_bytes();
        for i in 0..16 {
            if i < bytes.len() {
                frame[2 + i] = bytes[i];
            } else {
                frame[2 + i] = b' ';
            }
        }

        frame
    }

    /// Broadcasts TSL UMD packet to a hardware display via UDP
    pub async fn send_tsl_umd_udp(
        &self,
        dest_addr: &str,
        address: u8,
        label: &str,
        is_program: bool,
        is_preview: bool,
    ) -> Result<(), LiveStudioError> {
        let frame = self.format_tsl_umd_v31(address, label, is_program, is_preview);
        let socket = tokio::net::UdpSocket::bind("0.0.0.0:0").await.map_err(|e| {
            LiveStudioError::device(format!("Failed to bind TSL socket: {e}"), None)
        })?;

        socket.send_to(&frame, dest_addr).await.map_err(|e| {
            LiveStudioError::device(format!("Failed to send TSL packet to {dest_addr}: {e}"), None)
        })?;

        debug!("Dispatched TSL UMD packet to {dest_addr}");
        Ok(())
    }
}
