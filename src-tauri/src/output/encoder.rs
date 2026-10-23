use gstreamer as gst;
use tracing::info;

use crate::output::model::{AudioCodec, EncoderCapability, EncoderPreference, OutputProfile, RateControl, VideoCodec};

pub struct EncoderCapabilityAuditor;

impl EncoderCapabilityAuditor {
    /// Detects all supported video and audio encoder elements available in GStreamer
    pub fn audit_capabilities() -> Vec<EncoderCapability> {
        let _ = gst::init();

        let known_video_encoders = vec![
            // NVIDIA NVENC
            ("nvh264enc", "NVIDIA NVENC H.264", "H.264", true, 100),
            ("nvh265enc", "NVIDIA NVENC H.265 (HEVC)", "H.265", true, 95),
            // Intel QuickSync / modern VA-API
            ("vah264enc", "Intel VA-API Hardware H.264", "H.264", true, 92),
            ("qsvh264enc", "Intel QuickSync H.264", "H.264", true, 90),
            ("qsvh265enc", "Intel QuickSync H.265", "H.265", true, 85),
            // Linux VAAPI
            ("vaapih264enc", "Linux VA-API H.264", "H.264", true, 80),
            ("vaapih265enc", "Linux VA-API H.265", "H.265", true, 75),
            // Linux V4L2 Hardware Codec
            ("v4l2h264enc", "V4L2 Hardware H.264", "H.264", true, 70),
            // Software Encoders
            ("x264enc", "libx264 Software H.264", "H.264", false, 50),
            ("openh264enc", "Cisco OpenH264 Software", "H.264", false, 40),
            ("x265enc", "libx265 Software H.265", "H.265", false, 35),
            // AV1 Encoders
            ("nvav1enc", "NVIDIA NVENC AV1", "AV1", true, 92),
            ("qsvav1enc", "Intel QuickSync AV1", "AV1", true, 88),
            ("vaapiav1enc", "Linux VA-API AV1", "AV1", true, 78),
            ("svtav1enc", "SVT-AV1 Software Encoder", "AV1", false, 45),
            ("rav1enc", "rav1e Rust AV1 Encoder", "AV1", false, 35),
            ("av1enc", "AOMedia libaom AV1 Software", "AV1", false, 30),
        ];

        let mut caps = Vec::new();

        for (elem, display_name, codec, is_hw, priority) in known_video_encoders {
            let supported = gst::ElementFactory::find(elem).is_some();
            caps.push(EncoderCapability {
                id: elem.into(),
                display_name: display_name.into(),
                codec: codec.into(),
                is_hardware: is_hw,
                element_name: elem.into(),
                supported,
                priority,
            });
        }

        caps
    }

    /// Selects the best available video encoder element for an output profile
    pub fn select_video_encoder(profile: &OutputProfile) -> (String, bool) {
        let _ = gst::init();

        let (hardware_candidates, software_candidates): (&[&str], &[&str]) = match profile.video_codec {
            VideoCodec::Av1 => (
                &["nvav1enc", "qsvav1enc", "vaapiav1enc"],
                &["svtav1enc", "rav1enc", "av1enc"],
            ),
            VideoCodec::H265 => (
                &["nvh265enc", "qsvh265enc", "vaapih265enc"],
                &["x265enc"],
            ),
            VideoCodec::H264 => (
                &["vah264enc", "nvh264enc", "qsvh264enc", "vaapih264enc", "v4l2h264enc"],
                &["openh264enc", "x264enc"],
            ),
        };

        let is_h265 = profile.video_codec == VideoCodec::H265;

        // If user specifically requested an encoder preference
        match profile.encoder_preference {
            EncoderPreference::Nvenc => {
                let elem = if is_h265 { "nvh265enc" } else { "nvh264enc" };
                if gst::ElementFactory::find(elem).is_some() {
                    return (elem.into(), true);
                }
            }
            EncoderPreference::QuickSync => {
                let elem = if is_h265 { "qsvh265enc" } else { "qsvh264enc" };
                if gst::ElementFactory::find(elem).is_some() {
                    return (elem.into(), true);
                }
            }
            EncoderPreference::Vaapi => {
                let elem = if is_h265 {
                    "vaapih265enc"
                } else if gst::ElementFactory::find("vah264enc").is_some() {
                    "vah264enc"
                } else {
                    "vaapih264enc"
                };
                if gst::ElementFactory::find(elem).is_some() {
                    return (elem.into(), true);
                }
            }
            EncoderPreference::X264 => {
                if gst::ElementFactory::find("x264enc").is_some() {
                    return ("x264enc".into(), false);
                }
            }
            EncoderPreference::SoftwareOnly => {
                for &cand in software_candidates {
                    if gst::ElementFactory::find(cand).is_some() {
                        return (cand.into(), false);
                    }
                }
            }
            EncoderPreference::HardwareOnly => {
                for &cand in hardware_candidates {
                    if gst::ElementFactory::find(cand).is_some() {
                        return (cand.into(), true);
                    }
                }
            }
            EncoderPreference::Auto => {
                // Try hardware first
                for &cand in hardware_candidates {
                    if gst::ElementFactory::find(cand).is_some() {
                        info!("Auto selected hardware encoder: {}", cand);
                        return (cand.into(), true);
                    }
                }
            }
        }

        // Fallback: try software candidates
        for &cand in software_candidates {
            if gst::ElementFactory::find(cand).is_some() {
                info!("Selected software fallback encoder: {}", cand);
                return (cand.into(), false);
            }
        }

        // Absolute fallback
        ("x264enc".into(), false)
    }

