use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use chrono::Utc;
use parking_lot::RwLock;
use tracing::{info, warn};

use crate::core::error::LiveStudioError;
use crate::playback::model::{ScheduleStatus, ScheduledCue};

pub struct EventScheduler {
    cues: Arc<RwLock<Vec<ScheduledCue>>>,
    pending_confirmation_cue: Arc<RwLock<Option<ScheduledCue>>>,
    is_running: Arc<AtomicBool>,
    thread_handle: Arc<RwLock<Option<std::thread::JoinHandle<()>>>>,
}

impl EventScheduler {
    pub fn new() -> Self {
        Self {
            cues: Arc::new(RwLock::new(Vec::new())),
            pending_confirmation_cue: Arc::new(RwLock::new(None)),
            is_running: Arc::new(AtomicBool::new(false)),
            thread_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn start(&self) {
        if self.is_running.load(Ordering::SeqCst) {
            return;
        }

        self.is_running.store(true, Ordering::SeqCst);
        let is_running = self.is_running.clone();
        let cues_lock = self.cues.clone();
        let pending_conf = self.pending_confirmation_cue.clone();

        let handle = std::thread::Builder::new()
            .name("livestudio-scheduler".into())
            .spawn(move || {
                info!("Native Event Scheduler service started");
                while is_running.load(Ordering::Relaxed) {
                    let now = Utc::now();
                    {
                        let mut cues = cues_lock.write();
                        for cue in cues.iter_mut() {
                            if cue.status == ScheduleStatus::Pending {
                                let diff_sec = (cue.scheduled_time_utc - now).num_seconds();

                                // Arm when within 30 seconds
                                if diff_sec <= 30 && diff_sec > 0 {
                                    cue.status = ScheduleStatus::Armed;
                                    info!("Scheduled cue '{}' armed (triggers in {}s)", cue.label, diff_sec);
                                } else if diff_sec <= 0 && diff_sec >= -60 {
                                    // Triggered on time
                                    cue.status = ScheduleStatus::Triggered;
                                    info!("Scheduled cue '{}' triggered at {}", cue.label, now);

                                    if cue.requires_operator_confirmation {
                                        *pending_conf.write() = Some(cue.clone());
                                    }
                                } else if diff_sec < -60 {
                                    // Missed cue
                                    cue.status = ScheduleStatus::Missed;
                                    warn!("Scheduled cue '{}' missed (scheduled at {}, current {})", cue.label, cue.scheduled_time_utc, now);
                                }
                            } else if cue.status == ScheduleStatus::Armed {
                                let diff_sec = (cue.scheduled_time_utc - now).num_seconds();
                                if diff_sec <= 0 && diff_sec >= -60 {
                                    cue.status = ScheduleStatus::Triggered;
                                    info!("Armed cue '{}' triggered at {}", cue.label, now);

                                    if cue.requires_operator_confirmation {
                                        *pending_conf.write() = Some(cue.clone());
                                    }
                                } else if diff_sec < -60 {
                                    cue.status = ScheduleStatus::Missed;
                                    warn!("Armed cue '{}' missed (scheduled at {}, current {})", cue.label, cue.scheduled_time_utc, now);
                                }
                            }
                        }
                    }

                    std::thread::sleep(Duration::from_millis(500));
                }
                info!("Native Event Scheduler service stopped");
            })
            .expect("Failed to spawn scheduler thread");

        *self.thread_handle.write() = Some(handle);
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::SeqCst);
    }

    pub fn add_cue(&self, cue: ScheduledCue) {
        self.cues.write().push(cue);
    }

    pub fn get_cues(&self) -> Vec<ScheduledCue> {
        self.cues.read().clone()
    }

    pub fn cancel_cue(&self, cue_id: &str) -> Result<(), LiveStudioError> {
        let mut cues = self.cues.write();
        if let Some(cue) = cues.iter_mut().find(|c| c.id == cue_id) {
            cue.status = ScheduleStatus::Cancelled;
            info!("Cancelled scheduled cue '{}'", cue.label);
            Ok(())
        } else {
            Err(LiveStudioError::validation("Scheduled cue not found", None))
        }
    }

    pub fn delete_cue(&self, cue_id: &str) -> Result<(), LiveStudioError> {
        let mut cues = self.cues.write();
        if let Some(pos) = cues.iter().position(|c| c.id == cue_id) {
            cues.remove(pos);
            Ok(())
        } else {
            Err(LiveStudioError::validation("Scheduled cue not found", None))
        }
    }

    pub fn get_pending_confirmation(&self) -> Option<ScheduledCue> {
        self.pending_confirmation_cue.read().clone()
    }

    pub fn confirm_pending_cue(&self, cue_id: &str) -> Result<ScheduledCue, LiveStudioError> {
        let mut pending = self.pending_confirmation_cue.write();
        if let Some(cue) = pending.take() {
            if cue.id == cue_id {
                let mut cues = self.cues.write();
                if let Some(target) = cues.iter_mut().find(|c| c.id == cue_id) {
                    target.status = ScheduleStatus::Completed;
                }
                info!("Operator confirmed scheduled cue '{}'", cue.label);
                return Ok(cue);
            } else {
                *pending = Some(cue);
            }
        }
        Err(LiveStudioError::validation("No matching pending cue awaiting confirmation", None))
    }

    pub fn dismiss_pending_cue(&self) {
        let mut pending = self.pending_confirmation_cue.write();
        if let Some(cue) = pending.take() {
            let mut cues = self.cues.write();
            if let Some(target) = cues.iter_mut().find(|c| c.id == cue.id) {
                target.status = ScheduleStatus::Cancelled;
            }
            info!("Operator dismissed scheduled cue '{}'", cue.label);
        }
    }
}

impl Drop for EventScheduler {
    fn drop(&mut self) {
        self.stop();
    }
}
