use serde::{Deserialize, Serialize};
use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum DeviceType {
    VideoCapture,
    AudioCapture,
    AudioOutput,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceFormatOption {
    pub width: u32,
    pub height: u32,
    pub framerates: Vec<f64>,
    pub pixel_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDescriptor {
    pub id: String,
    pub name: String,
    pub device_type: DeviceType,
    pub api_backend: String,
    pub path_or_uid: String,
    pub formats: Vec<String>,
    #[serde(default)]
    pub format_options: Vec<DeviceFormatOption>,
    pub is_default: bool,
    pub is_available: bool,
}

pub trait DeviceEnumerator: Send + Sync {
    fn enumerate_all(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError>;
    fn enumerate_video_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError>;
    fn enumerate_audio_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError>;
    fn query_device_formats(&self, device_path: &str) -> Vec<DeviceFormatOption>;
}
