pub mod director;
pub mod discovery;
pub mod guest;
pub mod ptz;
pub mod service;
pub mod tally;
pub mod webrtc;

use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::project::model::RemoteProductionConfig;
use director::DirectorManager;
use guest::GuestManager;
use ptz::PtzController;
use service::{ProductionSnapshot, RemoteServer, RemoteServiceState, SwitcherCommand};
use tally::TallyManager;
use webrtc::WebRtcSessionManager;

#[derive(Clone)]
pub struct RemoteProductionEngine {
    pub guest_mgr: GuestManager,
    pub director_mgr: DirectorManager,
    pub ptz_ctrl: PtzController,
    pub tally_mgr: TallyManager,
    pub webrtc_mgr: WebRtcSessionManager,
    pub snapshot: Arc<parking_lot::RwLock<ProductionSnapshot>>,
    server: Arc<parking_lot::RwLock<Option<RemoteServer>>>,
    switcher_cmd_tx: mpsc::Sender<SwitcherCommand>,
    switcher_cmd_rx: Arc<tokio::sync::Mutex<mpsc::Receiver<SwitcherCommand>>>,
}

impl RemoteProductionEngine {
    pub fn new(config: &RemoteProductionConfig) -> Self {
        let (tx, rx) = mpsc::channel(200);
        let guest_mgr = GuestManager::new(config.max_guests);
        let director_mgr = DirectorManager::new();
        director_mgr.configure_tokens(
            Some(config.operator_token_hash.clone()),
            Some(config.viewer_token_hash.clone()),
            Some(config.admin_token_hash.clone()),
        );

        let initial_snapshot = ProductionSnapshot {
            is_running: false,
            program_input_id: None,
            preview_input_id: None,
            inputs: Vec::new(),
            is_streaming: false,
            is_recording: false,
        };

        Self {
            guest_mgr,
            director_mgr,
            ptz_ctrl: PtzController::new(),
            tally_mgr: TallyManager::new(),
            webrtc_mgr: WebRtcSessionManager::new(),
            snapshot: Arc::new(parking_lot::RwLock::new(initial_snapshot)),
            server: Arc::new(parking_lot::RwLock::new(None)),
            switcher_cmd_tx: tx,
            switcher_cmd_rx: Arc::new(tokio::sync::Mutex::new(rx)),
        }
    }

    pub fn get_command_receiver(&self) -> Arc<tokio::sync::Mutex<mpsc::Receiver<SwitcherCommand>>> {
        self.switcher_cmd_rx.clone()
    }

    pub async fn start_server(&self, bind_address: &str, port: u16) -> Result<(), LiveStudioError> {
        let state = RemoteServiceState {
            guest_mgr: self.guest_mgr.clone(),
            director_mgr: self.director_mgr.clone(),
            ptz_ctrl: self.ptz_ctrl.clone(),
            tally_mgr: self.tally_mgr.clone(),
            webrtc_mgr: self.webrtc_mgr.clone(),
            switcher_cmd_tx: self.switcher_cmd_tx.clone(),
            status_rx: self.snapshot.clone(),
        };

        let mut server = RemoteServer::new(bind_address.to_string(), port, state);
        server.start().await?;
        *self.server.write() = Some(server);
        info!("Remote production server active on {}:{}", bind_address, port);
        Ok(())
    }

    pub fn stop_server(&self) {
        if let Some(mut server) = self.server.write().take() {
            server.stop();
        }
    }

    pub fn is_server_running(&self) -> bool {
        self.server.read().is_some()
    }

    pub fn update_snapshot(&self, snap: ProductionSnapshot) {
        *self.snapshot.write() = snap;
    }
}
