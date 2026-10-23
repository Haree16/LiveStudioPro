use serde::{Deserialize, Serialize};
use crate::broadcast::hardware::SignalLockStatus;
use crate::broadcast::timecode::SmpteTimecode;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SdiVideoMode {
    Mode1080p60,
    Mode1080p5994,
    Mode1080i5994,
    Mode1080p50,
    Mode1080i50,
    Mode720p60,
    Mode2160p60,
}

impl SdiVideoMode {
    pub fn gstreamer_video_format(&self) -> (&'static str, u32, u32, u32, u32) {
        // (format, width, height, fps_num, fps_den)
        match self {
            Self::Mode1080p60 => ("UYVY", 1920, 1080, 60, 1),
            Self::Mode1080p5994 => ("UYVY", 1920, 1080, 60000, 1001),
            Self::Mode1080i5994 => ("UYVY", 1920, 1080, 30000, 1001),
            Self::Mode1080p50 => ("UYVY", 1920, 1080, 50, 1),
            Self::Mode1080i50 => ("UYVY", 1920, 1080, 25, 1),
            Self::Mode720p60 => ("UYVY", 1280, 720, 60, 1),
            Self::Mode2160p60 => ("UYVY", 3840, 2160, 60, 1),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SdiPlayoutConfig {
    pub device_number: u32, // DeckLink device index (e.g. 0, 1, 2)
    pub mode: SdiVideoMode,
    pub genlock_enabled: bool,
    pub embedded_audio_channels: u32, // 2, 8, or 16 channels
    pub embed_smpte_timecode: bool,
}

impl Default for SdiPlayoutConfig {
    fn default() -> Self {
        Self {
            device_number: 0,
            mode: SdiVideoMode::Mode1080p5994,
            genlock_enabled: true,
            embedded_audio_channels: 8,
            embed_smpte_timecode: true,
        }
    }
}

pub struct SdiPlayoutEngine;

impl SdiPlayoutEngine {
    /// Builds GStreamer playout pipeline for Blackmagic DeckLink SDI
    pub fn build_playout_pipeline(config: &SdiPlayoutConfig) -> String {
        let _ = gstreamer::init();
        let (fmt, w, h, fps_num, fps_den) = config.mode.gstreamer_video_format();
        let has_decklink_sink = gstreamer::ElementFactory::find("decklinkvideosink").is_some();

        if has_decklink_sink {
            format!(
                "appsrc name=sdisrc is-live=true format=time ! \
                 videoconvert ! \
                 video/x-raw,format={},width={},height={},framerate={}/{} ! \
                 decklinkvideosink device-number={}",
                fmt, w, h, fps_num, fps_den, config.device_number
            )
        } else {
            // Safe simulation fallback when Blackmagic hardware driver is absent
            format!(
                "appsrc name=sdisrc is-live=true format=time ! \
                 videoconvert ! \
                 video/x-raw,format={},width={},height={},framerate={}/{} ! \
                 fakesink sync=true",
                fmt, w, h, fps_num, fps_den
            )
        }
    }

    /// Evaluates hardware genlock status based on external reference presence
    pub fn evaluate_genlock_reference(has_external_ref: bool, requested_mode: SdiVideoMode) -> SignalLockStatus {
        if has_external_ref {
            SignalLockStatus::GenlockLocked(format!("Tri-Level Reference Sync ({:?})", requested_mode))
        } else {
            SignalLockStatus::Locked(format!("Free Run Internal Clock ({:?})", requested_mode))
        }
    }

    /// Formats SMPTE 12M RP188 VANC timecode metadata for SDI frame tagging
    pub fn format_sdi_rp188_timecode(tc: &SmpteTimecode) -> String {
        format!(
            "RP188:{:02}:{:02}:{:02}{}{:02}",
            tc.hours,
            tc.minutes,
            tc.seconds,
            if tc.rate.is_drop_frame() { ';' } else { ':' },
            tc.frames
        )
    }
}
