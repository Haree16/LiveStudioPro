pub mod aux_output;
pub mod color;
pub mod delay;
pub mod diagnostics;
pub mod hardware;
pub mod iso;
pub mod ndi;
pub mod scopes;
pub mod sdi_playout;
pub mod timecode;
pub mod virtual_studio;

use std::sync::Arc;

use aux_output::AuxOutputEngine;
use color::ColorGradeEngine;
use delay::DelayBufferManager;
use diagnostics::BroadcastDiagnosticsManager;
use hardware::BroadcastHardwareManager;
use iso::IsoRecordingEngine;
use virtual_studio::VirtualStudioEngine;

#[derive(Clone)]
pub struct BroadcastEngine {
    pub iso_engine: Arc<IsoRecordingEngine>,
    pub aux_engine: Arc<AuxOutputEngine>,
    pub color_engine: Arc<ColorGradeEngine>,
    pub delay_engine: Arc<DelayBufferManager>,
    pub virtual_studio_engine: Arc<VirtualStudioEngine>,
    pub hardware_manager: Arc<BroadcastHardwareManager>,
    pub diagnostics_manager: Arc<BroadcastDiagnosticsManager>,
}

impl BroadcastEngine {
    pub fn new() -> Self {
        Self {
            iso_engine: Arc::new(IsoRecordingEngine::new(8)),
            aux_engine: Arc::new(AuxOutputEngine::new(4)),
            color_engine: Arc::new(ColorGradeEngine::new()),
            delay_engine: Arc::new(DelayBufferManager::new()),
            virtual_studio_engine: Arc::new(VirtualStudioEngine::new()),
            hardware_manager: Arc::new(BroadcastHardwareManager::new()),
            diagnostics_manager: Arc::new(BroadcastDiagnosticsManager::new()),
        }
    }
}
