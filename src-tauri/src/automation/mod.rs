pub mod action;
pub mod control_surfaces;
pub mod event_bus;
pub mod history;
pub mod hotkeys;
pub mod macro_engine;
pub mod midi;
pub mod safety;
pub mod scheduler;
pub mod script_runner;

use std::collections::HashMap;
use std::sync::Arc;
use parking_lot::RwLock;

use action::{ActionInvocation, ActionRegistry};
use control_surfaces::ControlSurfaceBridge;
use event_bus::EventBus;
use history::{ExecutionHistory, MacroExecutionRecord};
use hotkeys::HotkeyManager;
use macro_engine::{MacroDefinition, MacroExecutionEngine};
use midi::MidiSubsystem;
use safety::{AutomationPolicy, AutomationSafetyGovernor};
use scheduler::AutomationScheduler;

use crate::core::controller::ProductionController;
use crate::core::error::LiveStudioError;

#[derive(Clone)]
pub struct AutomationEngine {
    pub registry: Arc<ActionRegistry>,
    pub macro_engine: Arc<MacroExecutionEngine>,
    pub safety_governor: Arc<AutomationSafetyGovernor>,
    pub event_bus: Arc<EventBus>,
    pub scheduler: Arc<AutomationScheduler>,
    pub hotkeys: Arc<HotkeyManager>,
    pub midi: Arc<MidiSubsystem>,
    pub surfaces: Arc<ControlSurfaceBridge>,
    pub history: Arc<ExecutionHistory>,
    pub macros: Arc<RwLock<HashMap<String, MacroDefinition>>>,
}

impl AutomationEngine {
    pub fn new() -> Self {
        Self::with_policy(AutomationPolicy::default())
    }

    pub fn with_policy(policy: AutomationPolicy) -> Self {
        let registry = Arc::new(ActionRegistry::new());
        let macro_engine = Arc::new(MacroExecutionEngine::new(registry.clone()));
        let safety_governor = Arc::new(AutomationSafetyGovernor::new(policy));
        let event_bus = Arc::new(EventBus::new());
        let scheduler = Arc::new(AutomationScheduler::new());
        let hotkeys = Arc::new(HotkeyManager::new());
        let midi = Arc::new(MidiSubsystem::new());
        let surfaces = Arc::new(ControlSurfaceBridge::new());
        let history = Arc::new(ExecutionHistory::new(500));

        let mut engine = Self {
            registry,
            macro_engine,
            safety_governor,
            event_bus,
            scheduler,
            hotkeys,
            midi,
            surfaces,
            history,
            macros: Arc::new(RwLock::new(HashMap::new())),
        };

        engine.load_builtin_macros();
        engine
    }

    pub fn load_macros(&self, list: Vec<MacroDefinition>) {
        if !list.is_empty() {
            let mut map = self.macros.write();
            map.clear();
            for m in list {
                map.insert(m.id.clone(), m);
            }
        }
    }

    pub fn load_hotkeys(&self, list: Vec<hotkeys::HotkeyMapping>) {
        if !list.is_empty() {
            let _ = self.hotkeys.set_mappings(list);
        }
    }

    pub fn load_midi_mappings(&self, list: Vec<midi::MidiMapping>) {
        if !list.is_empty() {
            self.midi.set_mappings(list);
        }
    }

    fn load_builtin_macros(&mut self) {
        // Built-in Macro 1: Halftime Show Intro
        let mut m1 = MacroDefinition::new("Halftime Show Intro");
        m1.description = "Shows lower third, pauses 1s, and cuts to Halftime video feed".into();
        m1.steps = vec![
            macro_engine::MacroStep {
                id: "step-1".into(),
                name: "Show Title Graphic".into(),
                step_type: macro_engine::MacroStepType::Action(ActionInvocation {
                    action_id: "graphics.takeOnAir".into(),
                    parameters: [("channelIndex".into(), serde_json::json!(1))].into(),
                }),
                enabled: true,
                timeout_ms: Some(2000),
            },
            macro_engine::MacroStep {
                id: "step-2".into(),
                name: "Pause 1 Second".into(),
                step_type: macro_engine::MacroStepType::Delay { duration_ms: 1000 },
                enabled: true,
                timeout_ms: Some(2000),
            },
            macro_engine::MacroStep {
                id: "step-3".into(),
                name: "Cut Preview to Program".into(),
                step_type: macro_engine::MacroStepType::Action(ActionInvocation {
                    action_id: "switcher.cut".into(),
                    parameters: HashMap::new(),
                }),
                enabled: true,
                timeout_ms: Some(2000),
            },
        ];

        self.macros.write().insert(m1.id.clone(), m1);
    }

    pub fn list_macros(&self) -> Vec<MacroDefinition> {
        let mut list: Vec<MacroDefinition> = self.macros.read().values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    pub fn get_macro(&self, id: &str) -> Option<MacroDefinition> {
        self.macros.read().get(id).cloned()
    }

    pub fn save_macro(&self, macro_def: MacroDefinition) {
        self.macros.write().insert(macro_def.id.clone(), macro_def);
    }

    pub fn delete_macro(&self, id: &str) -> bool {
        self.macros.write().remove(id).is_some()
    }

    pub async fn run_macro(
        &self,
        controller: &ProductionController,
        macro_id: &str,
        trigger_source: &str,
    ) -> Result<MacroExecutionRecord, LiveStudioError> {
        let macro_def = self.get_macro(macro_id).ok_or_else(|| {
            LiveStudioError::validation(format!("Macro '{macro_id}' not found"), Some("macroId"))
        })?;

        if !macro_def.enabled {
            return Err(LiveStudioError::validation("Macro is disabled", Some("enabled")));
        }

        if self.safety_governor.is_emergency_stopped() {
            return Err(LiveStudioError::validation(
                "Execution rejected: Emergency Stop is active",
                Some("emergencyStop"),
            ));
        }

        let record = self
            .macro_engine
            .execute_macro(controller, &macro_def, trigger_source, 0)
            .await?;

        self.history.push(record.clone());
        Ok(record)
    }

    pub async fn execute_action(
        &self,
        controller: &ProductionController,
        invocation: &ActionInvocation,
    ) -> Result<(), LiveStudioError> {
        let is_streaming = controller.output_engine.get_status().is_streaming;
        self.safety_governor
            .check_action_safety(&self.registry, invocation, is_streaming)?;

        self.macro_engine.dispatch_action(controller, invocation).await
    }

    pub fn emergency_stop(&self) {
        self.safety_governor.trip_emergency_stop();
        self.macro_engine.cancel_all();
    }

    pub fn reset_emergency_stop(&self) {
        self.safety_governor.reset_emergency_stop();
    }
}
