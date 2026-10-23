use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::net::UdpSocket;
use tracing::{debug, error, info};

use crate::core::error::LiveStudioError;
use crate::project::model::{PtzCameraConfig, PtzPreset};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PtzDirection {
    Stop,
    Up,
    Down,
    Left,
    Right,
    UpLeft,
    UpRight,
    DownLeft,
    DownRight,
    ZoomIn,
    ZoomOut,
    ZoomStop,
}

#[derive(Clone)]
pub struct PtzController {
    cameras: Arc<parking_lot::RwLock<HashMap<String, PtzCameraConfig>>>,
    sequence_num: Arc<AtomicU32>,
}

impl PtzController {
    pub fn new() -> Self {
        Self {
            cameras: Arc::new(parking_lot::RwLock::new(HashMap::new())),
            sequence_num: Arc::new(AtomicU32::new(1)),
        }
    }

    pub fn register_camera(&self, camera: PtzCameraConfig) {
        self.cameras.write().insert(camera.id.clone(), camera);
    }

    pub fn unregister_camera(&self, camera_id: &str) -> bool {
        self.cameras.write().remove(camera_id).is_some()
    }

    pub fn get_camera(&self, camera_id: &str) -> Option<PtzCameraConfig> {
        self.cameras.read().get(camera_id).cloned()
    }

    pub fn list_cameras(&self) -> Vec<PtzCameraConfig> {
        self.cameras.read().values().cloned().collect()
    }

    /// Formats a VISCA-over-IP UDP packet with 8-byte header
    fn build_visca_ip_packet(&self, payload: &[u8]) -> Vec<u8> {
        let seq = self.sequence_num.fetch_add(1, Ordering::SeqCst);
        let mut packet = Vec::with_capacity(8 + payload.len());
        // VISCA-over-IP Header
        packet.push(0x01); // Payload type: VISCA command
        packet.push(0x00);
        packet.extend_from_slice(&(payload.len() as u16).to_be_bytes()); // Payload length
        packet.extend_from_slice(&seq.to_be_bytes()); // Sequence number
        packet.extend_from_slice(payload);
        packet
    }

    /// Sends a VISCA UDP packet to a target camera
    pub async fn send_visca_command(
        &self,
        camera_id: &str,
        visca_payload: &[u8],
    ) -> Result<(), LiveStudioError> {
        let (host, port) = {
            let cams = self.cameras.read();
            let cam = cams.get(camera_id).ok_or_else(|| {
                LiveStudioError::validation(format!("PTZ Camera '{camera_id}' not found"), Some("cameraId"))
            })?;
            (cam.host.clone(), cam.port)
        };

        let packet = self.build_visca_ip_packet(visca_payload);
        let dest = format!("{}:{}", host, port);

        let socket = UdpSocket::bind("0.0.0.0:0").await.map_err(|e| {
            LiveStudioError::device(format!("Failed to bind UDP socket for PTZ: {e}"), None)
        })?;

        socket.send_to(&packet, &dest).await.map_err(|e| {
            LiveStudioError::device(format!("Failed to send PTZ command to {dest}: {e}"), None)
        })?;

        debug!("Sent VISCA packet ({} bytes) to {dest}", packet.len());
        Ok(())
    }

