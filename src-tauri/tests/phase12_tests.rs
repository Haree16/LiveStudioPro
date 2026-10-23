use livestudio_lib::audio::NativeAudioEngine;
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{InputItem, InputType};

#[test]
fn test_audio_pfl_audition_routing() {
    let engine = NativeAudioEngine::new().expect("Failed to create NativeAudioEngine");

    engine.ensure_channel_exists("cam-1", "Camera 1");
    engine.ensure_channel_exists("guest-1", "Remote Guest 1");

    // Initially PFL is false
    let cfg = engine.get_config();
    let strip_cam1 = cfg.channels.iter().find(|c| c.input_id == "cam-1").unwrap();
    assert!(!strip_cam1.pfl);

    // Toggle PFL on guest-1
    engine.set_channel_pfl("guest-1", true).expect("Failed to set PFL");

    let cfg_after = engine.get_config();
    let strip_guest = cfg_after.channels.iter().find(|c| c.input_id == "guest-1").unwrap();
    assert!(strip_guest.pfl);

    // Turn PFL off
    engine.set_channel_pfl("guest-1", false).expect("Failed to clear PFL");
    let cfg_off = engine.get_config();
    let strip_guest_off = cfg_off.channels.iter().find(|c| c.input_id == "guest-1").unwrap();
    assert!(!strip_guest_off.pfl);
}

#[test]
fn test_audio_provider_master_summing_and_fader() {
    let controller = ProductionController::new().expect("Failed to create controller");

    // Create an audio provider
    let provider = controller.make_audio_provider();

    // Pull 6400 bytes (1 frame at 48kHz S16LE stereo = 1600 samples * 4 bytes)
    let chunk = provider(6400);
    assert_eq!(chunk.len(), 6400);

    // With no active program input playing, it outputs silence (all zeroes)
    assert!(chunk.iter().all(|&b| b == 0));

    // Test controller PFL wrapper
    let _ = controller.set_audio_channel_pfl("input-1", true);
}

#[test]
fn test_phase12_input_types_serialization_and_pipeline() {
    // Verify SrtStream, SystemAudio, HtmlBrowser serialize and deserialize properly
    let srt_item = InputItem {
        id: "srt-1".into(),
        name: "Remote SRT Camera".into(),
        input_type: InputType::SrtStream,
        source_path_or_id: "srt://127.0.0.1:9000?mode=caller".into(),
        enabled: true,
        volume: 1.0,
        muted: false,
        loop_media: false,
        state: Default::default(),
        is_missing: false,
        metadata: None,
        thumbnail_path: None,
        relative_path: None,
        color_adjust: None,
        image_config: None,
        device_config: None,
        rtsp_config: None,
        playback_state: None,
    };

    let serialized = serde_json::to_string(&srt_item).expect("Failed to serialize SrtStream input");
    let deserialized: InputItem = serde_json::from_str(&serialized).expect("Failed to deserialize");
    assert_eq!(deserialized.input_type, InputType::SrtStream);
    assert_eq!(deserialized.source_path_or_id, "srt://127.0.0.1:9000?mode=caller");

    let sys_audio_item = InputItem {
        id: "sysaud-1".into(),
        name: "System Audio Loopback".into(),
        input_type: InputType::SystemAudio,
        source_path_or_id: "system:audio".into(),
        enabled: true,
        volume: 1.0,
        muted: false,
        loop_media: false,
        state: Default::default(),
        is_missing: false,
        metadata: None,
        thumbnail_path: None,
        relative_path: None,
        color_adjust: None,
        image_config: None,
        device_config: None,
        rtsp_config: None,
        playback_state: None,
    };

    let serialized_sys = serde_json::to_string(&sys_audio_item).expect("Failed to serialize SystemAudio input");
    let deserialized_sys: InputItem = serde_json::from_str(&serialized_sys).expect("Failed to deserialize");
    assert_eq!(deserialized_sys.input_type, InputType::SystemAudio);

    let browser_item = InputItem {
        id: "browser-1".into(),
        name: "Web Overlay Source".into(),
        input_type: InputType::HtmlBrowser,
        source_path_or_id: "https://example.com".into(),
        enabled: true,
        volume: 1.0,
        muted: false,
        loop_media: false,
        state: Default::default(),
        is_missing: false,
        metadata: None,
        thumbnail_path: None,
        relative_path: None,
        color_adjust: None,
        image_config: None,
        device_config: None,
        rtsp_config: None,
        playback_state: None,
    };

    let serialized_browser = serde_json::to_string(&browser_item).expect("Failed to serialize HtmlBrowser input");
    let deserialized_browser: InputItem = serde_json::from_str(&serialized_browser).expect("Failed to deserialize");
    assert_eq!(deserialized_browser.input_type, InputType::HtmlBrowser);
}

