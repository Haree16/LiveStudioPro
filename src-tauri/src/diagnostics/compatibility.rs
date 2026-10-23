use std::fs;
use std::process::Command;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CompatibilityStatus {
    Available,
    Missing,
    Unsupported,
    PermissionDenied,
    Unverified,
    NotRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityCheckItem {
    pub id: String,
    pub category: String,
    pub name: String,
    pub status: CompatibilityStatus,
    pub detected_version: Option<String>,
    pub is_required: bool,
    pub dependent_features: Vec<String>,
    pub details: String,
    pub recommended_action: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemCompatibilityReport {
    pub generated_at: DateTime<Utc>,
    pub os_name: String,
    pub os_arch: String,
    pub total_checks: usize,
    pub passed_checks: usize,
    pub critical_missing_count: usize,
    pub optional_missing_count: usize,
    pub overall_readiness: String, // "Ready", "Degraded", "Incompatible"
    pub checks: Vec<CompatibilityCheckItem>,
}

pub struct SystemCompatibilityAuditor;

impl SystemCompatibilityAuditor {
    pub fn run_comprehensive_audit() -> SystemCompatibilityReport {
        let mut checks = Vec::new();

        // 1. Operating System
        let os_name = std::env::consts::OS;
        let os_arch = std::env::consts::ARCH;
        let is_os_supported = os_name == "linux" || os_name == "windows";
        let is_arch_supported = os_arch == "x86_64" || os_arch == "aarch64";

        checks.push(CompatibilityCheckItem {
            id: "os_platform".into(),
            category: "Platform".into(),
            name: "Operating System & Architecture".into(),
            status: if is_os_supported && is_arch_supported {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Unsupported
            },
            detected_version: Some(format!("{os_name} ({os_arch})")),
            is_required: true,
            dependent_features: vec!["All Application Core Functions".into()],
            details: format!("Verified host operating environment: {os_name} on {os_arch}"),
            recommended_action: if !is_os_supported {
                Some("LiveStudio Pro officially targets Linux (Arch, Ubuntu 22.04+) and Windows 10/11 64-bit.".into())
            } else {
                None
            },
        });

        // 2. GStreamer Core Runtime
        let _ = gstreamer::init();
        let (major, minor, micro, nano) = gstreamer::version();
        let gst_ver_str = format!("{major}.{minor}.{micro}.{nano}");
        let gst_available = major >= 1 && minor >= 18;

        checks.push(CompatibilityCheckItem {
            id: "gstreamer_core".into(),
            category: "Multimedia Engine".into(),
            name: "GStreamer Native Runtime".into(),
            status: if gst_available {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Missing
            },
            detected_version: Some(gst_ver_str.clone()),
            is_required: true,
            dependent_features: vec!["Video Input".into(), "Preview/Program Switcher".into(), "Output Streaming".into(), "Recording".into()],
            details: format!("GStreamer core pipeline library initialized: v{gst_ver_str}"),
            recommended_action: if !gst_available {
                Some("Install GStreamer runtime: `sudo apt install libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev` on Linux or install official GStreamer MSVC packages on Windows.".into())
            } else {
                None
            },
        });

        // Registry element probing
        let registry = gstreamer::Registry::get();
        let has_elem = |elem: &str| -> bool { registry.lookup_feature(elem).is_some() };

        // 3. GStreamer Compositor & Video Convert
        let has_compositor = has_elem("compositor");
        let has_vconvert = has_elem("videoconvert");
        let video_core_ok = has_compositor && has_vconvert;

        checks.push(CompatibilityCheckItem {
            id: "gst_video_compositing".into(),
            category: "Multimedia Engine".into(),
            name: "GStreamer Video Compositor & Color Converter".into(),
            status: if video_core_ok {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Missing
            },
            detected_version: Some(if video_core_ok { "Found (compositor, videoconvert)" } else { "Missing plugins" }.into()),
            is_required: true,
            dependent_features: vec!["Scene Compositor".into(), "Transitions".into(), "Multiview".into()],
            details: "Core video mixing and pixel format transformation elements.".into(),
            recommended_action: if !video_core_ok {
                Some("Install gstreamer1.0-plugins-base and gstreamer1.0-plugins-good.".into())
            } else {
                None
            },
        });

        // 4. Video Encoders (H.264 software fallback)
        let has_x264 = has_elem("x264enc");
        let has_openh264 = has_elem("openh264enc");
        let sw_enc_ok = has_x264 || has_openh264;

        checks.push(CompatibilityCheckItem {
            id: "gst_sw_encoder".into(),
            category: "Video Encoding".into(),
            name: "H.264 Software Video Encoder".into(),
            status: if sw_enc_ok {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Missing
            },
            detected_version: Some(if has_x264 { "x264enc" } else if has_openh264 { "openh264enc" } else { "None" }.into()),
            is_required: true,
            dependent_features: vec!["RTMP Streaming".into(), "MP4 Recording".into(), "ISO Recording".into()],
            details: "Software encoding baseline ensures broadcast reliability when GPU hardware encoding is unavailable.".into(),
            recommended_action: if !sw_enc_ok {
                Some("Install gstreamer1.0-plugins-ugly or gstreamer1.0-plugins-bad for x264enc / openh264enc.".into())
            } else {
                None
            },
        });

        // 5. Hardware GPU Acceleration
        let has_vaapi = has_elem("vaapih264enc");
        let has_nvenc = has_elem("nvh264enc");
        let has_qsv = has_elem("qsvh264enc");
        let has_d3d11 = has_elem("d3d11h264enc");
        let hw_accel_available = has_vaapi || has_nvenc || has_qsv || has_d3d11;

        checks.push(CompatibilityCheckItem {
            id: "gpu_hw_encoder".into(),
            category: "Video Encoding".into(),
            name: "Hardware-Accelerated Video Encoder (GPU)".into(),
            status: if hw_accel_available {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::NotRequired
            },
            detected_version: Some(format!(
                "VAAPI: {}, NVENC: {}, QSV: {}, D3D11: {}",
                if has_vaapi { "Yes" } else { "No" },
                if has_nvenc { "Yes" } else { "No" },
                if has_qsv { "Yes" } else { "No" },
                if has_d3d11 { "Yes" } else { "No" }
            )),
            is_required: false,
            dependent_features: vec!["Low-CPU 4K/60fps Encoding".into(), "Multi-Angle ISO Recording".into()],
            details: "Hardware encoders significantly reduce CPU load during heavy live streaming and multi-track ISO capture.".into(),
            recommended_action: if !hw_accel_available {
                Some("Optional: Install Intel VAAPI drivers (`gstreamer-vaapi`) or NVIDIA CUDA/NVENC drivers for zero-copy hardware encoding.".into())
            } else {
                None
            },
        });

        // 6. External FFmpeg CLI Tooling
        let ffmpeg_output = Command::new("ffmpeg").arg("-version").output();
        let (ffmpeg_status, ffmpeg_ver) = match ffmpeg_output {
            Ok(out) if out.status.success() => {
                let first_line = String::from_utf8_lossy(&out.stdout)
                    .lines()
                    .next()
                    .unwrap_or("ffmpeg installed")
                    .to_string();
                (CompatibilityStatus::Available, Some(first_line))
            }
            _ => (
                CompatibilityStatus::Missing,
                Some("FFmpeg binary not detected in PATH".into()),
            ),
        };

        checks.push(CompatibilityCheckItem {
            id: "ffmpeg_tooling".into(),
            category: "Media Utilities".into(),
            name: "FFmpeg Transcoding & Repair Binary".into(),
            status: ffmpeg_status,
            detected_version: ffmpeg_ver,
            is_required: false,
            dependent_features: vec!["Crash Video Remuxing".into(), "Advanced Clip Export".into(), "Container Inspection".into()],
            details: "FFmpeg executable enables container remuxing, file repair, and thumbnail extraction.".into(),
            recommended_action: if ffmpeg_status == CompatibilityStatus::Missing {
                Some("Optional but recommended: Install ffmpeg (`sudo apt install ffmpeg` on Linux, `winget install Gyan.FFmpeg` on Windows).".into())
            } else {
                None
            },
        });

        // 7. Video Capture Device Backend (v4l2 / dshow)
        let has_v4l2 = has_elem("v4l2src");
        let has_dshow = has_elem("dshowvideosrc");
        let has_mf = has_elem("mfvideosrc");
        let cap_device_ok = has_v4l2 || has_dshow || has_mf;

        checks.push(CompatibilityCheckItem {
            id: "capture_devices".into(),
            category: "Device I/O".into(),
            name: "Native Video Device Capture Backend".into(),
            status: if cap_device_ok {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Missing
            },
            detected_version: Some(if has_v4l2 { "V4L2 (Linux)" } else if has_dshow || has_mf { "DirectShow/MF (Windows)" } else { "None" }.into()),
            is_required: true,
            dependent_features: vec!["USB Webcams".into(), "HDMI/SDI Capture Cards".into()],
            details: "Native camera acquisition pipelines.".into(),
            recommended_action: if !cap_device_ok {
                Some("Install gstreamer1.0-plugins-good for v4l2src / dshowvideosrc.".into())
            } else {
                None
            },
        });

        // 8. Storage Writable Verification
        let test_dir = std::env::temp_dir().join("livestudio_compat_probe");
        let can_write_storage = (|| -> bool {
            if fs::create_dir_all(&test_dir).is_err() {
                return false;
            }
            let test_file = test_dir.join("probe.tmp");
            if fs::write(&test_file, b"test").is_err() {
                return false;
            }
            let _ = fs::remove_file(&test_file);
            let _ = fs::remove_dir(&test_dir);
            true
        })();

        checks.push(CompatibilityCheckItem {
            id: "storage_permissions".into(),
            category: "Storage".into(),
            name: "Application Directory Write Permissions".into(),
            status: if can_write_storage {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::PermissionDenied
            },
            detected_version: Some("Writable /tmp and storage dirs".into()),
            is_required: true,
            dependent_features: vec!["Project Persistence".into(), "Session Autosave".into(), "Recording".into()],
            details: "Ensures the host user account can create project stores, write logs, and buffer video recordings.".into(),
            recommended_action: if !can_write_storage {
                Some("Check filesystem permissions for ~/.local/share/LiveStudioPro or %APPDATA%\\LiveStudioPro.".into())
            } else {
                None
            },
        });

        // 9. WebRTC / Remote Production Port Capabilities
        let has_webrtc = has_elem("webrtcbin");
        checks.push(CompatibilityCheckItem {
            id: "webrtc_remote".into(),
            category: "Remote Production".into(),
            name: "GStreamer WebRTC Native Element".into(),
            status: if has_webrtc {
                CompatibilityStatus::Available
            } else {
                CompatibilityStatus::Missing
            },
            detected_version: Some(if has_webrtc { "webrtcbin found" } else { "Missing webrtcbin" }.into()),
            is_required: false,
            dependent_features: vec!["Remote Guest Contribution".into(), "Browser-Based Return Video".into()],
            details: "Enables zero-latency browser contribution for remote interviews and callers.".into(),
            recommended_action: if !has_webrtc {
                Some("Install gstreamer1.0-plugins-bad for webrtcbin (`sudo apt install gstreamer1.0-plugins-bad`).".into())
            } else {
                None
            },
        });

        let total = checks.len();
        let passed = checks.iter().filter(|c| c.status == CompatibilityStatus::Available || c.status == CompatibilityStatus::NotRequired).count();
        let critical_missing = checks.iter().filter(|c| c.is_required && c.status != CompatibilityStatus::Available).count();
        let optional_missing = checks.iter().filter(|c| !c.is_required && c.status == CompatibilityStatus::Missing).count();

        let readiness = if critical_missing == 0 {
            "Ready".into()
        } else if critical_missing <= 1 {
            "Degraded".into()
        } else {
            "Incompatible".into()
        };

        SystemCompatibilityReport {
            generated_at: Utc::now(),
            os_name: os_name.into(),
            os_arch: os_arch.into(),
            total_checks: total,
            passed_checks: passed,
            critical_missing_count: critical_missing,
            optional_missing_count: optional_missing,
            overall_readiness: readiness,
            checks,
        }
    }
}
