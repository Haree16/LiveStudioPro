use chrono::{Duration, Utc};
use serde_json::json;
use std::collections::HashMap;

use livestudio_lib::automation::{
    action::{ActionCategory, ActionInvocation, ActionRegistry, ActionSafetyTier},
    event_bus::{EventBus, EventTriggerRule, ProductionEventType},
    hotkeys::{HotkeyManager, HotkeyMapping},
    macro_engine::{MacroDefinition, MacroStep, MacroStepType},
    midi::{MidiControlMode, MidiMapping, MidiMessageType, MidiSubsystem},
    scheduler::{AutomationScheduler, MissedCuePolicy, TimedCue, TimedCueStatus},
};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{ProjectFile, CURRENT_SCHEMA_VERSION};

#[test]
fn test_action_registry_validation() {
    let registry = ActionRegistry::new();
    let actions = registry.list();
    assert!(!actions.is_empty(), "Builtin actions should be registered");

    // Check switcher.cut definition
    let cut = registry.get("switcher.cut").expect("switcher.cut must exist");
    assert_eq!(cut.category, ActionCategory::Switcher);
    assert_eq!(cut.safety_tier, ActionSafetyTier::ProgramAffecting);

    // Valid invocation of switcher.cut (requires 0 parameters)
    let valid_inv = ActionInvocation {
        action_id: "switcher.cut".into(),
        parameters: HashMap::new(),
    };
    assert!(registry.validate_invocation(&valid_inv).is_ok());

    // Invalid invocation of switcher.setPreview (missing required inputId)
    let invalid_inv = ActionInvocation {
        action_id: "switcher.setPreview".into(),
        parameters: HashMap::new(),
    };
    assert!(registry.validate_invocation(&invalid_inv).is_err());

    // Unknown action
    let unknown_inv = ActionInvocation {
        action_id: "nonexistent.action".into(),
        parameters: HashMap::new(),
    };
    assert!(registry.validate_invocation(&unknown_inv).is_err());
}

#[tokio::test]
async fn test_macro_sequential_execution_and_delays() {
    let controller = ProductionController::new().expect("Failed to create controller");
    let engine = &controller.automation_engine;

    let mut macro_def = MacroDefinition::new("Test Cut Sequence");
    macro_def.steps = vec![
        MacroStep {
            id: "step-1".into(),
            name: "Cut 1".into(),
            step_type: MacroStepType::Action(ActionInvocation {
                action_id: "switcher.cut".into(),
                parameters: HashMap::new(),
            }),
            enabled: true,
            timeout_ms: Some(2000),
        },
        MacroStep {
            id: "step-2".into(),
            name: "Short Delay".into(),
            step_type: MacroStepType::Delay { duration_ms: 50 },
            enabled: true,
            timeout_ms: Some(1000),
        },
        MacroStep {
            id: "step-3".into(),
            name: "Cut 2".into(),
            step_type: MacroStepType::Action(ActionInvocation {
                action_id: "switcher.cut".into(),
                parameters: HashMap::new(),
            }),
            enabled: true,
            timeout_ms: Some(2000),
        },
    ];

    engine.save_macro(macro_def.clone());

    let record = engine
        .run_macro(&controller, &macro_def.id, "unit-test")
        .await
        .expect("Macro execution should succeed");

    assert_eq!(record.executed_steps, 3);
    assert!(record.duration_ms >= 45, "Execution must respect step delay");

    let history = engine.history.list(None);
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].macro_id, macro_def.id);
}

#[tokio::test]
async fn test_macro_recursion_depth_limit() {
    let controller = ProductionController::new().expect("Failed to create controller");
    let engine = &controller.automation_engine;

    let recursive_macro = MacroDefinition::new("Recursive Loop");

    // Attempting to execute beyond MAX_RECURSION_DEPTH (5)
    let result = engine
        .macro_engine
        .execute_macro(&controller, &recursive_macro, "recursion-test", 6)
        .await;

    assert!(
        result.is_err(),
        "Nesting beyond MAX_RECURSION_DEPTH must be caught and rejected by safety guard"
    );
    let err_str = result.unwrap_err().to_string();
    assert!(
        err_str.contains("depth") || err_str.contains("recursion") || err_str.contains("exceeded"),
        "Error message should mention recursion depth: {}",
        err_str
    );
}

