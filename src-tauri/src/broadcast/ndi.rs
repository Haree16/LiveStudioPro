use serde::{Deserialize, Serialize};
use std::path::Path;
use tracing::info;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NdiSourceInfo {
    pub name: String,
    pub url_or_ip: String,
    pub is_ndi_hx: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NdiEcosystemStatus {
    pub is_installed: bool,
    pub library_path: Option<String>,
    pub sdk_version: Option<String>,
    pub gstreamer_plugin_found: bool,
    pub download_url: String,
}

pub struct NdiEcosystemManager;

impl NdiEcosystemManager {
    /// Probes system for NewTek NDI SDK dynamic libraries and GStreamer NDI elements
    pub fn probe_ecosystem() -> NdiEcosystemStatus {
        let _ = gstreamer::init();
        let (is_installed, library_path, sdk_version) = Self::detect_system_library();
        let gst_plugin_found = gstreamer::ElementFactory::find("ndisrc").is_some()
            && gstreamer::ElementFactory::find("ndisink").is_some();

        NdiEcosystemStatus {
            is_installed,
            library_path,
            sdk_version,
            gstreamer_plugin_found: gst_plugin_found,
            download_url: "https://ndi.video/tools/ndi-core-suite/".into(),
        }
    }

    /// Detects presence of NDI shared library on host filesystem
    fn detect_system_library() -> (bool, Option<String>, Option<String>) {
        #[cfg(target_os = "linux")]
        {
            let search_paths = [
                "/usr/lib/libndi.so",
                "/usr/lib/x86_64-linux-gnu/libndi.so",
                "/usr/local/lib/libndi.so",
                "/usr/lib/libndi.so.6",
                "/usr/lib/libndi.so.5",
                "/opt/ndi/lib/x86_64-linux-gnu/libndi.so",
            ];

            for path in search_paths {
                if Path::new(path).exists() {
                    info!("Found host NDI library: {path}");
                    return (true, Some(path.to_string()), Some("NDI 6.0".into()));
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            let search_paths = [
                "C:\\Program Files\\NewTek\\NDI 6 SDK\\Bin\\x64\\Processing.NDI.Lib.x64.dll",
                "C:\\Program Files\\NewTek\\NDI 5 SDK\\Bin\\x64\\Processing.NDI.Lib.x64.dll",
                "C:\\Windows\\System32\\Processing.NDI.Lib.x64.dll",
            ];

            for path in search_paths {
                if Path::new(path).exists() {
                    info!("Found host NDI library: {path}");
                    return (true, Some(path.to_string()), Some("NDI 6.0".into()));
                }
            }
        }

        (false, None, None)
    }

    /// Builds GStreamer NDI input pipeline description
    pub fn build_ndi_input_pipeline(source_name: &str, low_bandwidth: bool) -> String {
        let low_bw_flag = if low_bandwidth { " low-bandwidth=true" } else { "" };
        format!(
            "ndisrc source-name=\"{}\"{} ! videoconvert ! video/x-raw,format=RGBA ! appsink name=sink sync=false",
            source_name, low_bw_flag
        )
    }

    /// Builds GStreamer NDI output pipeline description
    pub fn build_ndi_output_pipeline(stream_name: &str) -> String {
        format!(
            "appsrc name=ndisrc is-live=true format=time ! videoconvert ! video/x-raw,format=UYVY ! ndisink stream-name=\"{}\"",
            stream_name
        )
    }
}
