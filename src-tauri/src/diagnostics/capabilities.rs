use gstreamer as gst;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginCapabilityReport {
    pub name: String,
    pub category: String,
    pub element_name: String,
    pub is_available: bool,
    pub description: String,
    pub required_package_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareEncoderReport {
    pub vendor: String,
    pub technology: String,
    pub h264_supported: bool,
    pub hevc_supported: bool,
    pub av1_supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub gstreamer_version: String,
    pub os_name: String,
    pub os_arch: String,
    pub plugins: Vec<PluginCapabilityReport>,
    pub hardware_encoders: Vec<HardwareEncoderReport>,
    pub critical_missing_dependencies: Vec<String>,
}

pub struct CapabilityAuditor;

impl CapabilityAuditor {
    pub fn audit() -> DiagnosticsReport {
        let _ = gst::init();

        let (major, minor, micro, nano) = gst::version();
        let gstreamer_version = format!("{major}.{minor}.{micro}.{nano}");

        let registry = gst::Registry::get();

        let check_element = |elem_name: &str| -> bool {
            registry.lookup_feature(elem_name).is_some()
        };

        let mut plugins = Vec::new();

        // Hardware Encoders & Decoders
        let vaapi_h264 = check_element("vaapih264enc");
        let vaapi_h265 = check_element("vaapih265enc");
        let nv_h264 = check_element("nvh264enc");
        let nv_h265 = check_element("nvh265enc");
        let qsv_h264 = check_element("qsvh264enc");
        let qsv_h265 = check_element("qsvh265enc");
        let d3d11_h264 = check_element("d3d11h264enc");

        plugins.push(PluginCapabilityReport {
            name: "VA-API Hardware Acceleration".into(),
            category: "Hardware Codec".into(),
            element_name: "vaapih264enc".into(),
            is_available: vaapi_h264,
            description: "Linux VA-API GPU-accelerated video encode".into(),
            required_package_hint: Some("gstreamer-vaapi (Arch) or gstreamer1.0-vaapi (Ubuntu)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "NVIDIA NVENC H.264".into(),
            category: "Hardware Codec".into(),
            element_name: "nvh264enc".into(),
            is_available: nv_h264,
            description: "NVIDIA GPU NVENC hardware encoder".into(),
            required_package_hint: Some("gst-plugins-bad with nvcodec support and NVIDIA driver".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "Intel QuickSync Video H.264".into(),
            category: "Hardware Codec".into(),
            element_name: "qsvh264enc".into(),
            is_available: qsv_h264,
            description: "Intel QSV hardware video encoder".into(),
            required_package_hint: Some("gst-plugins-bad with qsv support".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "Direct3D 11 Video".into(),
            category: "Hardware Codec".into(),
            element_name: "d3d11h264enc".into(),
            is_available: d3d11_h264,
            description: "Windows Direct3D11 hardware encoder".into(),
            required_package_hint: Some("GStreamer Windows MSVC package (d3d11 plugin)".into()),
        });

        // Software Encoders
        let x264 = check_element("x264enc");
        let openh264 = check_element("openh264enc");
        let vp8 = check_element("vp8enc");
        let vp9 = check_element("vp9enc");
        let av1 = check_element("rav1enc") || check_element("svtav1enc");

        plugins.push(PluginCapabilityReport {
            name: "x264 Software H.264".into(),
            category: "Software Codec".into(),
            element_name: "x264enc".into(),
            is_available: x264,
            description: "Standard high quality x264 encoder".into(),
            required_package_hint: Some("gst-plugins-ugly (x264)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "OpenH264 Software Codec".into(),
            category: "Software Codec".into(),
            element_name: "openh264enc".into(),
            is_available: openh264,
            description: "Cisco OpenH264 encoder".into(),
            required_package_hint: Some("gst-plugins-bad (openh264)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "VP8 / VP9 WebM Codecs".into(),
            category: "Software Codec".into(),
            element_name: "vp8enc".into(),
            is_available: vp8 || vp9,
            description: "VP8/VP9 open video encoders".into(),
            required_package_hint: Some("gst-plugins-good (vpx)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "AV1 Next-Gen Codec".into(),
            category: "Software Codec".into(),
            element_name: "rav1enc".into(),
            is_available: av1,
            description: "Next-generation AV1 video encoder".into(),
            required_package_hint: Some("gst-plugins-bad (rav1e / svt-av1)".into()),
        });

        // Capture sources
        let v4l2 = check_element("v4l2src");
        let dshow = check_element("dshowvideosrc");
        let mfvideo = check_element("mfvideosrc");
        let pulse = check_element("pulsesrc");
        let pipewire = check_element("pipewiresrc");
        let wasapi = check_element("wasapisrc");

        plugins.push(PluginCapabilityReport {
            name: "Video4Linux2 Capture".into(),
            category: "Video Capture".into(),
            element_name: "v4l2src".into(),
            is_available: v4l2,
            description: "Linux camera & capture card source".into(),
            required_package_hint: Some("gst-plugins-good (v4l2)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "DirectShow / MediaFoundation Capture".into(),
            category: "Video Capture".into(),
            element_name: "dshowvideosrc".into(),
            is_available: dshow || mfvideo,
            description: "Windows camera & capture card sources".into(),
            required_package_hint: Some("GStreamer Windows MSVC (dshowsrc / mfsrc)".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "PulseAudio / PipeWire Audio Source".into(),
            category: "Audio Capture".into(),
            element_name: "pulsesrc".into(),
            is_available: pulse || pipewire,
            description: "Linux audio device capture".into(),
            required_package_hint: Some("gst-plugins-good (pulse) or pipewire-gstreamer".into()),
        });

        plugins.push(PluginCapabilityReport {
            name: "Windows WASAPI Audio Source".into(),
            category: "Audio Capture".into(),
            element_name: "wasapisrc".into(),
            is_available: wasapi,
            description: "Windows native audio capture".into(),
            required_package_hint: Some("gst-plugins-bad (wasapi)".into()),
        });

        // Hardware encoder synthesis
        let mut hardware_encoders = Vec::new();
        if vaapi_h264 || vaapi_h265 {
            hardware_encoders.push(HardwareEncoderReport {
                vendor: "Intel / AMD (VA-API)".into(),
                technology: "VA-API".into(),
                h264_supported: vaapi_h264,
                hevc_supported: vaapi_h265,
                av1_supported: check_element("vaapiav1enc"),
            });
        }
        if nv_h264 || nv_h265 {
            hardware_encoders.push(HardwareEncoderReport {
                vendor: "NVIDIA".into(),
                technology: "NVENC".into(),
                h264_supported: nv_h264,
                hevc_supported: nv_h265,
                av1_supported: check_element("nvav1enc"),
            });
        }
        if qsv_h264 || qsv_h265 {
            hardware_encoders.push(HardwareEncoderReport {
                vendor: "Intel".into(),
                technology: "QuickSync".into(),
                h264_supported: qsv_h264,
                hevc_supported: qsv_h265,
                av1_supported: check_element("qsvav1enc"),
            });
        }

        // Check for missing critical elements
        let mut critical_missing_dependencies = Vec::new();
        if !check_element("videotestsrc") {
            critical_missing_dependencies.push("videotestsrc (from gst-plugins-base) is missing".into());
        }
        if !check_element("fakesink") {
            critical_missing_dependencies.push("fakesink (from gst-plugins-base) is missing".into());
        }

        #[cfg(target_os = "linux")]
        {
            if !v4l2 {
                critical_missing_dependencies.push("v4l2src is missing (install gst-plugins-good)".into());
            }
        }

        DiagnosticsReport {
            gstreamer_version,
            os_name: std::env::consts::OS.into(),
            os_arch: std::env::consts::ARCH.into(),
            plugins,
            hardware_encoders,
            critical_missing_dependencies,
        }
    }
}