#[tokio::test]
async fn test_emergency_stop_halting() {
    let controller = ProductionController::new().expect("Failed to create controller");
    let engine = &controller.automation_engine;

    let mut m = MacroDefinition::new("Long Macro");
    m.steps = vec![
        MacroStep {
            id: "s1".into(),
            name: "Delay 500ms".into(),
            step_type: MacroStepType::Delay { duration_ms: 500 },
            enabled: true,
            timeout_ms: Some(2000),
        },
    ];
    let macro_id = m.id.clone();
    engine.save_macro(m);

    // Trip emergency stop
    engine.emergency_stop();
    assert!(engine.safety_governor.is_emergency_stopped());

    // Attempting to run should be rejected immediately
    let res = engine.run_macro(&controller, &macro_id, "test").await;
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert!(err.to_string().contains("Emergency Stop"));

    // Reset emergency stop
    engine.reset_emergency_stop();
    assert!(!engine.safety_governor.is_emergency_stopped());

    // Should now run
    let res2 = engine.run_macro(&controller, &macro_id, "test").await;
    assert!(res2.is_ok());
}

#[test]
fn test_hotkey_conflict_detection() {
    let manager = HotkeyManager::new();

    let valid_set = vec![
        HotkeyMapping {
            id: "h1".into(),
            key_combination: "Space".into(),
            target_action_id: Some("switcher.cut".into()),
            target_macro_id: None,
            description: "Cut".into(),
            enabled: true,
            is_global: false,
        },
        HotkeyMapping {
            id: "h2".into(),
            key_combination: "Ctrl+Shift+1".into(),
            target_action_id: Some("switcher.auto".into()),
            target_macro_id: None,
            description: "Auto".into(),
            enabled: true,
            is_global: false,
        },
    ];
    assert!(manager.set_mappings(valid_set).is_ok());

    let conflicting_set = vec![
        HotkeyMapping {
            id: "h1".into(),
            key_combination: "Ctrl+F1".into(),
            target_action_id: Some("switcher.cut".into()),
            target_macro_id: None,
            description: "Cut Preview".into(),
            enabled: true,
            is_global: false,
        },
        HotkeyMapping {
            id: "h2".into(),
            key_combination: "ctrl + f1".into(), // case and whitespace variance
            target_action_id: Some("switcher.auto".into()),
            target_macro_id: None,
            description: "Auto Take".into(),
            enabled: true,
            is_global: false,
        },
    ];
    assert!(
        manager.set_mappings(conflicting_set).is_err(),
        "Conflicting shortcut combinations must be detected and rejected"
    );
}

#[test]
fn test_midi_message_processing_and_fader_normalization() {
    let midi = MidiSubsystem::new();

    let fader_map = MidiMapping {
        id: "m-fader".into(),
        name: "Audio Master Fader".into(),
        device_name: Some("Korg nanoKONTROL2".into()),
        channel: Some(0),
        message_type: MidiMessageType::ControlChange,
        note_or_cc: 7, // Volume CC
        control_mode: MidiControlMode::ContinuousFader,
        target_action_id: Some("audio.setFader".into()),
        target_macro_id: None,
        min_value: -60.0,
        max_value: 6.0,
        enabled: true,
    };
    midi.set_mappings(vec![fader_map]);

    // 0xB0 = CC on channel 0; CC 7; value 0 (minimum)
    let min_raw = [0xB0, 7, 0];
    let (mapping, norm_val) = midi
        .process_raw_message("Korg nanoKONTROL2", &min_raw)
        .expect("Message should match mapping");
    assert_eq!(mapping.id, "m-fader");
    let val = norm_val.expect("Continuous fader must have normalized value");
    assert!((val - -60.0).abs() < 0.01, "Expected -60.0 dB at 0 CC, got {val}");

    // CC value 127 (maximum)
    let max_raw = [0xB0, 7, 127];
    let (_, norm_val_max) = midi
        .process_raw_message("Korg nanoKONTROL2", &max_raw)
        .expect("Message should match mapping");
    let val_max = norm_val_max.unwrap();
    assert!((val_max - 6.0).abs() < 0.01, "Expected +6.0 dB at 127 CC, got {val_max}");
}