    /// Pan/Tilt/Zoom continuous movement command
    pub async fn move_camera(
        &self,
        camera_id: &str,
        direction: PtzDirection,
        pan_speed: u8,
        tilt_speed: u8,
    ) -> Result<(), LiveStudioError> {
        let p_spd = pan_speed.clamp(1, 24);
        let t_spd = tilt_speed.clamp(1, 20);

        let payload: Vec<u8> = match direction {
            PtzDirection::Stop => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x03, 0x03, 0xFF],
            PtzDirection::Up => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x03, 0x01, 0xFF],
            PtzDirection::Down => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x03, 0x02, 0xFF],
            PtzDirection::Left => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x01, 0x03, 0xFF],
            PtzDirection::Right => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x02, 0x03, 0xFF],
            PtzDirection::UpLeft => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x01, 0x01, 0xFF],
            PtzDirection::UpRight => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x02, 0x01, 0xFF],
            PtzDirection::DownLeft => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x01, 0x02, 0xFF],
            PtzDirection::DownRight => vec![0x81, 0x01, 0x06, 0x01, p_spd, t_spd, 0x02, 0x02, 0xFF],
            PtzDirection::ZoomIn => {
                let z_spd = (p_spd / 3).clamp(0, 7);
                vec![0x81, 0x01, 0x04, 0x07, 0x20 | z_spd, 0xFF]
            }
            PtzDirection::ZoomOut => {
                let z_spd = (p_spd / 3).clamp(0, 7);
                vec![0x81, 0x01, 0x04, 0x07, 0x30 | z_spd, 0xFF]
            }
            PtzDirection::ZoomStop => vec![0x81, 0x01, 0x04, 0x07, 0x00, 0xFF],
        };

        self.send_visca_command(camera_id, &payload).await
    }

    /// Stores a preset index on the camera
    pub async fn save_preset(
        &self,
        camera_id: &str,
        preset_id: u32,
        preset_name: &str,
    ) -> Result<(), LiveStudioError> {
        let p_byte = (preset_id.clamp(0, 127)) as u8;
        let payload = vec![0x81, 0x01, 0x04, 0x3F, 0x01, p_byte, 0xFF];

        self.send_visca_command(camera_id, &payload).await?;

        // Also store in camera config
        let mut cams = self.cameras.write();
        if let Some(cam) = cams.get_mut(camera_id) {
            cam.presets.retain(|p| p.id != preset_id);
            cam.presets.push(PtzPreset {
                id: preset_id,
                name: preset_name.to_string(),
                pan: 0.0,
                tilt: 0.0,
                zoom: 0.0,
            });
        }
        Ok(())
    }

    /// Recalls a stored preset index
    pub async fn recall_preset(
        &self,
        camera_id: &str,
        preset_id: u32,
    ) -> Result<(), LiveStudioError> {
        let p_byte = (preset_id.clamp(0, 127)) as u8;
        let payload = vec![0x81, 0x01, 0x04, 0x3F, 0x02, p_byte, 0xFF];
        self.send_visca_command(camera_id, &payload).await
    }
}

/// Lightweight UDP loopback test simulator for automated verification of VISCA commands
pub struct PtzSimulator {
    bind_port: u16,
    running: Arc<parking_lot::RwLock<bool>>,
    received_packets: Arc<parking_lot::RwLock<Vec<Vec<u8>>>>,
}

impl PtzSimulator {
    pub fn new(bind_port: u16) -> Self {
        Self {
            bind_port,
            running: Arc::new(parking_lot::RwLock::new(false)),
            received_packets: Arc::new(parking_lot::RwLock::new(Vec::new())),
        }
    }

    pub async fn start(&self) -> Result<(), LiveStudioError> {
        let addr: SocketAddr = format!("127.0.0.1:{}", self.bind_port).parse().unwrap();
        let socket = UdpSocket::bind(addr).await.map_err(|e| {
            LiveStudioError::device(format!("Failed to bind simulator UDP socket: {e}"), None)
        })?;

        *self.running.write() = true;
        let running_clone = self.running.clone();
        let packets_clone = self.received_packets.clone();

        tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            info!("PTZ Simulator listening on {}", addr);
            while *running_clone.read() {
                tokio::select! {
                    res = socket.recv_from(&mut buf) => {
                        match res {
                            Ok((size, peer)) => {
                                let data = buf[..size].to_vec();
                                packets_clone.write().push(data.clone());
                                // Respond with VISCA ACK
                                let ack = [0x90, 0x41, 0xFF];
                                let _ = socket.send_to(&ack, peer).await;
                            }
                            Err(e) => {
                                error!("PTZ Simulator recv error: {e}");
                                break;
                            }
                        }
                    }
                    _ = tokio::time::sleep(tokio::time::Duration::from_millis(50)) => {
                        if !*running_clone.read() {
                            break;
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop(&self) {
        *self.running.write() = false;
    }

    pub fn get_received_count(&self) -> usize {
        self.received_packets.read().len()
    }
}
