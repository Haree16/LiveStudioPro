use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Partial,
    Failed,
    Cancelled,
    TimedOut,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacroExecutionRecord {
    pub execution_id: String,
    pub macro_id: String,
    pub macro_name: String,
    pub trigger_source: String, // "manual", "hotkey", "midi", "scheduler", "event", "api"
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub status: ExecutionStatus,
    pub error_details: Option<String>,
    pub executed_steps: usize,
}

#[derive(Clone)]
pub struct ExecutionHistory {
    records: Arc<RwLock<VecDeque<MacroExecutionRecord>>>,
    max_capacity: usize,
}

impl ExecutionHistory {
    pub fn new(max_capacity: usize) -> Self {
        Self {
            records: Arc::new(RwLock::new(VecDeque::with_capacity(max_capacity))),
            max_capacity,
        }
    }

    pub fn push(&self, record: MacroExecutionRecord) {
        let mut q = self.records.write();
        if q.len() >= self.max_capacity {
            q.pop_front();
        }
        q.push_back(record);
    }

    pub fn list(&self, limit: Option<usize>) -> Vec<MacroExecutionRecord> {
        let q = self.records.read();
        let n = limit.unwrap_or(50).min(q.len());
        q.iter().rev().take(n).cloned().collect()
    }

    pub fn clear(&self) {
        self.records.write().clear();
    }
}
