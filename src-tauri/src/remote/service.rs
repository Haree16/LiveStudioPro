use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};

use super::director::{DirectorManager, DirectorRole};
use super::guest::{GuestConnectionStats, GuestInvitation, GuestManager};
use super::ptz::{PtzController, PtzDirection};
use super::tally::{InputTallyStatus, TallyManager};
use super::webrtc::{WebRtcIceCandidateMessage, WebRtcSessionManager};
use crate::core::error::LiveStudioError;

#[derive(Clone)]
pub struct RemoteServiceState {
    pub guest_mgr: GuestManager,
    pub director_mgr: DirectorManager,
    pub ptz_ctrl: PtzController,
    pub tally_mgr: TallyManager,
    pub webrtc_mgr: WebRtcSessionManager,
    pub switcher_cmd_tx: tokio::sync::mpsc::Sender<SwitcherCommand>,
    pub status_rx: Arc<parking_lot::RwLock<ProductionSnapshot>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionSnapshot {
    pub is_running: bool,
    pub program_input_id: Option<String>,
    pub preview_input_id: Option<String>,
    pub inputs: Vec<InputSnapshotItem>,
    pub is_streaming: bool,
    pub is_recording: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InputSnapshotItem {
    pub id: String,
    pub name: String,
    pub input_type: String,
    pub volume: f32,
    pub muted: bool,
    pub tally_state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SwitcherCommand {
    Cut,
    Auto { duration_ms: u32, transition_type: String },
    SetPreview { input_id: String },
    SetProgram { input_id: String },
    SetVolume { channel_id: String, fader_db: f32 },
    SetMute { channel_id: String, muted: bool },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthRequest {
    pub token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub success: bool,
    pub session_id: Option<String>,
    pub role: Option<DirectorRole>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGuestRequest {
    pub guest_name: String,
    pub role: String,
    pub duration_minutes: i64,
    pub assigned_input_id: Option<String>,
    pub audio_return: bool,
    pub video_return: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtzMoveRequest {
    pub camera_id: String,
    pub direction: PtzDirection,
    pub pan_speed: u8,
    pub tilt_speed: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtzPresetRequest {
    pub camera_id: String,
    pub preset_id: u32,
    pub action: String, // "recall" or "save"
    pub name: Option<String>,
}

pub struct RemoteServer {
    bind_address: String,
    port: u16,
    state: RemoteServiceState,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl RemoteServer {
    pub fn new(bind_address: String, port: u16, state: RemoteServiceState) -> Self {
        Self {
            bind_address,
            port,
            state,
            shutdown_tx: None,
        }
    }

    pub fn build_router(state: RemoteServiceState) -> Router {
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        Router::new()
            // HTML Pages
            .route("/", get(handle_root))
            .route("/guest/{token}", get(handle_guest_page))
            .route("/director", get(handle_director_page))
            .route("/tally", get(handle_tally_page))
            // REST Endpoints
            .route("/api/auth", post(handle_api_auth))
            .route("/api/status", get(handle_api_status))
            .route("/api/tally", get(handle_api_tally))
            .route("/api/guests", get(handle_api_list_guests).post(handle_api_create_guest))
            .route("/api/guests/{id}", delete(handle_api_revoke_guest))
            .route("/api/ptz/move", post(handle_api_ptz_move))
            .route("/api/ptz/preset", post(handle_api_ptz_preset))
            .route("/api/audit", get(handle_api_audit_log))
            // WebSockets
            .route("/ws/guest/{token}", get(ws_guest_handler))
            .route("/ws/director", get(ws_director_handler))
            .route("/ws/tally", get(ws_tally_handler))
            .layer(cors)
            .with_state(state)
    }

    pub async fn start(&mut self) -> Result<(), LiveStudioError> {
        let addr: SocketAddr = format!("{}:{}", self.bind_address, self.port)
            .parse()
            .map_err(|e| {
                LiveStudioError::validation(
                    format!("Invalid bind address '{}:{}': {e}", self.bind_address, self.port),
                    Some("bindAddress"),
                )
            })?;

        let listener = TcpListener::bind(addr).await.map_err(|e| {
            LiveStudioError::device(
                format!("Failed to bind HTTP server to {addr}: {e}"),
                None,
            )
        })?;

        info!("LiveStudio Pro Remote Production Server listening on http://{addr}");

        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel();
        self.shutdown_tx = Some(shutdown_tx);

        let router = Self::build_router(self.state.clone());

        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, router)
                .with_graceful_shutdown(async move {
                    let _ = shutdown_rx.await;
                })
                .await
            {
                error!("Remote production server terminated with error: {e}");
            }
        });

        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
            info!("Remote production server stopped");
        }
    }
}

// Handlers
async fn handle_root() -> impl IntoResponse {
    Html("<html><body style='font-family:sans-serif;background:#1a202c;color:#e2e8f0;padding:40px'><h1>LiveStudio Pro Remote Gateway</h1><p><a href='/director' style='color:#63b3ed'>Director Interface</a> | <a href='/tally' style='color:#63b3ed'>Tally Monitor</a></p></body></html>")
}

async fn handle_guest_page(Path(token): Path<String>, State(state): State<RemoteServiceState>) -> impl IntoResponse {
    let invitation = state.guest_mgr.get_by_token(&token);
    match invitation {
        Some(inv) => {
            let html = include_str!("../../static/guest.html")
                .replace("{{GUEST_NAME}}", &inv.guest_name)
                .replace("{{GUEST_ROLE}}", &inv.role)
                .replace("{{TOKEN}}", &token);
            Html(html).into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Html("<html><body style='font-family:sans-serif;background:#1a202c;color:#fc8181;padding:40px'><h1>Invitation Invalid or Expired</h1><p>Please request a new link from the production operator.</p></body></html>"),
        ).into_response(),
    }
}

async fn handle_director_page() -> impl IntoResponse {
    let html = include_str!("../../static/director.html");
    Html(html)
}

async fn handle_tally_page() -> impl IntoResponse {
    let html = include_str!("../../static/tally.html");
    Html(html)
}

// REST handlers
async fn handle_api_auth(
    State(state): State<RemoteServiceState>,
    Json(req): Json<AuthRequest>,
) -> Json<AuthResponse> {
    match state.director_mgr.authenticate(&req.token, "127.0.0.1") {
        Ok((session, session_id)) => Json(AuthResponse {
            success: true,
            session_id: Some(session_id),
            role: Some(session.role),
            error: None,
        }),
        Err(e) => Json(AuthResponse {
            success: false,
            session_id: None,
            role: None,
            error: Some(e.to_string()),
        }),
    }
}

async fn handle_api_status(State(state): State<RemoteServiceState>) -> Json<ProductionSnapshot> {
    let snapshot = state.status_rx.read().clone();
    Json(snapshot)
}

async fn handle_api_tally(State(state): State<RemoteServiceState>) -> Json<Vec<InputTallyStatus>> {
    Json(state.tally_mgr.get_all_tally())
}

async fn handle_api_list_guests(State(state): State<RemoteServiceState>) -> Json<Vec<GuestInvitation>> {
    Json(state.guest_mgr.list_invitations())
}

async fn handle_api_create_guest(
    State(state): State<RemoteServiceState>,
    Json(req): Json<CreateGuestRequest>,
) -> Result<Json<GuestInvitation>, (StatusCode, String)> {
    state
        .guest_mgr
        .create_invitation(
            req.guest_name,
            req.role,
            req.duration_minutes,
            req.assigned_input_id,
            req.audio_return,
            req.video_return,
        )
        .map(Json)
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))
}

async fn handle_api_revoke_guest(
    Path(id): Path<String>,
    State(state): State<RemoteServiceState>,
) -> Result<Json<bool>, (StatusCode, String)> {
    state
        .guest_mgr
        .revoke_invitation(&id)
        .map(|_| Json(true))
        .map_err(|e| (StatusCode::NOT_FOUND, e.to_string()))
}

async fn handle_api_ptz_move(
    State(state): State<RemoteServiceState>,
    Json(req): Json<PtzMoveRequest>,
) -> Result<Json<bool>, (StatusCode, String)> {
    state
        .ptz_ctrl
        .move_camera(&req.camera_id, req.direction, req.pan_speed, req.tilt_speed)
        .await
        .map(|_| Json(true))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn handle_api_ptz_preset(
    State(state): State<RemoteServiceState>,
    Json(req): Json<PtzPresetRequest>,
) -> Result<Json<bool>, (StatusCode, String)> {
    if req.action == "save" {
        let name = req.name.unwrap_or_else(|| format!("Preset {}", req.preset_id));
        state
            .ptz_ctrl
            .save_preset(&req.camera_id, req.preset_id, &name)
            .await
            .map(|_| Json(true))
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    } else {
        state
            .ptz_ctrl
            .recall_preset(&req.camera_id, req.preset_id)
            .await
            .map(|_| Json(true))
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
    }
}

async fn handle_api_audit_log(State(state): State<RemoteServiceState>) -> Json<Vec<super::director::RemoteAuditEntry>> {
    Json(state.director_mgr.get_audit_log())
}

// WebSocket handlers
async fn ws_guest_handler(
    ws: WebSocketUpgrade,
    Path(token): Path<String>,
    State(state): State<RemoteServiceState>,
) -> Response {
    match state.guest_mgr.verify_token_and_connect(&token) {
        Ok(invitation) => ws.on_upgrade(move |socket| handle_guest_socket(socket, invitation, state)),
        Err(e) => (StatusCode::UNAUTHORIZED, e.to_string()).into_response(),
    }
}

async fn handle_guest_socket(
    mut socket: WebSocket,
    invitation: GuestInvitation,
    state: RemoteServiceState,
) {
    let guest_id = invitation.id.clone();
    info!("Guest {} ({}) connected via WebSocket", invitation.guest_name, guest_id);

    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                let msg_type = val.get("type").and_then(|v| v.as_str()).unwrap_or("");
                match msg_type {
                    "offer" => {
                        if let Some(sdp) = val.get("sdp").and_then(|v| v.as_str()) {
                            if let Ok(answer) = state.webrtc_mgr.process_offer(&guest_id, sdp) {
                                let reply = serde_json::json!({
                                    "type": "answer",
                                    "sdp": answer.sdp
                                });
                                let _ = socket.send(Message::Text(reply.to_string().into())).await;
                            }
                        }
                    }
                    "iceCandidate" => {
                        if let Some(cand_obj) = val.get("candidate") {
                            let cand = WebRtcIceCandidateMessage {
                                candidate: cand_obj.get("candidate").and_then(|v| v.as_str()).unwrap_or("").into(),
                                sdp_mid: cand_obj.get("sdpMid").and_then(|v| v.as_str()).map(Into::into),
                                sdp_m_line_index: cand_obj.get("sdpMLineIndex").and_then(|v| v.as_u64()).map(|v| v as u32),
                            };
                            let _ = state.webrtc_mgr.add_ice_candidate(&guest_id, &cand);
                        }
                    }
                    "stats" => {
                        let stats = GuestConnectionStats {
                            guest_id: guest_id.clone(),
                            round_trip_time_ms: val.get("rtt").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                            packet_loss_percent: val.get("packetLoss").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                            jitter_ms: val.get("jitter").and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                            video_bitrate_kbps: val.get("bitrate").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                            audio_bitrate_kbps: 64,
                            resolution: val.get("resolution").and_then(|v| v.as_str()).unwrap_or("1280x720").into(),
                            fps: val.get("fps").and_then(|v| v.as_u64()).unwrap_or(30) as u32,
                            ice_state: "connected".into(),
                        };
                        state.guest_mgr.update_stats(guest_id.clone(), stats);
                    }
                    _ => {}
                }
            }
        }
    }

