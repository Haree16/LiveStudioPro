use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProAudioDriver {
    DirectPipeWire,
    AsioHardware,
    WasapiExclusive,
    AlsaDirectHw,
    CoreAudioPro,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChannelRoute {
    pub physical_input_channel: u16, // 1 to 16
    pub target_strip_id: String,
    pub target_strip_channel: u16,  // 1 = Left, 2 = Right, 3+ = Multi
    pub gain_linear: f32,           // 1.0 = unity
    pub invert_phase: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioMatrixConfig {
    pub driver: ProAudioDriver,
    pub sample_rate: u32,       // 48000, 96000
    pub buffer_size_frames: u32, // 64, 128, 256, 512
    pub active_routes: Vec<AudioChannelRoute>,
}

impl Default for AudioMatrixConfig {
    fn default() -> Self {
        #[cfg(target_os = "linux")]
        let driver = ProAudioDriver::DirectPipeWire;
        #[cfg(target_os = "windows")]
        let driver = ProAudioDriver::AsioHardware;
        #[cfg(not(any(target_os = "linux", target_os = "windows")))]
        let driver = ProAudioDriver::DirectPipeWire;

        Self {
            driver,
            sample_rate: 48000,
            buffer_size_frames: 256,
            active_routes: vec![
                AudioChannelRoute {
                    physical_input_channel: 1,
                    target_strip_id: "ch-1".into(),
                    target_strip_channel: 1,
                    gain_linear: 1.0,
                    invert_phase: false,
                },
                AudioChannelRoute {
                    physical_input_channel: 2,
                    target_strip_id: "ch-1".into(),
                    target_strip_channel: 2,
                    gain_linear: 1.0,
                    invert_phase: false,
                },
            ],
        }
    }
}

pub struct AudioMatrixEngine {
    config: AudioMatrixConfig,
    mapping_cache: HashMap<(u16, String), (u16, f32, bool)>,
}

impl AudioMatrixEngine {
    pub fn new(config: AudioMatrixConfig) -> Self {
        let mut engine = Self {
            config,
            mapping_cache: HashMap::new(),
        };
        engine.rebuild_cache();
        engine
    }

    pub fn set_config(&mut self, config: AudioMatrixConfig) {
        self.config = config;
        self.rebuild_cache();
    }

    pub fn get_config(&self) -> &AudioMatrixConfig {
        &self.config
    }

    pub fn add_route(&mut self, route: AudioChannelRoute) {
        self.config.active_routes.retain(|r| {
            !(r.physical_input_channel == route.physical_input_channel
                && r.target_strip_id == route.target_strip_id
                && r.target_strip_channel == route.target_strip_channel)
        });
        self.config.active_routes.push(route);
        self.rebuild_cache();
    }

    pub fn remove_route(&mut self, physical_input: u16, target_strip: &str) {
        self.config
            .active_routes
            .retain(|r| !(r.physical_input_channel == physical_input && r.target_strip_id == target_strip));
        self.rebuild_cache();
    }

    fn rebuild_cache(&mut self) {
        self.mapping_cache.clear();
        for r in &self.config.active_routes {
            self.mapping_cache.insert(
                (r.physical_input_channel, r.target_strip_id.clone()),
                (r.target_strip_channel, r.gain_linear, r.invert_phase),
            );
        }
    }

    /// Remaps a 16-channel input frame buffer to a stereo output pair for a specific channel strip
    pub fn map_frame_to_strip(
        &self,
        multi_channel_samples: &[f32], // Interleaved 16-channel frame
        channels_per_frame: usize,     // 16
        strip_id: &str,
        out_left: &mut Vec<f32>,
        out_right: &mut Vec<f32>,
    ) {
        out_left.clear();
        out_right.clear();
        let frame_count = multi_channel_samples.len() / channels_per_frame;
        out_left.resize(frame_count, 0.0);
        out_right.resize(frame_count, 0.0);

        for (_ch_idx, r) in self.config.active_routes.iter().enumerate() {
            if r.target_strip_id != strip_id {
                continue;
            }
            let phys_idx = (r.physical_input_channel.saturating_sub(1) as usize) % channels_per_frame;
            let mult = if r.invert_phase { -r.gain_linear } else { r.gain_linear };

            for frame in 0..frame_count {
                let sample = multi_channel_samples[frame * channels_per_frame + phys_idx] * mult;
                if r.target_strip_channel == 1 {
                    out_left[frame] += sample;
                } else if r.target_strip_channel == 2 {
                    out_right[frame] += sample;
                }
            }
        }
    }
}