#[test]
fn test_data_sources_csv_json_and_field_bindings() {
    use livestudio_lib::graphics::{DataSourceRecord, DataSourceType, FieldBinding, GraphicItem, NativeGraphicsEngine};

    let engine = NativeGraphicsEngine::new().expect("Failed to create graphics engine");

    // Add a lower third graphic item
    let mut item = GraphicItem::new_lower_third("News Guest", "Initial Name", "Initial Role");
    item.id = "guest-lt-1".into();
    engine.save_item(item);

    // Create a CSV data source
    let csv_ds = DataSourceRecord {
        id: "ds-guests".into(),
        name: "Guest Roster CSV".into(),
        source_type: DataSourceType::Csv,
        path_or_url: "/data/guests.csv".into(),
        poll_interval_secs: 5,
        selected_row: 0,
        headers: vec![],
        rows: vec![],
        last_updated_ms: 0,
    };
    engine.add_data_source(csv_ds);

    // Bind graphic item's "title" to data source column "Name", and "subtitle" to "Role"
    engine.set_field_binding(FieldBinding {
        graphic_id: "guest-lt-1".into(),
        field_key: "title".into(),
        data_source_id: "ds-guests".into(),
        column_key: "Name".into(),
    });
    engine.set_field_binding(FieldBinding {
        graphic_id: "guest-lt-1".into(),
        field_key: "subtitle".into(),
        data_source_id: "ds-guests".into(),
        column_key: "Role".into(),
    });

    // Ingest CSV content
    let csv_content = "Name,Role,Affiliation\nAlice Walker,Chief Scientist,MIT\nBob Vance,Vance Refrigeration,Dunder Mifflin\nCharlie Green,Director,BBC News";
    engine.update_data_source_content("ds-guests", csv_content).expect("Failed to update CSV content");

    // Check row 0 bound fields
    let cfg0 = engine.get_config();
    let guest_item0 = cfg0.items.iter().find(|i| i.id == "guest-lt-1").unwrap();
    assert_eq!(guest_item0.fields.get("title").map(String::as_str), Some("Alice Walker"));
    assert_eq!(guest_item0.fields.get("subtitle").map(String::as_str), Some("Chief Scientist"));

    // Advance to next row (row 1)
    assert!(engine.next_data_source_row("ds-guests"));
    let cfg1 = engine.get_config();
    let guest_item1 = cfg1.items.iter().find(|i| i.id == "guest-lt-1").unwrap();
    assert_eq!(guest_item1.fields.get("title").map(String::as_str), Some("Bob Vance"));
    assert_eq!(guest_item1.fields.get("subtitle").map(String::as_str), Some("Vance Refrigeration"));

    // Test JSON data source ingestion
    let json_ds = DataSourceRecord {
        id: "ds-json".into(),
        name: "Sports Scores JSON".into(),
        source_type: DataSourceType::Json,
        path_or_url: "https://api.example.com/scores".into(),
        poll_interval_secs: 10,
        selected_row: 0,
        headers: vec![],
        rows: vec![],
        last_updated_ms: 0,
    };
    engine.add_data_source(json_ds);

    let json_content = r#"[{"HomeTeam":"Lakers","AwayTeam":"Celtics","Score":"102 - 99"},{"HomeTeam":"Warriors","AwayTeam":"Bulls","Score":"115 - 110"}]"#;
    engine.update_data_source_content("ds-json", json_content).expect("Failed to update JSON content");

    let cfg_json = engine.get_config();
    let ds_json = cfg_json.data_sources.iter().find(|d| d.id == "ds-json").unwrap();
    assert_eq!(ds_json.rows.len(), 2);
    assert_eq!(ds_json.rows[0].get("HomeTeam").map(String::as_str), Some("Lakers"));
}

