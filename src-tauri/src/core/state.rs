use std::sync::Arc;
use crate::core::controller::ProductionController;

pub struct AppState {
    pub controller: Arc<ProductionController>,
}

impl AppState {
    pub fn new() -> Result<Self, crate::core::error::LiveStudioError> {
        Ok(Self {
            controller: Arc::new(ProductionController::new()?),
        })
    }
}
