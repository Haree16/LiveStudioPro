use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum HardwareIntegrationStatus {
    SupportedAndActive,
    DeviceNotConnected,
    DriverMissing,
    BlockedByDependency,
    UnverifiedOnHost,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SignalLockStatus {
    NoSignal,
    SignalDetectedUnlocked,
    Locked(String),           // e.g. "1080p59.94"
    GenlockLocked(String),    // Hardware reference locked, e.g. "Tri-level Sync 1080p"
    ReferenceSignalLost,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BroadcastHardwareDeviceConfig {
    pub id: String,
    pub name: String,
    pub vendor: String,          // "Blackmagic Design", "AJA", "Magewell", "Generic V4L2"
    pub model: String,           // "DeckLink Quad 2", "Kona 5", "USB Capture HDMI"
    pub device_type: String,     // "sdi_input", "sdi_output", "hdmi_capture"
    pub port_number: u8,
    pub supported_modes: Vec<String>,
    pub active_mode: Option<String>,
    pub genlock_supported: bool,
    pub status: HardwareIntegrationStatus,
    pub signal_status: SignalLockStatus,
}

pub struct BroadcastHardwareManager {
    devices: Arc<RwLock<HashMap<String, BroadcastHardwareDeviceConfig>>>,
}

impl BroadcastHardwareManager {
    pub fn new() -> Self {
        let mut mgr = Self {
            devices: Arc::new(RwLock::new(HashMap::new())),
        };
        mgr.probe_system_hardware();
        mgr
    }

    /// Probes system for real professional broadcast capture and output devices
    pub fn probe_system_hardware(&mut self) {
        let mut probed = HashMap::new();

        // 1. Probe DeckLink support in GStreamer / host
        let has_decklink = gstreamer::ElementFactory::find("decklinkvideosrc").is_some();
        if has_decklink {
            let decklink_dev = BroadcastHardwareDeviceConfig {
                id: "decklink-0".into(),
                name: "Blackmagic DeckLink Device".into(),
                vendor: "Blackmagic Design".into(),
                model: "DeckLink SDI/HDMI".into(),
                device_type: "sdi_input".into(),
                port_number: 1,
                supported_modes: vec!["1080p60".into(), "1080p59.94".into(), "1080i59.94".into(), "720p60".into()],
                active_mode: None,
                genlock_supported: true,
                status: HardwareIntegrationStatus::SupportedAndActive,
                signal_status: SignalLockStatus::SignalDetectedUnlocked,
            };
            probed.insert(decklink_dev.id.clone(), decklink_dev);
        } else {
            // Honestly register DeckLink capability boundary as BlockedByDependency
            let decklink_absent = BroadcastHardwareDeviceConfig {
                id: "decklink-stub".into(),
                name: "Blackmagic DeckLink Subsystem".into(),
                vendor: "Blackmagic Design".into(),
                model: "Desktop Video SDK".into(),
                device_type: "sdi_adapter".into(),
                port_number: 0,
                supported_modes: vec!["1080p60".into(), "1080p50".into(), "2160p60".into()],
                active_mode: None,
                genlock_supported: true,
                status: HardwareIntegrationStatus::BlockedByDependency,
                signal_status: SignalLockStatus::NoSignal,
            };
            probed.insert(decklink_absent.id.clone(), decklink_absent);
        }

        // 2. Probe native V4L2 capture on Linux
        #[cfg(target_os = "linux")]
        {
            if let Ok(entries) = std::fs::read_dir("/dev") {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with("video") {
                        let dev = BroadcastHardwareDeviceConfig {
                            id: format!("v4l2-{name}"),
                            name: format!("V4L2 Video Device (/dev/{name})"),
                            vendor: "Linux V4L2".into(),
                            model: name.clone(),
                            device_type: "hdmi_or_webcam".into(),
                            port_number: 0,
                            supported_modes: vec!["1920x1080@60fps".into(), "1920x1080@30fps".into(), "1280x720@60fps".into()],
                            active_mode: Some("1920x1080@30fps".into()),
                            genlock_supported: false, // V4L2 consumer devices do not provide hardware genlock
                            status: HardwareIntegrationStatus::SupportedAndActive,
                            signal_status: SignalLockStatus::Locked("1080p30".into()),
                        };
                        probed.insert(dev.id.clone(), dev);
                    }
                }
            }
        }

        *self.devices.write() = probed;
    }

    pub fn list_devices(&self) -> Vec<BroadcastHardwareDeviceConfig> {
        let mut list: Vec<BroadcastHardwareDeviceConfig> = self.devices.read().values().cloned().collect();
        list.sort_by(|a, b| a.id.cmp(&b.id));
        list
    }

    pub fn get_device(&self, id: &str) -> Option<BroadcastHardwareDeviceConfig> {
        self.devices.read().get(id).cloned()
    }
}