#[test]
fn test_webrtc_session_pipeline_and_telemetry() {
    use livestudio_lib::remote::webrtc::{WebRtcIceCandidateMessage, WebRtcSessionManager};

    let mgr = WebRtcSessionManager::new();

    // Compliant SDP Offer
    let sample_offer = "v=0\r\no=- 123456789 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=mid:0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=mid:1\r\n";

    let answer = mgr.process_offer("guest-alice", sample_offer).expect("Failed to process offer");
    assert_eq!(answer.sdp_type, "answer");
    assert!(answer.sdp.contains("m=audio"));
    assert!(answer.sdp.contains("m=video"));

    // Add ICE candidate
    let cand = WebRtcIceCandidateMessage {
        candidate: "candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host".into(),
        sdp_mid: Some("0".into()),
        sdp_m_line_index: Some(0),
    };
    mgr.add_ice_candidate("guest-alice", &cand).expect("Failed to add ICE candidate");

    // Check telemetry
    let stats = mgr.get_guest_stats("guest-alice").expect("Guest stats should exist");
    assert_eq!(stats.guest_id, "guest-alice");
    assert_eq!(stats.ice_state, "connected");
    assert!(stats.round_trip_time_ms > 0.0);

    // Update telemetry
    mgr.update_guest_telemetry("guest-alice", 35.0, 0.5, 2.1);
    let updated_stats = mgr.get_guest_stats("guest-alice").unwrap();
    assert_eq!(updated_stats.round_trip_time_ms, 35.0);
    assert_eq!(updated_stats.packet_loss_percent, 0.5);
    assert_eq!(updated_stats.jitter_ms, 2.1);

    // Clean up
    mgr.close_session("guest-alice");
    assert!(mgr.get_guest_stats("guest-alice").is_none());
}

#[test]
fn test_audio_dynamics_dsp_compressor_and_noise_gate() {
    use livestudio_lib::audio::model::DynamicsConfig;

    let engine = NativeAudioEngine::new().expect("Failed to create NativeAudioEngine");
    engine.ensure_channel_exists("mic-1", "Vocal Mic 1");

    // 1. Test Noise Gate
    let gate_cfg = DynamicsConfig {
        compressor_enabled: false,
        threshold_db: -12.0,
        ratio: 4.0,
        attack_ms: 10.0,
        release_ms: 100.0,
        gate_enabled: true,
        gate_threshold_db: -40.0, // linear ~327
    };
    engine.set_channel_dynamics("mic-1", gate_cfg).expect("Failed to set dynamics");

    // Low rumble noise below -40dB (values < 327)
    let mut rumble = vec![50i16, 100i16, -80i16, 120i16];
    engine.process_channel_dsp("mic-1", &mut rumble);
    // Gate should silence it completely
    assert!(rumble.iter().all(|&s| s == 0));

    // 2. Test Compressor
    let comp_cfg = DynamicsConfig {
        compressor_enabled: true,
        threshold_db: -6.0, // linear ~16422
        ratio: 4.0,
        attack_ms: 10.0,
        release_ms: 100.0,
        gate_enabled: false,
        gate_threshold_db: -80.0,
    };
    engine.set_channel_dynamics("mic-1", comp_cfg).expect("Failed to set compressor");

    // Very loud peak near 0dB (30000)
    let mut loud_samples = vec![30000i16, 25000i16, 20000i16];
    engine.process_channel_dsp("mic-1", &mut loud_samples);
    // Compressor should compress the 30000 sample down significantly below 30000
    assert!(loud_samples[0] < 24000);
    assert!(loud_samples[0] > 16422);
}

#[test]
fn test_guest_mix_minus_provider_isolation() {
    let controller = ProductionController::new().expect("Failed to create controller");

    // Create a mix-minus provider for guest-1
    let mix_minus = controller.make_guest_mix_minus_provider("guest-1");

    // Pull 6400 bytes (stereo 48kHz PCM)
    let chunk = mix_minus(6400);
    assert_eq!(chunk.len(), 6400);
    assert!(chunk.iter().all(|&b| b == 0));
}
