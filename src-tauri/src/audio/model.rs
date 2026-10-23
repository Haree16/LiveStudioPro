use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EqConfig {
    pub enabled: bool,
    pub low_gain_db: f64,   // 100 Hz band (-24.0 to +12.0)
    pub mid_gain_db: f64,   // 1.1 kHz band (-24.0 to +12.0)
    pub high_gain_db: f64,  // 11 kHz band (-24.0 to +12.0)
}

impl Default for EqConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            low_gain_db: 0.0,
            mid_gain_db: 0.0,
            high_gain_db: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DynamicsConfig {
    pub compressor_enabled: bool,
    pub threshold_db: f64,  // -60.0 to 0.0 dB
    pub ratio: f64,         // 1.0 to 20.0 (e.g. 4.0 for 4:1)
    pub attack_ms: f64,     // 1.0 to 500.0 ms
    pub release_ms: f64,    // 10.0 to 2000.0 ms
    pub gate_enabled: bool,
    pub gate_threshold_db: f64, // -80.0 to 0.0 dB
}

impl Default for DynamicsConfig {
    fn default() -> Self {
        Self {
            compressor_enabled: false,
            threshold_db: -18.0,
            ratio: 4.0,
            attack_ms: 10.0,
            release_ms: 100.0,
            gate_enabled: false,
            gate_threshold_db: -50.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioBusRouting {
    pub master: bool,
    pub headphones: bool,
    pub aux1: bool,
    pub aux2: bool,
}

impl Default for AudioBusRouting {
    fn default() -> Self {
        Self {
            master: true,
            headphones: true,
            aux1: false,
            aux2: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioChannelStrip {
    pub input_id: String,
    pub name: String,
    pub gain_db: f32,       // -24.0 to +24.0 dB pre-amp
    pub fader_db: f32,      // -60.0 to +12.0 dB (-60 = -inf)
    pub pan: f32,           // -1.0 (Left) to +1.0 (Right)
    pub muted: bool,
    pub solo: bool,
    pub afv: bool,          // Audio-Follow-Video
    #[serde(default)]
    pub pfl: bool,          // Pre-Fader Listen audition
    pub delay_ms: u32,      // 0 to 1000 ms lip-sync delay
    pub eq: EqConfig,
    pub dynamics: DynamicsConfig,
    pub routing: AudioBusRouting,
}

impl AudioChannelStrip {
    pub fn new(input_id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            input_id: input_id.into(),
            name: name.into(),
            gain_db: 0.0,
            fader_db: 0.0,
            pan: 0.0,
            muted: false,
            solo: false,
            afv: false,
            pfl: false,
            delay_ms: 0,
            eq: EqConfig::default(),
            dynamics: DynamicsConfig::default(),
            routing: AudioBusRouting::default(),
        }
    }

    /// Converts gain + fader dB into linear amplitude multiplier (0.0 to ~4.0)
    pub fn calculate_effective_volume(&self, is_afv_active: bool) -> f64 {
        if self.muted {
            return 0.0;
        }
        if self.afv && !is_afv_active {
            return 0.0;
        }
        if self.fader_db <= -60.0 {
            return 0.0;
        }

        let total_db = (self.gain_db + self.fader_db).clamp(-60.0, 24.0);
        10.0f64.powf(total_db as f64 / 20.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioBus {
    pub id: String,         // "master", "headphones", "aux1", "aux2"
    pub name: String,
    pub fader_db: f32,      // -60.0 to +12.0 dB
    pub muted: bool,
}

impl AudioBus {
    pub fn master() -> Self {
        Self {
            id: "master".into(),
            name: "Master Mix".into(),
            fader_db: 0.0,
            muted: false,
        }
    }

    pub fn headphones() -> Self {
        Self {
            id: "headphones".into(),
            name: "Headphones / PFL".into(),
            fader_db: 0.0,
            muted: false,
        }
    }

    pub fn aux1() -> Self {
        Self {
            id: "aux1".into(),
            name: "AUX 1 (Stream)".into(),
            fader_db: 0.0,
            muted: false,
        }
    }

    pub fn aux2() -> Self {
        Self {
            id: "aux2".into(),
            name: "AUX 2 (Record)".into(),
            fader_db: 0.0,
            muted: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioMeterReading {
    pub channel_id: String,
    pub peak_db_left: f32,
    pub peak_db_right: f32,
    pub rms_db_left: f32,
    pub rms_db_right: f32,
    pub is_clipping: bool,
}

impl AudioMeterReading {
    pub fn silence(channel_id: &str) -> Self {
        Self {
            channel_id: channel_id.to_string(),
            peak_db_left: -60.0,
            peak_db_right: -60.0,
            rms_db_left: -60.0,
            rms_db_right: -60.0,
            is_clipping: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioMixerConfig {
    pub channels: Vec<AudioChannelStrip>,
    pub buses: Vec<AudioBus>,
}

impl Default for AudioMixerConfig {
    fn default() -> Self {
        Self {
            channels: Vec::new(),
            buses: vec![
                AudioBus::master(),
                AudioBus::headphones(),
                AudioBus::aux1(),
                AudioBus::aux2(),
            ],
        }
    }
}
