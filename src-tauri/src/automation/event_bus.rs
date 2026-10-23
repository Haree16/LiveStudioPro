use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ProductionEventType {
    SourceConnected,
    SourceDisconnected,
    PreviewChanged,
    ProgramChanged,
    TransitionCompleted,
    PlaybackStarted,
    PlaybackEnded,
    PlaylistItemChanged,
    StreamStarted,
    StreamStopped,
    RecordingStarted,
    RecordingStopped,
    GuestConnected,
    GuestDisconnected,
    TallyChanged,
    SystemAlert,
    CountdownCompleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductionEvent {
    pub event_id: String,
    pub event_type: ProductionEventType,
    pub timestamp: DateTime<Utc>,
    pub payload: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EventTriggerRule {
    pub id: String,
    pub name: String,
    pub event_type: ProductionEventType,
    pub filter_field: Option<String>,
    pub filter_value: Option<Value>,
    pub target_macro_id: String,
    pub enabled: bool,
    pub cooldown_ms: u64,
    #[serde(default)]
    pub last_triggered: Option<DateTime<Utc>>,
}

#[derive(Clone)]
pub struct EventBus {
    rules: Arc<parking_lot::RwLock<HashMap<String, EventTriggerRule>>>,
    notifier: broadcast::Sender<ProductionEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (tx, _rx) = broadcast::channel(500);
        Self {
            rules: Arc::new(parking_lot::RwLock::new(HashMap::new())),
            notifier: tx,
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ProductionEvent> {
        self.notifier.subscribe()
    }

    pub fn register_rule(&self, rule: EventTriggerRule) {
        self.rules.write().insert(rule.id.clone(), rule);
    }

    pub fn unregister_rule(&self, id: &str) -> bool {
        self.rules.write().remove(id).is_some()
    }

    pub fn list_rules(&self) -> Vec<EventTriggerRule> {
        self.rules.read().values().cloned().collect()
    }

    /// Emits a production event and returns a list of target macro IDs to execute
    pub fn emit(&self, event_type: ProductionEventType, payload: HashMap<String, Value>) -> Vec<String> {
        let now = Utc::now();
        let event = ProductionEvent {
            event_id: Uuid::new_v4().to_string(),
            event_type,
            timestamp: now,
            payload,
        };

        let mut matched_macro_ids = Vec::new();
        let mut rules = self.rules.write();

        for rule in rules.values_mut() {
            if !rule.enabled || rule.event_type != event_type {
                continue;
            }

            // Check throttling / cooldown
            if let Some(last) = rule.last_triggered {
                let diff_ms = (now - last).num_milliseconds() as u64;
                if diff_ms < rule.cooldown_ms {
                    continue; // In cooldown, skip to prevent recursive loop
                }
            }

            // Check field filter if configured
            if let (Some(field), Some(val)) = (&rule.filter_field, &rule.filter_value) {
                if let Some(actual) = event.payload.get(field) {
                    if actual != val {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            rule.last_triggered = Some(now);
            matched_macro_ids.push(rule.target_macro_id.clone());
        }

        let _ = self.notifier.send(event);
        matched_macro_ids
    }
}