    state.guest_mgr.disconnect_guest(&guest_id);
    info!("Guest {} disconnected", guest_id);
}

async fn ws_director_handler(
    ws: WebSocketUpgrade,
    State(state): State<RemoteServiceState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_director_socket(socket, state))
}

async fn handle_director_socket(mut socket: WebSocket, state: RemoteServiceState) {
    let mut session_id: Option<String> = None;
    let mut _authenticated_role: Option<DirectorRole> = None;

    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                let action = val.get("action").and_then(|v| v.as_str()).unwrap_or("");
                if action == "auth" {
                    let token = val.get("token").and_then(|v| v.as_str()).unwrap_or("");
                    match state.director_mgr.authenticate(token, "127.0.0.1") {
                        Ok((session, sid)) => {
                            session_id = Some(sid);
                            _authenticated_role = Some(session.role);
                            let reply = serde_json::json!({
                                "type": "authSuccess",
                                "role": session.role
                            });
                            let _ = socket.send(Message::Text(reply.to_string().into())).await;
                        }
                        Err(e) => {
                            let reply = serde_json::json!({
                                "type": "authFailed",
                                "error": e.to_string()
                            });
                            let _ = socket.send(Message::Text(reply.to_string().into())).await;
                        }
                    }
                    continue;
                }

                // Check session
                let s_id = match session_id.as_ref() {
                    Some(s) => s,
                    None => {
                        let reply = serde_json::json!({
                            "type": "error",
                            "error": "Unauthenticated"
                        });
                        let _ = socket.send(Message::Text(reply.to_string().into())).await;
                        continue;
                    }
                };

                // Validate role permission
                if let Err(e) = state.director_mgr.validate_action(s_id, action) {
                    let reply = serde_json::json!({
                        "type": "error",
                        "error": e.to_string()
                    });
                    let _ = socket.send(Message::Text(reply.to_string().into())).await;
                    continue;
                }

                // Handle valid commands
                match action {
                    "cut" => {
                        let _ = state.switcher_cmd_tx.send(SwitcherCommand::Cut).await;
                    }
                    "auto" => {
                        let dur = val.get("durationMs").and_then(|v| v.as_u64()).unwrap_or(500) as u32;
                        let trans = val.get("transition").and_then(|v| v.as_str()).unwrap_or("fade").to_string();
                        let _ = state.switcher_cmd_tx.send(SwitcherCommand::Auto { duration_ms: dur, transition_type: trans }).await;
                    }
                    "setPreview" => {
                        if let Some(id) = val.get("inputId").and_then(|v| v.as_str()) {
                            let _ = state.switcher_cmd_tx.send(SwitcherCommand::SetPreview { input_id: id.to_string() }).await;
                        }
                    }
                    "setProgram" => {
                        if let Some(id) = val.get("inputId").and_then(|v| v.as_str()) {
                            let _ = state.switcher_cmd_tx.send(SwitcherCommand::SetProgram { input_id: id.to_string() }).await;
                        }
                    }
                    "setVolume" => {
                        if let (Some(ch), Some(vol)) = (
                            val.get("channelId").and_then(|v| v.as_str()),
                            val.get("faderDb").and_then(|v| v.as_f64()),
                        ) {
                            let _ = state.switcher_cmd_tx.send(SwitcherCommand::SetVolume { channel_id: ch.to_string(), fader_db: vol as f32 }).await;
                        }
                    }
                    "getStatus" => {
                        let snap = state.status_rx.read().clone();
                        let reply = serde_json::json!({
                            "type": "status",
                            "data": snap
                        });
                        let _ = socket.send(Message::Text(reply.to_string().into())).await;
                    }
                    _ => {}
                }
            }
        }
    }

    if let Some(sid) = session_id {
        state.director_mgr.remove_session(&sid);
    }
}

async fn ws_tally_handler(
    ws: WebSocketUpgrade,
    State(state): State<RemoteServiceState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_tally_socket(socket, state))
}

async fn handle_tally_socket(mut socket: WebSocket, state: RemoteServiceState) {
    let mut rx = state.tally_mgr.subscribe();

    // Send initial tally status immediately
    let initial = state.tally_mgr.get_all_tally();
    if let Ok(json) = serde_json::to_string(&initial) {
        let _ = socket.send(Message::Text(json.into())).await;
    }

    // Stream updates
    while let Ok(statuses) = rx.recv().await {
        if let Ok(json) = serde_json::to_string(&statuses) {
            if socket.send(Message::Text(json.into())).await.is_err() {
                break;
            }
        }
    }
}
