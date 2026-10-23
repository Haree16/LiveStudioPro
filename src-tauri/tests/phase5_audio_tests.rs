use livestudio_lib::audio::{
    AudioBusRouting, AudioChannelStrip, DynamicsConfig, EqConfig,
    NativeAudioEngine,
};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{InputItem, InputType, CURRENT_SCHEMA_VERSION};
use tempfile::tempdir;

#[test]
fn test_audio_channel_strip_effective_volume_calculation() {
    let mut strip = AudioChannelStrip::new("cam-1", "Camera 1");

    // Default unity (0 dB gain, 0 dB fader) -> volume = 1.0
    assert_eq!(strip.gain_db, 0.0);
    assert_eq!(strip.fader_db, 0.0);
    let vol_unity = strip.calculate_effective_volume(true);
    assert!((vol_unity - 1.0).abs() < 1e-4);

    // Muted -> volume = 0.0
    strip.muted = true;
    assert_eq!(strip.calculate_effective_volume(true), 0.0);
    strip.muted = false;

    // Fader at floor (-60 dB) -> volume = 0.0
    strip.fader_db = -60.0;
    assert_eq!(strip.calculate_effective_volume(true), 0.0);

    // +6 dB boost -> volume ~= 1.995
    strip.fader_db = 6.0;
    let vol_boost = strip.calculate_effective_volume(true);
    assert!((vol_boost - 1.995).abs() < 0.05);

    // -6 dB cut -> volume ~= 0.501
    strip.fader_db = -6.0;
    let vol_cut = strip.calculate_effective_volume(true);
    assert!((vol_cut - 0.501).abs() < 0.05);
}

#[test]
fn test_audio_follow_video_and_transition_logic() {
    let engine = NativeAudioEngine::new().expect("Failed to create NativeAudioEngine");

    // Register two channels
    engine.ensure_channel_exists("cam-1", "Camera 1");
    engine.ensure_channel_exists("cam-2", "Camera 2");

    // Enable AFV on both
    engine.set_channel_afv("cam-1", true).unwrap();
    engine.set_channel_afv("cam-2", true).unwrap();

    let cfg = engine.get_config();
    assert!(cfg.channels.iter().find(|c| c.input_id == "cam-1").unwrap().afv);
    assert!(cfg.channels.iter().find(|c| c.input_id == "cam-2").unwrap().afv);

    // Set cam-1 as Program
    engine.on_program_source_changed(Some("cam-1".into()));

    // During transition from cam-1 to cam-2 at 50%
    engine.on_transition_progress("cam-1", "cam-2", 0.5);

    // Complete transition to cam-2
    engine.on_transition_completed("cam-2");
}

#[test]
fn test_audio_solo_and_bus_routing() {
    let engine = NativeAudioEngine::new().expect("Failed to create NativeAudioEngine");

    engine.ensure_channel_exists("mic-1", "Microphone 1");
    engine.ensure_channel_exists("music-1", "Background Music");

    // Set Solo on mic-1
    engine.set_channel_solo("mic-1", true).unwrap();

    let cfg = engine.get_config();
    assert!(cfg.channels.iter().find(|c| c.input_id == "mic-1").unwrap().solo);
    assert!(!cfg.channels.iter().find(|c| c.input_id == "music-1").unwrap().solo);

    // Configure Bus Routing
    let new_routing = AudioBusRouting {
        master: true,
        aux1: true,
        aux2: false,
        headphones: true,
    };
    engine.set_channel_bus_routing("mic-1", new_routing.clone()).unwrap();

    let updated_cfg = engine.get_config();
    let mic_strip = updated_cfg.channels.iter().find(|c| c.input_id == "mic-1").unwrap();
    assert!(mic_strip.routing.master);
    assert!(mic_strip.routing.aux1);
    assert!(!mic_strip.routing.aux2);
    assert!(mic_strip.routing.headphones);
}

