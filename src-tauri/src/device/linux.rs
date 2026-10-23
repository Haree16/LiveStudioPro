use std::fs;
use std::path::Path;
use gstreamer as gst;
use gstreamer::prelude::*;
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::device::enumerator::{DeviceDescriptor, DeviceEnumerator, DeviceFormatOption, DeviceType};

pub struct LinuxDeviceEnumerator;

impl LinuxDeviceEnumerator {
    pub fn new() -> Self {
        Self
    }

    fn scan_v4l2_sysfs(&self) -> Vec<DeviceDescriptor> {
        let mut devices = Vec::new();
        let sysfs_v4l = Path::new("/sys/class/video4linux");

        if let Ok(entries) = fs::read_dir(sysfs_v4l) {
            for entry in entries.flatten() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                if dir_name.starts_with("video") {
                    let dev_node = format!("/dev/{dir_name}");
                    let name_path = entry.path().join("name");
                    let human_name = fs::read_to_string(name_path)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_else(|_| dir_name.clone());

                    let index_path = entry.path().join("index");
                    let index = fs::read_to_string(index_path)
                        .ok()
                        .and_then(|s| s.trim().parse::<u32>().ok())
                        .unwrap_or(0);

                    // On Linux UVC cameras, index 0 is video capture, while index > 0 are metadata streams
                    if index > 0 {
                        continue;
                    }

                    let is_ir = human_name.to_lowercase().contains("ir ") 
                        || human_name.to_lowercase().contains("infrared")
                        || human_name.contains("IR");

                    let display_label = if is_ir {
                        format!("{human_name} (Infrared Sensor)")
                    } else {
                        format!("{human_name} (Color Webcam)")
                    };

                    let is_available = Path::new(&dev_node).exists();
                    let format_options = self.query_device_formats(&dev_node);

                    devices.push(DeviceDescriptor {
                        id: format!("v4l2:{dir_name}"),
                        name: display_label,
                        device_type: DeviceType::VideoCapture,
                        api_backend: "V4L2".into(),
                        path_or_uid: dev_node,
                        formats: if is_ir {
                            vec!["GREY".into()]
                        } else {
                            vec!["MJPEG".into(), "YUY2".into()]
                        },
                        format_options,
                        is_default: false,
                        is_available,
                    });
                }
            }
        }

        // Sort so primary color webcams appear before infrared sensors
        devices.sort_by_key(|d| if d.name.contains("Infrared") { 1 } else { 0 });
        if let Some(first) = devices.first_mut() {
            first.is_default = true;
        }

        devices
    }

    fn scan_gst_device_monitor(&self) -> Vec<DeviceDescriptor> {
        let mut devices = Vec::new();
        let _ = gst::init();

        let monitor = gst::DeviceMonitor::new();
        let _ = monitor.add_filter(Some("Audio/Source"), None);
        let _ = monitor.add_filter(Some("Video/Source"), None);

        if monitor.start().is_err() {
            warn!("Failed to start GStreamer DeviceMonitor");
            return devices;
        }

        for dev in monitor.devices() {
            let display_name = dev.display_name().to_string();
            let device_class = dev.device_class().to_string();
            let properties = dev.properties();

            let (dev_type, backend) = if device_class.contains("Video") {
                (DeviceType::VideoCapture, "GStreamer Video")
            } else {
                (DeviceType::AudioCapture, "Pulse/ALSA/PipeWire")
            };

            let path_or_uid = properties
                .and_then(|p| p.get::<String>("device.path").ok())
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
                id: format!("gst:{display_name}"),
                name: display_name,
                device_type: dev_type,
                api_backend: backend.into(),
                path_or_uid,
                formats,
                format_options,
                is_default: false,
                is_available: true,
            });
        }

        monitor.stop();
        devices
    }
}

impl DeviceEnumerator for LinuxDeviceEnumerator {
    fn enumerate_all(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> {
        let mut v4l2_devices = self.scan_v4l2_sysfs();
        let gst_devices = self.scan_gst_device_monitor();

        for gst_dev in gst_devices {
            if gst_dev.device_type == DeviceType::AudioCapture {
                v4l2_devices.push(gst_dev);
            } else if !v4l2_devices.iter().any(|d| d.path_or_uid == gst_dev.path_or_uid) {
                v4l2_devices.push(gst_dev);
            }
        }

        info!("Discovered {} total devices on Linux", v4l2_devices.len());
        Ok(v4l2_devices)
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

    fn query_device_formats(&self, device_path: &str) -> Vec<DeviceFormatOption> {
        if device_path.ends_with("video2") || device_path.ends_with("video3") {
            vec![
                DeviceFormatOption {
                    width: 640,
                    height: 360,
                    framerates: vec![30.0],
                    pixel_format: "GREY".into(),
                },
            ]
        } else {
            vec![
                DeviceFormatOption {
                    width: 1920,
                    height: 1080,
                    framerates: vec![30.0, 24.0],
                    pixel_format: "MJPEG".into(),
                },
                DeviceFormatOption {
                    width: 1280,
                    height: 720,
                    framerates: vec![30.0],
                    pixel_format: "MJPEG".into(),
                },
                DeviceFormatOption {
                    width: 640,
                    height: 360,
                    framerates: vec![30.0],
                    pixel_format: "YUY2".into(),
                },
            ]
        }
    }
}
