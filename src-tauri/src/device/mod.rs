pub mod enumerator;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

// Fallback module for other platforms/tests
#[cfg(not(any(target_os = "linux", target_os = "windows")))]
pub mod fallback {
    use super::enumerator::*;
    use crate::core::error::LiveStudioError;

    pub struct GenericDeviceEnumerator;
    impl GenericDeviceEnumerator {
        pub fn new() -> Self { Self }
    }
    impl DeviceEnumerator for GenericDeviceEnumerator {
        fn enumerate_all(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> { Ok(Vec::new()) }
        fn enumerate_video_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> { Ok(Vec::new()) }
        fn enumerate_audio_inputs(&self) -> Result<Vec<DeviceDescriptor>, LiveStudioError> { Ok(Vec::new()) }
        fn query_device_formats(&self, _device_path: &str) -> Vec<DeviceFormatOption> { Vec::new() }
    }
}

pub use enumerator::{DeviceDescriptor, DeviceEnumerator, DeviceFormatOption, DeviceType};

use std::sync::Arc;

pub fn create_platform_enumerator() -> Arc<dyn DeviceEnumerator> {
    #[cfg(target_os = "linux")]
    {
        Arc::new(linux::LinuxDeviceEnumerator::new())
    }
    #[cfg(target_os = "windows")]
    {
        Arc::new(windows::WindowsDeviceEnumerator::new())
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows")))]
    {
        Arc::new(fallback::GenericDeviceEnumerator::new())
    }
}
