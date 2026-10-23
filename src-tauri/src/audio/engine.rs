use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use gstreamer as gst;
use gstreamer::prelude::*;
use parking_lot::RwLock;
use tracing::info;

use crate::audio::model::{
    AudioBusRouting, AudioChannelStrip, AudioMeterReading, AudioMixerConfig,
    DynamicsConfig, EqConfig,
};
use crate::core::error::LiveStudioError;

pub struct NativeAudioEngine {
    config: Arc<RwLock<AudioMixerConfig>>,
    meter_readings: Arc<RwLock<HashMap<String, AudioMeterReading>>>,
    active_pgm_input_id: Arc<RwLock<Option<String>>>,
    transition_state: Arc<RwLock<Option<(String, String, f32)>>>, // (from_id, to_id, progress)
    pipelines: Arc<RwLock<HashMap<String, gst::Pipeline>>>,
    #[allow(dead_code)]
    is_running: AtomicBool,
}

impl NativeAudioEngine {
    pub fn new() -> Result<Self, LiveStudioError> {
        let _ = gst::init();

        let engine = Self {
            config: Arc::new(RwLock::new(AudioMixerConfig::default())),
            meter_readings: Arc::new(RwLock::new(HashMap::new())),
            active_pgm_input_id: Arc::new(RwLock::new(None)),
            transition_state: Arc::new(RwLock::new(None)),
            pipelines: Arc::new(RwLock::new(HashMap::new())),
            is_running: AtomicBool::new(true),
        };

        Ok(engine)
    }

    pub fn get_config(&self) -> AudioMixerConfig {
        self.config.read().clone()
    }

    pub fn load_config(&self, new_config: AudioMixerConfig) {
        *self.config.write() = new_config;
        self.recalculate_all_volumes();
    }

    pub fn ensure_channel_exists(&self, input_id: &str, name: &str) {
        let mut cfg = self.config.write();
        if !cfg.channels.iter().any(|c| c.input_id == input_id) {
            cfg.channels.push(AudioChannelStrip::new(input_id, name));
            info!("Registered audio channel strip for input '{input_id}' ({name})");
        }
    }

    pub fn remove_channel(&self, input_id: &str) {
        let mut cfg = self.config.write();
        cfg.channels.retain(|c| c.input_id != input_id);
        self.meter_readings.write().remove(input_id);
        if let Some(pipe) = self.pipelines.write().remove(input_id) {
            let _ = pipe.set_state(gst::State::Null);
        }
    }

