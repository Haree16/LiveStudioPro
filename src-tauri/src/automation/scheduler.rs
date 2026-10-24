use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScheduleType {
    OneTime,
    Daily,
    Weekly,
    IntervalMinutes,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MissedCuePolicy {
    Skip,
    ExecuteImmediately,
    NotifyOperator,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TimedCueStatus {
    Pending,
    Armed,
    Triggered,
    Completed,
    Cancelled,
    Missed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimedCue {
    pub id: String,
    pub name: String,
    pub target_macro_id: String,
    pub schedule_type: ScheduleType,
    pub schedule_time_utc: DateTime<Utc>,
    pub timezone: String,
    pub interval_minutes: Option<u32>,
    pub requires_confirmation: bool,
    pub missed_policy: MissedCuePolicy,
    pub status: TimedCueStatus,
    pub last_run: Option<DateTime<Utc>>,
}

impl TimedCue {
    pub fn new_one_time(name: impl Into<String>, target_macro_id: impl Into<String>, time_utc: DateTime<Utc>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: name.into(),
            target_macro_id: target_macro_id.into(),
            schedule_type: ScheduleType::OneTime,
            schedule_time_utc: time_utc,
            timezone: "UTC".into(),
            interval_minutes: None,
            requires_confirmation: false,
            missed_policy: MissedCuePolicy::Skip,
            status: TimedCueStatus::Pending,
            last_run: None,
        }
    }
}

pub struct AutomationScheduler {
    cues: Arc<RwLock<HashMap<String, TimedCue>>>,
}

impl AutomationScheduler {
    pub fn new() -> Self {
        Self {
            cues: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn add_cue(&self, cue: TimedCue) {
        self.cues.write().insert(cue.id.clone(), cue);
    }

    pub fn remove_cue(&self, id: &str) -> bool {
        self.cues.write().remove(id).is_some()
    }

    pub fn list_cues(&self) -> Vec<TimedCue> {
        let mut list: Vec<TimedCue> = self.cues.read().values().cloned().collect();
        list.sort_by(|a, b| a.schedule_time_utc.cmp(&b.schedule_time_utc));
        list
    }

    /// Reconciles cues on application startup
    pub fn reconcile_startup(&self) -> Vec<String> {
        let now = Utc::now();
        let mut executable_macro_ids = Vec::new();
        let mut cues = self.cues.write();

        for cue in cues.values_mut() {
            if cue.status == TimedCueStatus::Pending && cue.schedule_time_utc < now {
                match cue.missed_policy {
                    MissedCuePolicy::Skip => {
                        cue.status = TimedCueStatus::Missed;
                    }
                    MissedCuePolicy::ExecuteImmediately => {
                        cue.status = TimedCueStatus::Triggered;
                        cue.last_run = Some(now);
                        executable_macro_ids.push(cue.target_macro_id.clone());
                    }
                    MissedCuePolicy::NotifyOperator => {
                        cue.status = TimedCueStatus::Armed;
                    }
                }
            }
        }

        executable_macro_ids
    }

    /// Evaluates due cues at current tick and returns target macro IDs
    pub fn poll_due_cues(&self) -> Vec<String> {
        let now = Utc::now();
        let mut due_macros = Vec::new();
        let mut cues = self.cues.write();

        for cue in cues.values_mut() {
            if cue.status == TimedCueStatus::Pending && now >= cue.schedule_time_utc {
                if cue.requires_confirmation {
                    // Held for the operator: never run unattended.
                    cue.status = TimedCueStatus::Armed;
                    continue;
                }
                cue.status = TimedCueStatus::Triggered;
                cue.last_run = Some(now);
                due_macros.push(cue.target_macro_id.clone());

                // Reschedule recurring cues
                match cue.schedule_type {
                    ScheduleType::Daily => {
                        cue.schedule_time_utc = cue.schedule_time_utc + Duration::days(1);
                        cue.status = TimedCueStatus::Pending;
                    }
                    ScheduleType::Weekly => {
                        cue.schedule_time_utc = cue.schedule_time_utc + Duration::weeks(1);
                        cue.status = TimedCueStatus::Pending;
                    }
                    ScheduleType::IntervalMinutes => {
                        if let Some(mins) = cue.interval_minutes {
                            cue.schedule_time_utc = cue.schedule_time_utc + Duration::minutes(mins as i64);
                            cue.status = TimedCueStatus::Pending;
                        }
                    }
                    ScheduleType::OneTime => {
                        cue.status = TimedCueStatus::Completed;
                    }
                }
            }
        }

        due_macros
    }
}
