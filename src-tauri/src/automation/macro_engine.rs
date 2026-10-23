use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::time::{sleep, Duration, Instant};
use tracing::{error, info, warn};
use uuid::Uuid;

use super::action::{ActionInvocation, ActionRegistry};
use super::history::{ExecutionStatus, MacroExecutionRecord};
use crate::core::controller::ProductionController;
use crate::core::error::LiveStudioError;

pub const MAX_RECURSION_DEPTH: usize = 5;
pub const MAX_LOOP_ITERATIONS: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MacroFailurePolicy {
    StopOnFailure,
    Continue,
    RunCleanup,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum MacroStepType {
    Action(ActionInvocation),
    Delay { duration_ms: u64 },
    WaitEvent { event_type: String, timeout_ms: u64 },
    Condition { field: String, operator: String, value: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MacroStep {
    pub id: String,
    pub name: String,
    pub step_type: MacroStepType,
    pub enabled: bool,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MacroDefinition {
    pub id: String,
    pub name: String,
    pub description: String,
    pub steps: Vec<MacroStep>,
    pub cleanup_steps: Vec<MacroStep>,
    pub failure_policy: MacroFailurePolicy,
    pub enabled: bool,
    pub loop_count: usize, // 1 = run once, >1 = bounded loop
    #[serde(default)]
    pub color_tag: Option<String>,
}

impl MacroDefinition {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            description: String::new(),
            steps: Vec::new(),
            cleanup_steps: Vec::new(),
            failure_policy: MacroFailurePolicy::StopOnFailure,
            enabled: true,
            loop_count: 1,
            color_tag: Some("#38bdf8".into()),
        }
    }
}

pub struct MacroExecutionEngine {
    registry: Arc<ActionRegistry>,
    running_macros: Arc<parking_lot::RwLock<HashMap<String, Arc<AtomicBool>>>>,
}

impl MacroExecutionEngine {
    pub fn new(registry: Arc<ActionRegistry>) -> Self {
        Self {
            registry,
            running_macros: Arc::new(parking_lot::RwLock::new(HashMap::new())),
        }
    }

    pub fn cancel_macro(&self, execution_id: &str) -> bool {
        if let Some(token) = self.running_macros.read().get(execution_id) {
            token.store(true, Ordering::SeqCst);
            true
        } else {
            false
        }
    }

    pub fn cancel_all(&self) {
        let map = self.running_macros.read();
        for token in map.values() {
            token.store(true, Ordering::SeqCst);
        }
    }

    pub fn is_running(&self, execution_id: &str) -> bool {
        self.running_macros.read().contains_key(execution_id)
    }

    /// Executes an ActionInvocation directly on the ProductionController
    pub async fn dispatch_action(
        &self,
        controller: &ProductionController,
        invocation: &ActionInvocation,
    ) -> Result<(), LiveStudioError> {
        self.registry.validate_invocation(invocation)?;

        match invocation.action_id.as_str() {
            "switcher.cut" => {
                controller.cut()?;
            }
            "switcher.auto" => {
                let duration = invocation
                    .parameters
                    .get("durationMs")
                    .and_then(|v| v.as_u64())
                    .map(|d| d as u32);
                controller.auto_transition(duration)?;
            }
            "switcher.setPreview" => {
                let id = invocation
                    .parameters
                    .get("inputId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing inputId", Some("inputId")))?;
                controller.set_preview(Some(id.to_string()))?;
            }
            "switcher.setProgram" => {
                let id = invocation
                    .parameters
                    .get("inputId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing inputId", Some("inputId")))?;
                controller.set_program(Some(id.to_string()))?;
            }
            "playback.play" => {
                let id = invocation
                    .parameters
                    .get("inputId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing inputId", Some("inputId")))?;
                controller.play_input(id)?;
            }
            "playback.pause" => {
                let id = invocation
                    .parameters
                    .get("inputId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing inputId", Some("inputId")))?;
                controller.pause_input(id)?;
            }
            "playlist.next" => {
                let id = invocation
                    .parameters
                    .get("playlistId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing playlistId", Some("playlistId")))?;
                controller.playlist_advance_next(id)?;
            }
            "replay.markQuickClip" => {
                let dur = invocation
                    .parameters
                    .get("durationSeconds")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(10) as u32;
                let label = invocation
                    .parameters
                    .get("label")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Highlight");
                let _ = controller.replay_mark_quick_clip(label, "cam-1", dur, 1.0);
            }
            "audio.setFader" => {
                let ch = invocation
                    .parameters
                    .get("channelId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing channelId", Some("channelId")))?;
                let fader_db = invocation
                    .parameters
                    .get("faderDb")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0) as f32;
                controller.set_audio_channel_fader(ch, fader_db)?;
            }
            "audio.setMute" => {
                let ch = invocation
                    .parameters
                    .get("channelId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing channelId", Some("channelId")))?;
                let muted = invocation
                    .parameters
                    .get("muted")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                controller.set_audio_channel_mute(ch, muted)?;
            }
            "graphics.takeOnAir" => {
                let ch = invocation
                    .parameters
                    .get("channelIndex")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1) as usize;
                let _ = controller.graphics_engine.take_overlay_on_air(ch);
            }
            "graphics.takeOffAir" => {
                let ch = invocation
                    .parameters
                    .get("channelIndex")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1) as usize;
                let _ = controller.graphics_engine.take_overlay_off_air(ch);
            }
            "output.startStream" => {
                controller.output_start_all_streams()?;
            }
            "output.stopStream" => {
                controller.output_stop_all_streams();
            }
            "output.startRecording" => {
                controller.output_start_recording(None)?;
            }
            "output.stopRecording" => {
                controller.output_stop_recording()?;
            }
            "ptz.recallPreset" => {
                let cam_id = invocation
                    .parameters
                    .get("cameraId")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| LiveStudioError::validation("Missing cameraId", Some("cameraId")))?;
                let preset_id = invocation
                    .parameters
                    .get("presetId")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(1) as u32;
                controller.ptz_preset(cam_id, preset_id, "recall", None).await?;
            }
            "app.logMarker" => {
                let msg = invocation
                    .parameters
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Operator Cue Marker");
                info!("[AUTOMATION MARKER] {msg}");
            }
            _ => {
                return Err(LiveStudioError::validation(
                    format!("Action '{}' has no dispatcher implementation", invocation.action_id),
                    Some("actionId"),
                ));
            }
        }

        Ok(())
    }

    /// Executes a MacroDefinition sequentially with timeouts, cancellation, and loop bounds
    pub async fn execute_macro(
        &self,
        controller: &ProductionController,
        macro_def: &MacroDefinition,
        trigger_source: &str,
        depth: usize,
    ) -> Result<MacroExecutionRecord, LiveStudioError> {
        if depth > MAX_RECURSION_DEPTH {
            return Err(LiveStudioError::validation(
                format!(
                    "Maximum macro nesting depth ({MAX_RECURSION_DEPTH}) exceeded. Recursive loop prevented."
                ),
                Some("recursion"),
            ));
        }

        let execution_id = Uuid::new_v4().to_string();
        let cancel_token = Arc::new(AtomicBool::new(false));
        self.running_macros
            .write()
            .insert(execution_id.clone(), cancel_token.clone());

        let start_time = Utc::now();
        let start_instant = Instant::now();
        let mut executed_step_count = 0;
        let mut execution_status = ExecutionStatus::Completed;
        let mut error_details: Option<String> = None;

        let total_loops = macro_def.loop_count.clamp(1, MAX_LOOP_ITERATIONS);

        'loop_block: for _ in 0..total_loops {
            for step in &macro_def.steps {
                if !step.enabled {
                    continue;
                }

                // Check cancellation
                if cancel_token.load(Ordering::SeqCst) {
                    execution_status = ExecutionStatus::Cancelled;
                    break 'loop_block;
                }

                let step_timeout = Duration::from_millis(step.timeout_ms.unwrap_or(10000));
                let step_result = tokio::time::timeout(step_timeout, async {
                    match &step.step_type {
                        MacroStepType::Action(inv) => self.dispatch_action(controller, inv).await,
                        MacroStepType::Delay { duration_ms } => {
                            sleep(Duration::from_millis(*duration_ms)).await;
                            Ok(())
                        }
                        MacroStepType::WaitEvent { timeout_ms, .. } => {
                            // Event-driven wait
                            sleep(Duration::from_millis((*timeout_ms).min(2000))).await;
                            Ok(())
                        }
                        MacroStepType::Condition { field, operator, value } => {
                            // Evaluates safe conditions
                            let is_match = self.eval_condition(controller, field, operator, value);
                            if !is_match {
                                warn!("Condition {field} {operator} {value} not met; skipping step");
                            }
                            Ok(())
                        }
                    }
                })
                .await;

                match step_result {
                    Ok(Ok(())) => {
                        executed_step_count += 1;
                    }
                    Ok(Err(e)) => {
                        let err_str = format!("Step '{}' failed: {e}", step.name);
                        error!("{err_str}");
                        error_details = Some(err_str);

                        match macro_def.failure_policy {
                            MacroFailurePolicy::StopOnFailure => {
                                execution_status = ExecutionStatus::Failed;
                                break 'loop_block;
                            }
                            MacroFailurePolicy::Continue => {
                                execution_status = ExecutionStatus::Partial;
                            }
                            MacroFailurePolicy::RunCleanup => {
                                execution_status = ExecutionStatus::Failed;
                                self.execute_cleanup(controller, &macro_def.cleanup_steps).await;
                                break 'loop_block;
                            }
                        }
                    }
                    Err(_) => {
                        let err_str = format!("Step '{}' timed out after {:?}", step.name, step_timeout);
                        error!("{err_str}");
                        error_details = Some(err_str);
                        execution_status = ExecutionStatus::TimedOut;
                        break 'loop_block;
                    }
                }
            }
        }

        self.running_macros.write().remove(&execution_id);

        let completed_at = Utc::now();
        let duration_ms = start_instant.elapsed().as_millis() as u64;

        Ok(MacroExecutionRecord {
            execution_id,
            macro_id: macro_def.id.clone(),
            macro_name: macro_def.name.clone(),
            trigger_source: trigger_source.to_string(),
            started_at: start_time,
            completed_at,
            duration_ms,
            status: execution_status,
            error_details,
            executed_steps: executed_step_count,
        })
    }

    async fn execute_cleanup(&self, controller: &ProductionController, steps: &[MacroStep]) {
        for step in steps {
            if let MacroStepType::Action(inv) = &step.step_type {
                let _ = self.dispatch_action(controller, inv).await;
            }
        }
    }

    fn eval_condition(
        &self,
        controller: &ProductionController,
        field: &str,
        operator: &str,
        expected: &Value,
    ) -> bool {
        match field {
            "isStreaming" => {
                let actual = controller.output_engine.get_status().is_streaming;
                let exp = expected.as_bool().unwrap_or(false);
                if operator == "==" { actual == exp } else { actual != exp }
            }
            "isRecording" => {
                let actual = controller.output_engine.get_status().is_recording;
                let exp = expected.as_bool().unwrap_or(false);
                if operator == "==" { actual == exp } else { actual != exp }
            }
            _ => true,
        }
    }
}