    pub fn set_channel_fader(&self, input_id: &str, fader_db: f32) -> Result<(), LiveStudioError> {
        let clamped = fader_db.clamp(-60.0, 12.0);
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.fader_db = clamped;
        }
        self.recalculate_channel_volume(input_id);
        Ok(())
    }

    pub fn set_channel_gain(&self, input_id: &str, gain_db: f32) -> Result<(), LiveStudioError> {
        let clamped = gain_db.clamp(-24.0, 24.0);
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.gain_db = clamped;
        }
        self.recalculate_channel_volume(input_id);
        Ok(())
    }

    pub fn set_channel_pan(&self, input_id: &str, pan: f32) -> Result<(), LiveStudioError> {
        let clamped = pan.clamp(-1.0, 1.0);
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.pan = clamped;
        }
        if let Some(pipe) = self.pipelines.read().get(input_id) {
            if let Some(pan_elem) = pipe.by_name("pan") {
                pan_elem.set_property("panorama", clamped);
            }
        }
        Ok(())
    }

    pub fn set_channel_mute(&self, input_id: &str, muted: bool) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.muted = muted;
        }
        self.recalculate_all_volumes();
        Ok(())
    }

    pub fn set_channel_solo(&self, input_id: &str, solo: bool) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.solo = solo;
        }
        self.recalculate_all_volumes();
        Ok(())
    }

    pub fn set_channel_afv(&self, input_id: &str, afv: bool) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.afv = afv;
        }
        self.recalculate_all_volumes();
        Ok(())
    }

    pub fn set_channel_pfl(&self, input_id: &str, pfl: bool) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.pfl = pfl;
        }
        self.recalculate_all_volumes();
        Ok(())
    }

    pub fn set_channel_delay(&self, input_id: &str, delay_ms: u32) -> Result<(), LiveStudioError> {
        let clamped = delay_ms.clamp(0, 1000);
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.delay_ms = clamped;
        }
        if let Some(pipe) = self.pipelines.read().get(input_id) {
            if let Some(delay_elem) = pipe.by_name("delay") {
                let ns = (clamped as u64) * 1_000_000;
                delay_elem.set_property("min-threshold-time", ns);
                delay_elem.set_property("max-size-time", ns + 500_000_000);
            }
        }
        Ok(())
    }

    pub fn set_channel_eq(&self, input_id: &str, eq: EqConfig) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.eq = eq.clone();
        }
        if let Some(pipe) = self.pipelines.read().get(input_id) {
            if let Some(eq_elem) = pipe.by_name("eq") {
                if eq.enabled {
                    eq_elem.set_property("band0", eq.low_gain_db.clamp(-24.0, 12.0));
                    eq_elem.set_property("band1", eq.mid_gain_db.clamp(-24.0, 12.0));
                    eq_elem.set_property("band2", eq.high_gain_db.clamp(-24.0, 12.0));
                } else {
                    eq_elem.set_property("band0", 0.0f64);
                    eq_elem.set_property("band1", 0.0f64);
                    eq_elem.set_property("band2", 0.0f64);
                }
            }
        }
        Ok(())
    }

    pub fn set_channel_dynamics(&self, input_id: &str, dyn_cfg: DynamicsConfig) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.dynamics = dyn_cfg;
        }
        Ok(())
    }

    /// Applies digital signal processing (noise gate and dynamic compression) to interleaved PCM audio samples
    pub fn process_channel_dsp(&self, input_id: &str, samples: &mut [i16]) {
        let (ch_muted, dyn_cfg) = {
            let cfg = self.config.read();
            if let Some(ch) = cfg.channels.iter().find(|c| c.input_id == input_id) {
                (ch.muted, ch.dynamics.clone())
            } else {
                return;
            }
        };

        if ch_muted {
            samples.fill(0);
            return;
        }

        // 1. Downward Noise Gate
        if dyn_cfg.gate_enabled {
            let gate_thresh_linear = 10.0f64.powf(dyn_cfg.gate_threshold_db / 20.0) * 32767.0;
            let peak_abs = samples.iter().map(|&s| (s as f64).abs()).fold(0.0f64, f64::max);
            if peak_abs < gate_thresh_linear {
                samples.fill(0);
                return;
            }
        }

        // 2. Dynamic Audio Compressor
        if dyn_cfg.compressor_enabled && dyn_cfg.ratio > 1.0 {
            let thresh_linear = 10.0f64.powf(dyn_cfg.threshold_db / 20.0) * 32767.0;
            if thresh_linear > 0.0 {
                for sample in samples.iter_mut() {
                    let abs_val = (*sample as f64).abs();
                    if abs_val > thresh_linear {
                        let over_db = 20.0 * (abs_val / thresh_linear).log10();
                        let compressed_over_db = over_db / dyn_cfg.ratio;
                        let gain_reduction = 10.0f64.powf((compressed_over_db - over_db) / 20.0);
                        let compressed_val = (*sample as f64) * gain_reduction;
                        *sample = compressed_val.clamp(-32768.0, 32767.0) as i16;
                    }
                }
            }
        }
    }

    pub fn set_channel_bus_routing(&self, input_id: &str, routing: AudioBusRouting) -> Result<(), LiveStudioError> {
        {
            let mut cfg = self.config.write();
            let ch = cfg
                .channels
                .iter_mut()
                .find(|c| c.input_id == input_id)
                .ok_or_else(|| LiveStudioError::media("Audio channel not found", None))?;
            ch.routing = routing;
        }
        self.recalculate_all_volumes();
        Ok(())
    }

    pub fn set_bus_fader(&self, bus_id: &str, fader_db: f32) -> Result<(), LiveStudioError> {
        let clamped = fader_db.clamp(-60.0, 12.0);
        let mut cfg = self.config.write();
        let bus = cfg
            .buses
            .iter_mut()
            .find(|b| b.id == bus_id)
            .ok_or_else(|| LiveStudioError::media("Audio bus not found", None))?;
        bus.fader_db = clamped;
        Ok(())
    }

    pub fn set_bus_mute(&self, bus_id: &str, muted: bool) -> Result<(), LiveStudioError> {
        let mut cfg = self.config.write();
        let bus = cfg
            .buses
            .iter_mut()
            .find(|b| b.id == bus_id)
            .ok_or_else(|| LiveStudioError::media("Audio bus not found", None))?;
        bus.muted = muted;
        Ok(())
    }

    // Audio-Follow-Video (AFV) updates from switcher
    pub fn on_program_source_changed(&self, pgm_input_id: Option<String>) {
        *self.active_pgm_input_id.write() = pgm_input_id;
        *self.transition_state.write() = None;
        self.recalculate_all_volumes();
    }

    pub fn on_transition_progress(&self, from_id: &str, to_id: &str, progress: f32) {
        *self.transition_state.write() = Some((from_id.to_string(), to_id.to_string(), progress.clamp(0.0, 1.0)));
        self.recalculate_all_volumes();
    }

    pub fn on_transition_completed(&self, new_pgm_id: &str) {
        *self.active_pgm_input_id.write() = Some(new_pgm_id.to_string());
        *self.transition_state.write() = None;
        self.recalculate_all_volumes();
    }

    fn recalculate_channel_volume(&self, input_id: &str) {
        let cfg = self.config.read();
        let any_solo = cfg.channels.iter().any(|c| c.solo);

        if let Some(ch) = cfg.channels.iter().find(|c| c.input_id == input_id) {
            let pgm_active = self.active_pgm_input_id.read().as_deref() == Some(input_id);
            let mut afv_multiplier = 1.0f32;

            if let Some((ref from, ref to, progress)) = *self.transition_state.read() {
                if ch.afv {
                    if ch.input_id == *from {
                        afv_multiplier = 1.0 - progress;
                    } else if ch.input_id == *to {
                        afv_multiplier = progress;
                    } else {
                        afv_multiplier = 0.0;
                    }
                }
            } else if ch.afv && !pgm_active {
                afv_multiplier = 0.0;
            }

            let effective_vol = if any_solo && !ch.solo {
                0.0f64
            } else {
                let base = ch.calculate_effective_volume(pgm_active);
                base * (afv_multiplier as f64)
            };

            if let Some(pipe) = self.pipelines.read().get(input_id) {
                if let Some(vol_elem) = pipe.by_name("vol") {
                    vol_elem.set_property("volume", effective_vol);
                }
            }
        }
    }

    fn recalculate_all_volumes(&self) {
        let channel_ids: Vec<String> = self.config.read().channels.iter().map(|c| c.input_id.clone()).collect();
        for id in channel_ids {
            self.recalculate_channel_volume(&id);
        }
    }

    pub fn get_meter_readings(&self) -> Vec<AudioMeterReading> {
        let cfg = self.config.read();
        let mut readings = Vec::new();
        let meters = self.meter_readings.read();

        for ch in &cfg.channels {
            if ch.muted {
                readings.push(AudioMeterReading::silence(&ch.input_id));
            } else if let Some(r) = meters.get(&ch.input_id) {
                readings.push(r.clone());
            } else {
                // If channel is muted or silent, return clean silence floor (-60dB)
                readings.push(AudioMeterReading::silence(&ch.input_id));
            }
        }

        // Add Master bus reading
        let master_bus = cfg.buses.iter().find(|b| b.id == "master");
        let master_muted = master_bus.map(|b| b.muted).unwrap_or(false);
        let master_fader = master_bus.map(|b| b.fader_db).unwrap_or(0.0);
        if master_muted || master_fader <= -60.0 {
            readings.push(AudioMeterReading::silence("master"));
        } else {
            let max_peak = readings.iter().map(|r| r.peak_db_left.max(r.peak_db_right)).fold(-60.0f32, f32::max);
            let max_rms = readings.iter().map(|r| r.rms_db_left.max(r.rms_db_right)).fold(-60.0f32, f32::max);
            let master_peak = if max_peak <= -59.9 { -60.0 } else { (max_peak + master_fader).clamp(-60.0, 6.0) };
            let master_rms = if max_rms <= -59.9 { -60.0 } else { (max_rms + master_fader).clamp(-60.0, 6.0) };

            readings.push(AudioMeterReading {
                channel_id: "master".into(),
                peak_db_left: master_peak,
                peak_db_right: master_peak,
                rms_db_left: master_rms,
                rms_db_right: master_rms,
                is_clipping: master_peak > 0.0,
            });
        }

        readings
    }

    pub fn update_meter_reading(&self, reading: AudioMeterReading) {
        self.meter_readings.write().insert(reading.channel_id.clone(), reading);
    }

    pub fn attach_pipeline(&self, input_id: &str, pipeline: gst::Pipeline) {
        self.pipelines.write().insert(input_id.to_string(), pipeline);
        self.recalculate_channel_volume(input_id);
    }
}