    /// Selects the best available audio encoder element
    pub fn select_audio_encoder(codec: AudioCodec) -> String {
        let _ = gst::init();
        match codec {
            AudioCodec::Aac => {
                let aac_candidates = ["fdkaacenc", "avenc_aac", "faac", "voaacenc"];
                for &cand in &aac_candidates {
                    if gst::ElementFactory::find(cand).is_some() {
                        return cand.into();
                    }
                }
                "avenc_aac".into()
            }
            AudioCodec::Opus => {
                if gst::ElementFactory::find("opusenc").is_some() {
                    "opusenc".into()
                } else {
                    Self::select_audio_encoder(AudioCodec::Aac)
                }
            }
        }
    }

    /// Builds the GStreamer video encoding pipeline snippet
    pub fn build_video_encode_bin(profile: &OutputProfile) -> String {
        let (encoder_elem, is_hw) = Self::select_video_encoder(profile);
        let key_int_max = profile.framerate * profile.keyframe_interval_seconds;
        let bitrate_kbps = profile.video_bitrate_kbps;

        let parse_elem = match profile.video_codec {
            VideoCodec::Av1 => "av1parse",
            VideoCodec::H265 => "h265parse",
            VideoCodec::H264 => "h264parse",
        };

        match encoder_elem.as_str() {
            "svtav1enc" => {
                format!(
                    "svtav1enc preset=8 rc-mode=1 bitrate={} ! {}",
                    bitrate_kbps, parse_elem
                )
            }
            "x265enc" => {
                format!(
                    "x265enc tune=zerolatency speed-preset=veryfast bitrate={} key-int-max={} ! {}",
                    bitrate_kbps, key_int_max, parse_elem
                )
            }
            "x264enc" => {
                format!(
                    "x264enc pass=cbr bitrate={} key-int-max={} bframes=0 threads=0 tune=zerolatency speed-preset=veryfast ! video/x-h264,profile=main ! {} config-interval=-1",
                    bitrate_kbps, key_int_max, parse_elem
                )
            }
            "openh264enc" => {
                format!(
                    "openh264enc rate-control=bitrate bitrate={} gop-size={} complexity=high ! {} config-interval=-1",
                    bitrate_kbps * 1000, key_int_max, parse_elem
                )
            }
            "nvh264enc" => {
                let rc = match profile.rate_control {
                    RateControl::Cbr => "cbr",
                    RateControl::Vbr => "vbr",
                };
                format!(
                    "nvh264enc rc-mode={} bitrate={} gop-size={} ! {} config-interval=-1",
                    rc, bitrate_kbps, key_int_max, parse_elem
                )
            }
            "vah264enc" => {
                let rc = match profile.rate_control {
                    RateControl::Cbr => "cbr",
                    RateControl::Vbr => "vbr",
                };
                format!(
                    "vah264enc rate-control={} bitrate={} key-int-max={} b-frames=0 target-usage=4 aud=true ! {} config-interval=-1",
                    rc, bitrate_kbps, key_int_max, parse_elem
                )
            }
            "vaapih264enc" => {
                let rc = match profile.rate_control {
                    RateControl::Cbr => "cbr",
                    RateControl::Vbr => "vbr",
                };
                format!(
                    "vaapih264enc rate-control={} bitrate={} keyframe-period={} ! {} config-interval=-1",
                    rc, bitrate_kbps, key_int_max, parse_elem
                )
            }
            "qsvh264enc" => {
                format!(
                    "qsvh264enc ratecontrol=1 bitrate={} gop-size={} ! {}",
                    bitrate_kbps, key_int_max, parse_elem
                )
            }
            _ => {
                if is_hw {
                    format!("{} bitrate={} ! {}", encoder_elem, bitrate_kbps, parse_elem)
                } else {
                    format!(
                        "x264enc pass=cbr bitrate={} key-int-max={} bframes=0 threads=0 tune=zerolatency speed-preset=veryfast ! video/x-h264,profile=main ! {} config-interval=-1",
                        bitrate_kbps, key_int_max, parse_elem
                    )
                }
            }
        }
    }

    /// Builds the GStreamer audio encoding pipeline snippet
    pub fn build_audio_encode_bin(profile: &OutputProfile) -> String {
        let audio_elem = Self::select_audio_encoder(profile.audio_codec);
        let audio_bitrate_bps = profile.audio_bitrate_kbps * 1000;

        match audio_elem.as_str() {
            "fdkaacenc" => {
                format!("fdkaacenc bitrate={} ! aacparse", audio_bitrate_bps)
            }
            "avenc_aac" => {
                format!("avenc_aac bitrate={} ! aacparse", audio_bitrate_bps)
            }
            "faac" => {
                format!("faac bitrate={} ! aacparse", audio_bitrate_bps)
            }
            "opusenc" => {
                format!("opusenc bitrate={} ! opusparse", audio_bitrate_bps)
            }
            _ => "avenc_aac bitrate=160000 ! aacparse".into(),
        }
    }
}