#[test]
fn test_scheduler_startup_reconciliation() {
    let scheduler = AutomationScheduler::new();

    // Cue in the past (10 minutes ago)
    let past_time = Utc::now() - Duration::minutes(10);
    let mut past_cue = TimedCue::new_one_time("Past Promo", "macro-promo", past_time);
    past_cue.missed_policy = MissedCuePolicy::ExecuteImmediately;

    let mut skip_cue = TimedCue::new_one_time("Past News", "macro-news", past_time);
    skip_cue.missed_policy = MissedCuePolicy::Skip;

    scheduler.add_cue(past_cue);
    scheduler.add_cue(skip_cue);

    // Reconcile on startup
    let immediate_macros = scheduler.reconcile_startup();
    assert_eq!(immediate_macros.len(), 1);
    assert_eq!(immediate_macros[0], "macro-promo");

    let cues = scheduler.list_cues();
    for c in cues {
        if c.target_macro_id == "macro-news" {
            assert_eq!(c.status, TimedCueStatus::Missed);
        } else if c.target_macro_id == "macro-promo" {
            assert_eq!(c.status, TimedCueStatus::Triggered);
        }
    }
}

#[test]
fn test_event_bus_throttling_and_dispatch() {
    let bus = EventBus::new();

    let rule = EventTriggerRule {
        id: "trig-stream".into(),
        name: "On Stream Start".into(),
        event_type: ProductionEventType::StreamStarted,
        filter_field: None,
        filter_value: None,
        target_macro_id: "macro-stream-intro".into(),
        enabled: true,
        cooldown_ms: 1000,
        last_triggered: None,
    };
    bus.register_rule(rule);

    let macros_1 = bus.emit(ProductionEventType::StreamStarted, HashMap::new());
    assert_eq!(macros_1.len(), 1);
    assert_eq!(macros_1[0], "macro-stream-intro");

    // Immediate second trigger within cooldown should be dropped to prevent loop
    let macros_2 = bus.emit(ProductionEventType::StreamStarted, HashMap::new());
    assert_eq!(macros_2.len(), 0, "Rapid event retrigger within cooldown must be throttled");
}

#[test]
fn test_schema_v9_backward_compatibility() {
    let v1_json = json!({
        "schemaVersion": 1,
        "id": "proj-v1",
        "name": "Legacy Production",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
        "videoSettings": {
            "width": 1920,
            "height": 1080,
            "frameRateNumerator": 30,
            "frameRateDenominator": 1,
            "colorFormat": "NV12"
        },
        "audioSettings": {
            "sampleRate": 48000,
            "channels": 2,
            "bitDepth": 16,
            "masterVolume": 1.0
        },
        "outputSettings": {
            "streamEnabled": false,
            "streamService": "RTMP",
            "streamUrl": "",
            "recordEnabled": false,
            "recordDirectory": "",
            "recordFormat": "mp4"
        },
        "inputs": [],
        "switcherState": {
            "previewInputId": null,
            "programInputId": null,
            "transitionDurationMs": 300,
            "transitionType": "cut"
        }
    });

    let migrated = ProjectFile::migrate_from_v1(v1_json).expect("Schema migration to v9 should succeed");
    assert_eq!(migrated.schema_version, CURRENT_SCHEMA_VERSION);
    assert!(CURRENT_SCHEMA_VERSION >= 9);
    assert!(migrated.macros.is_empty());
    assert!(migrated.hotkeys.is_empty());
    assert!(migrated.midi_mappings.is_empty());
    assert!(migrated.event_triggers.is_empty());
    assert!(migrated.automation_cues.is_empty());
}
