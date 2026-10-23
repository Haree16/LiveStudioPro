use gstreamer as gst;
use gstreamer::prelude::*;
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::device::enumerator::{DeviceDescriptor, DeviceEnumerator, DeviceFormatOption, DeviceType};

pub struct WindowsDeviceEnumerator;

impl WindowsDeviceEnumerator {
    pub fn new() -> Self {
        Self
    }
}

impl DeviceEnumerator for WindowsDeviceEnumerator {
    fn enumerate_all(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> {
        let mut devices = Vec::new();
        let _ = gst::init();

        let monitor = gst::DeviceMonitor::new();
        let _ = monitor.add_filter(Some("Audio/Source"), None);
        let _ = monitor.add_filter(Some("Video/Source"), None);

        if monitor.start().is_err() {
            warn!("Failed to start GStreamer DeviceMonitor on Windows");
            return Ok(devices);
        }

        for dev in monitor.devices() {
            let display_name = dev.display_name().to_string();
            let device_class = dev.device_class().to_string();
            let properties = dev.properties();

            let (dev_type, backend) = if device_class.contains("Video") {
                (DeviceType::VideoCapture, "MediaFoundation / DirectShow")
            } else {
                (DeviceType::AudioCapture, "WASAPI / DirectSound")
            };

            let path_or_uid = properties
                .and_then(|p| p.get::<String>("device.strid").or_else(|_| p.get::<String>("device.path")).ok())
                .unwrap_or_else(|| display_name.clone());

            let mut formats = Vec::new();
            let mut format_options = Vec::new();

            if let Some(caps) = dev.caps() {
                for i in 0..caps.size() {
                    if let Some(st) = caps.structure(i) {
                        let name = st.name().to_string();
                        if !formats.contains(&name) {
                            formats.push(name.clone());
                        }

                        if let (Ok(width), Ok(height)) = (st.get::<i32>("width"), st.get::<i32>("height")) {
                            if width > 0 && height > 0 {
                                format_options.push(DeviceFormatOption {
                                    width: width as u32,
                                    height: height as u32,
                                    framerates: vec![30.0, 60.0],
                                    pixel_format: name,
                                });
                            }
                        }
                    }
                }
            }

            devices.push(DeviceDescriptor {
                id: format!("win:{display_name}"),
                name: display_name,
                device_type: dev_type,
                api_backend: backend.into(),
                path_or_uid,
                formats,
                format_options,
                is_default: devices.is_empty(),
                is_available: true,
            });
        }

        monitor.stop();
        info!("Discovered {} total devices on Windows", devices.len());
        Ok(devices)
    }

    fn enumerate_video_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> {
        let all = self.enumerate_all()?;
        Ok(all
            .into_iter()
            .filter(|d| d.device_type == DeviceType::VideoCapture)
            .collect())
    }

    fn enumerate_audio_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> {
        let all = self.enumerate_all()?;
        Ok(all
            .into_iter()
            .filter(|d| d.device_type == DeviceType::AudioCapture)
            .collect())
    }

    fn query_device_formats(&self, _device_path: &str) -> Vec<DeviceFormatOption> {
        vec![
            DeviceFormatOption {
                width: 1920,
                height: 1080,
                framerates: vec![30.0, 60.0],
                pixel_format: "NV12".into(),
            },
            DeviceFormatOption {
                width: 1280,
                height: 720,
                framerates: vec![30.0, 60.0],
                pixel_format: "YUY2".into(),
            },
        ]
    }
}
