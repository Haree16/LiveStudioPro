use serde::{Deserialize, Serialize};
use std::fmt;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimecodeRate {
    Fps23_98,
    Fps24,
    Fps25,
    Fps29_97Df,
    Fps29_97Ndf,
    Fps30,
    Fps50,
    Fps59_94Df,
    Fps59_94Ndf,
    Fps60,
}

impl TimecodeRate {
    pub fn nominal_fps(&self) -> u32 {
        match self {
            TimecodeRate::Fps23_98 | TimecodeRate::Fps24 => 24,
            TimecodeRate::Fps25 => 25,
            TimecodeRate::Fps29_97Df | TimecodeRate::Fps29_97Ndf | TimecodeRate::Fps30 => 30,
            TimecodeRate::Fps50 => 50,
            TimecodeRate::Fps59_94Df | TimecodeRate::Fps59_94Ndf | TimecodeRate::Fps60 => 60,
        }
    }

    pub fn is_drop_frame(&self) -> bool {
        matches!(self, TimecodeRate::Fps29_97Df | TimecodeRate::Fps59_94Df)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmpteTimecode {
    pub hours: u8,
    pub minutes: u8,
    pub seconds: u8,
    pub frames: u8,
    pub rate: TimecodeRate,
}

impl SmpteTimecode {
    pub fn new(hours: u8, minutes: u8, seconds: u8, frames: u8, rate: TimecodeRate) -> Result<Self, LiveStudioError> {
        let max_f = rate.nominal_fps();
        if hours >= 24 || minutes >= 60 || seconds >= 60 || frames >= max_f as u8 {
            return Err(LiveStudioError::validation(
                format!("Invalid SMPTE timecode components: {hours:02}:{minutes:02}:{seconds:02}:{frames:02}"),
                Some("timecode"),
            ));
        }

        // Validate drop-frame exclusion rules: in 29.97 DF, frames 0 and 1 are dropped in first second of every minute except minutes 00, 10, 20, 30, 40, 50
        if rate == TimecodeRate::Fps29_97Df && seconds == 0 && (minutes % 10 != 0) && (frames == 0 || frames == 1) {
            return Err(LiveStudioError::validation(
                format!("Drop-frame timecode violation: frame {frames} dropped on minute {minutes:02}"),
                Some("timecode.dropFrame"),
            ));
        }

        Ok(Self {
            hours,
            minutes,
            seconds,
            frames,
            rate,
        })
    }

    pub fn zero(rate: TimecodeRate) -> Self {
        Self {
            hours: 0,
            minutes: 0,
            seconds: 0,
            frames: 0,
            rate,
        }
    }

    pub fn from_total_frames(total_frames: u64, rate: TimecodeRate) -> Self {
        let fps = rate.nominal_fps() as u64;

        if !rate.is_drop_frame() {
            let f = (total_frames % fps) as u8;
            let total_sec = total_frames / fps;
            let s = (total_sec % 60) as u8;
            let total_min = total_sec / 60;
            let m = (total_min % 60) as u8;
            let h = ((total_min / 60) % 24) as u8;

            return Self {
                hours: h,
                minutes: m,
                seconds: s,
                frames: f,
                rate,
            };
        }

        // Drop-frame calculation (SMPTE 12M standard)
        // For 29.97 DF: 2 frames dropped every minute except every 10th minute
        let drop_frames_per_minute: u64 = if rate == TimecodeRate::Fps59_94Df { 4 } else { 2 };
        let frames_per_10_minutes = fps * 600 - drop_frames_per_minute * 9;
        let frames_per_minute = fps * 60 - drop_frames_per_minute;

        let ten_minute_blocks = total_frames / frames_per_10_minutes;
        let remainder_ten = total_frames % frames_per_10_minutes;

        let single_minutes = if remainder_ten < fps * 60 {
            0
        } else {
            (remainder_ten - fps * 60) / frames_per_minute + 1
        };

        let calculated_total_frames = total_frames
            + drop_frames_per_minute * 9 * ten_minute_blocks
            + drop_frames_per_minute * single_minutes;

        let f = (calculated_total_frames % fps) as u8;
        let total_sec = calculated_total_frames / fps;
        let s = (total_sec % 60) as u8;
        let total_min = total_sec / 60;
        let m = (total_min % 60) as u8;
        let h = ((total_min / 60) % 24) as u8;

        Self {
            hours: h,
            minutes: m,
            seconds: s,
            frames: f,
            rate,
        }
    }

    pub fn to_total_frames(&self) -> u64 {
        let fps = self.rate.nominal_fps() as u64;
        let total_minutes = self.hours as u64 * 60 + self.minutes as u64;

        if !self.rate.is_drop_frame() {
            let total_sec = total_minutes * 60 + self.seconds as u64;
            return total_sec * fps + self.frames as u64;
        }

        let drop_frames_per_minute: u64 = if self.rate == TimecodeRate::Fps59_94Df { 4 } else { 2 };
        let total_drop_frames = drop_frames_per_minute * (total_minutes - total_minutes / 10);
        let normal_frames = (total_minutes * 60 + self.seconds as u64) * fps + self.frames as u64;

        normal_frames.saturating_sub(total_drop_frames)
    }

    pub fn add_frames(&self, count: u64) -> Self {
        let total = self.to_total_frames() + count;
        Self::from_total_frames(total, self.rate)
    }

    pub fn format_smpte(&self) -> String {
        let sep = if self.rate.is_drop_frame() { ';' } else { ':' };
        format!(
            "{:02}:{:02}:{:02}{}{:02}",
            self.hours, self.minutes, self.seconds, sep, self.frames
        )
    }
}

impl fmt::Display for SmpteTimecode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.format_smpte())
    }
}

/// Tracks continuity across incoming source frames
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimecodeContinuityTracker {
    pub source_id: String,
    pub last_timecode: Option<SmpteTimecode>,
    pub total_discontinuities: u64,
    pub is_locked: bool,
}

impl TimecodeContinuityTracker {
    pub fn new(source_id: impl Into<String>) -> Self {
        Self {
            source_id: source_id.into(),
            last_timecode: None,
            total_discontinuities: 0,
            is_locked: false,
        }
    }

    pub fn ingest_timecode(&mut self, tc: SmpteTimecode) -> bool {
        let is_continuous = if let Some(last) = self.last_timecode {
            let expected_frames = last.to_total_frames() + 1;
            let actual_frames = tc.to_total_frames();
            actual_frames == expected_frames
        } else {
            true
        };

        if !is_continuous {
            self.total_discontinuities += 1;
        }

        self.last_timecode = Some(tc);
        self.is_locked = true;
        is_continuous
    }
}