#[test]
fn test_audio_dsp_eq_and_delay_parameters() {
    let engine = NativeAudioEngine::new().expect("Failed to create NativeAudioEngine");
    engine.ensure_channel_exists("vocal", "Lead Vocal");

    // Test 3-Band Parametric EQ
    let eq = EqConfig {
        enabled: true,
        low_gain_db: -3.0,
        mid_gain_db: 4.5,
        high_gain_db: 2.0,
    };
    engine.set_channel_eq("vocal", eq.clone()).unwrap();

    let cfg = engine.get_config();
    let vocal_ch = cfg.channels.iter().find(|c| c.input_id == "vocal").unwrap();
    assert!(vocal_ch.eq.enabled);
    assert_eq!(vocal_ch.eq.low_gain_db, -3.0);
    assert_eq!(vocal_ch.eq.mid_gain_db, 4.5);
    assert_eq!(vocal_ch.eq.high_gain_db, 2.0);

    // Test Lip-sync delay
    engine.set_channel_delay("vocal", 125).unwrap();
    let cfg_after_delay = engine.get_config();
    assert_eq!(
        cfg_after_delay.channels.iter().find(|c| c.input_id == "vocal").unwrap().delay_ms,
        125
    );

    // Test Dynamics
    let dynamics = DynamicsConfig {
        compressor_enabled: true,
        threshold_db: -18.0,
        ratio: 4.0,
        attack_ms: 25.0,
        release_ms: 150.0,
        gate_enabled: true,
        gate_threshold_db: -45.0,
    };
    engine.set_channel_dynamics("vocal", dynamics.clone()).unwrap();
    let cfg_after_dyn = engine.get_config();
    let ch_dyn = &cfg_after_dyn.channels.iter().find(|c| c.input_id == "vocal").unwrap().dynamics;
    assert!(ch_dyn.compressor_enabled);
    assert_eq!(ch_dyn.threshold_db, -18.0);
    assert_eq!(ch_dyn.ratio, 4.0);
    assert!(ch_dyn.gate_enabled);
    assert_eq!(ch_dyn.gate_threshold_db, -45.0);
}

#[test]
fn test_schema_v5_migration_and_project_persistence() {
    let temp_dir = tempdir().expect("Failed to create tempdir");
    let proj_path = temp_dir.path().join("production_v5.lsproj");

    let controller = ProductionController::new().expect("Failed to create ProductionController");

    // Add input
    let input = InputItem::new("media-1", "Main Video", InputType::ColorSource, "smpte");
    controller.add_input(input).expect("Failed to add input");

    // Set channel fader & AFV via controller
    controller.set_audio_channel_fader("media-1", -3.0).expect("Failed to set fader");
    controller.set_audio_channel_afv("media-1", true).expect("Failed to set AFV");
    controller.set_audio_bus_fader("master", 1.5).expect("Failed to set master fader");

    // Save project
    let saved_proj = controller.save_project_as(&proj_path).expect("Failed to save project");
    assert_eq!(saved_proj.schema_version, CURRENT_SCHEMA_VERSION);

    // Verify persisted audio mixer data
    let ch = saved_proj.audio_mixer.channels.iter().find(|c| c.input_id == "media-1").unwrap();
    assert_eq!(ch.fader_db, -3.0);
    assert!(ch.afv);

    let master_bus = saved_proj.audio_mixer.buses.iter().find(|b| b.id == "master").unwrap();
    assert_eq!(master_bus.fader_db, 1.5);

    // Reload project and verify controller restores audio mixer state
    let reloaded = controller.load_project(&proj_path).expect("Failed to load project");
    assert_eq!(reloaded.schema_version, CURRENT_SCHEMA_VERSION);
    let reloaded_mixer = controller.get_audio_mixer_state();
    let reloaded_ch = reloaded_mixer.channels.iter().find(|c| c.input_id == "media-1").unwrap();
    assert_eq!(reloaded_ch.fader_db, -3.0);
    assert!(reloaded_ch.afv);
}
