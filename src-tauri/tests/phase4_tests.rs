use image::{Rgba, RgbaImage};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tempfile::tempdir;

use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::output::credential::{redact_secret_from_message, redact_stream_url, CredentialVault};
use livestudio_lib::output::encoder::EncoderCapabilityAuditor;
use livestudio_lib::output::engine::{get_available_disk_space, NativeOutputEngine};
use livestudio_lib::output::model::{
    AudioCodec, OutputProfile, RecordingConfig,
    RecordingContainer, StreamDestination, VideoCodec,
};
use livestudio_lib::project::model::CURRENT_SCHEMA_VERSION;
use livestudio_lib::project::ProjectStore;

#[test]
fn test_encoder_capability_discovery() {
    let caps = EncoderCapabilityAuditor::audit_capabilities();
    assert!(!caps.is_empty(), "Encoder capabilities should not be empty");

    // Verify software fallback encoder is present and supported
    let x264_cap = caps.iter().find(|c| c.element_name == "x264enc");
    assert!(x264_cap.is_some(), "x264enc capability should be recognized");
    assert!(x264_cap.unwrap().supported, "x264enc should be supported on this platform");

    // Verify audio encoder
    let aac_elem = EncoderCapabilityAuditor::select_audio_encoder(AudioCodec::Aac);
    assert!(!aac_elem.is_empty(), "AAC audio encoder must be detected");
    assert!(
        aac_elem == "avenc_aac" || aac_elem == "fdkaacenc" || aac_elem == "faac" || aac_elem == "voaacenc",
        "AAC encoder must be a valid supported element"
    );
}

#[test]
fn test_credential_vault_and_redaction() {
    let vault = CredentialVault::new();
    let secret = "live_98765_super_secret_stream_key_xyz";

    let key_ref = vault.store_secret(secret);
    assert!(vault.has_secret(&key_ref));
    assert_eq!(vault.get_secret(&key_ref), Some(secret.to_string()));

    let masked = vault.get_masked(&key_ref);
    assert!(!masked.contains("secret"));
    assert!(masked.contains('•'));

    // URL redaction tests
    let rtmp_url = format!("rtmp://a.rtmp.youtube.com/live2/{secret}");
    let redacted_url = redact_stream_url(&rtmp_url);
    assert!(!redacted_url.contains(secret), "Secret must be redacted from URL");
    assert_eq!(redacted_url, "rtmp://a.rtmp.youtube.com/live2/******");

    // Query param redaction
    let rtmp_query_url = format!("rtmp://live.twitch.tv/app?key={secret}&test=1");
    let redacted_query = redact_stream_url(&rtmp_query_url);
    assert!(!redacted_query.contains(secret));
    assert!(redacted_query.contains("key=******"));

    // Message redaction
    let log_msg = format!("Failed to connect to rtmp://live.example.com/app/{}", secret);
    let redacted_msg = redact_secret_from_message(&log_msg, Some(secret));
    assert!(!redacted_msg.contains(secret), "Secret must not leak into logs");
    assert!(redacted_msg.contains("******"));
}

#[test]
fn test_output_profile_presets_and_customization() {
    let p_default = OutputProfile::default();
    assert_eq!(p_default.width, 1920);
    assert_eq!(p_default.height, 1080);
    assert_eq!(p_default.framerate, 60);
    assert_eq!(p_default.video_bitrate_kbps, 6000);
    assert_eq!(p_default.video_codec, VideoCodec::H264);

    let p_720p = OutputProfile::preset_720p30();
    assert_eq!(p_720p.width, 1280);
    assert_eq!(p_720p.height, 720);
    assert_eq!(p_720p.framerate, 30);
    assert_eq!(p_720p.video_bitrate_kbps, 3000);

    let p_1080p = OutputProfile::preset_1080p30();
    assert_eq!(p_1080p.framerate, 30);
    assert_eq!(p_1080p.video_bitrate_kbps, 4500);

    // Pipeline generation
    let bin_str = EncoderCapabilityAuditor::build_video_encode_bin(&p_default);
    assert!(bin_str.contains("bitrate="));
    assert!(bin_str.contains("h264parse"));
}

#[test]
fn test_schema_v4_migration_and_persistence() {
    let v1_legacy_json = r#"{
        "schemaVersion": 1,
        "id": "legacy-v1-project",
        "name": "Legacy V1 Show",
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
            "channels": 2
        },
        "outputSettings": {
            "streamEnabled": false,
            "streamService": "YouTube",
            "streamUrl": "",
            "recordEnabled": false,
            "recordDirectory": "/tmp",
            "recordFormat": "mp4"
        },
        "inputs": [],
        "switcherState": {
            "previewInputId": null,
            "programInputId": null,
            "transitionType": "cut",
            "transitionDurationMs": 0
        }
    }"#;

    let dir = tempdir().expect("Failed to create tempdir");
    let file_path = dir.path().join("v1_to_v4.lsproj");
    std::fs::write(&file_path, v1_legacy_json).expect("Failed to write legacy file");

    let loaded = ProjectStore::load(&file_path).expect("Failed to load and migrate v1 project");
    assert_eq!(loaded.schema_version, CURRENT_SCHEMA_VERSION);
    assert!(loaded.schema_version >= 4);

    // Verify Phase 4 defaults injected
    assert!(!loaded.output_profiles.is_empty());
    assert!(!loaded.streaming_destinations.is_empty());
    assert_eq!(loaded.recording_settings.container_format, RecordingContainer::Mp4);

    // Resave to verify clean upgraded round-trip
    ProjectStore::save(&loaded, &file_path).expect("Failed to save upgraded v4 project");
    let content = std::fs::read_to_string(&file_path).expect("Failed to read back");
    assert!(content.contains(&format!("\"schemaVersion\": {}", CURRENT_SCHEMA_VERSION)));
    assert!(content.contains("\"outputProfiles\""));
    assert!(content.contains("\"streamingDestinations\""));
    assert!(content.contains("\"recordingSettings\""));
}

#[test]
fn test_disk_space_and_collision_resistant_filenames() {
    let dir = tempdir().expect("Failed to create tempdir");
    let available = get_available_disk_space(dir.path());
    assert!(available > 0, "Available disk space must be greater than zero");

    let vault = Arc::new(CredentialVault::new());
    let engine = NativeOutputEngine::new(vault);

    let mut config = RecordingConfig::default();
    config.directory = dir.path().to_string_lossy().to_string();
    config.filename_pattern = "TestCollisionShow_{timestamp}".into();
    config.container_format = RecordingContainer::Mkv;

    let frame_counter = Arc::new(AtomicU32::new(0));
    let fc = frame_counter.clone();
    let frame_provider = move || {
        let val = (fc.fetch_add(1, Ordering::Relaxed) % 255) as u8;
        RgbaImage::from_pixel(320, 240, Rgba([val, 120, 200, 255]))
    };

    // Start first recording
    let path1 = engine
        .start_recording(Some(config.clone()), frame_provider.clone())
        .expect("First recording must start");
    assert!(Path::new(&path1).exists() || Path::new(&path1).extension().unwrap() == "mkv");

    // Sleep briefly to accumulate frames
    std::thread::sleep(std::time::Duration::from_millis(400));

    let stopped1 = engine.stop_recording().expect("First recording must stop cleanly");
    assert_eq!(path1, stopped1);
    assert!(Path::new(&stopped1).exists());
    let meta1 = std::fs::metadata(&stopped1).expect("Metadata must be readable");
    assert!(meta1.len() > 0, "Recorded MKV file must not be empty");

    // Immediate second recording with same config to test collision resistance
    let path2 = engine
        .start_recording(Some(config), frame_provider)
        .expect("Second recording must start");
    std::thread::sleep(std::time::Duration::from_millis(400));
    let stopped2 = engine.stop_recording().expect("Second recording must stop cleanly");

    assert_ne!(path1, path2, "Second recording must have a unique, non-colliding filename");
    assert!(Path::new(&stopped2).exists());
    let meta2 = std::fs::metadata(&stopped2).expect("Metadata must be readable");
    assert!(meta2.len() > 0, "Second recorded file must not be empty");
}

#[test]
fn test_simultaneous_streaming_and_recording_decoupling() {
    let dir = tempdir().expect("Failed to create tempdir");
    let vault = Arc::new(CredentialVault::new());
    let engine = NativeOutputEngine::new(vault.clone());

    // Setup destination
    let dest_id = "test-dest-rtmp";
    let dest = StreamDestination {
        id: dest_id.into(),
        name: "Test Stream Destination".into(),
        service: "Custom".into(),
        server_url: "rtmp://127.0.0.1:19350/live".into(),
        stream_key_ref: "key-123".into(),
        profile_id: "profile-1080p60-high".into(),
        enabled: true,
        reconnect_policy: Default::default(),
    };
    vault.set_secret("key-123", "secret_stream_token");
    engine.save_destination(dest, None);

    // Setup recording
    let mut rec_config = RecordingConfig::default();
    rec_config.directory = dir.path().to_string_lossy().to_string();
    rec_config.filename_pattern = "SimultaneousTest_{timestamp}".into();
    rec_config.container_format = RecordingContainer::Mp4;

    let frame_provider = || RgbaImage::from_pixel(320, 240, Rgba([200, 50, 50, 255]));

    // 1. Start local recording
    let rec_path = engine
        .start_recording(Some(rec_config), frame_provider)
        .expect("Recording should start");

    let status1 = engine.get_status();
    assert!(status1.is_recording);
    assert!(!status1.is_streaming);

    // 2. Start streaming destination (simultaneous)
    // Note: Since local port 19350 might not have an RTMP server, GStreamer will attempt connection
    // and might encounter network failure, but this MUST NEVER crash or interrupt the recording!
    let _ = engine.start_stream(dest_id, frame_provider);

    std::thread::sleep(std::time::Duration::from_millis(500));

    // 3. Stop streaming explicitly
    let _ = engine.stop_stream(dest_id);

    // 4. Verify recording is STILL RUNNING despite stream stop/failure!
    let status2 = engine.get_status();
    assert!(status2.is_recording, "Recording must remain active even when stream stops");

    // 5. Finalize recording and verify it is a valid file
    let final_path = engine.stop_recording().expect("Recording must stop cleanly");
    assert_eq!(rec_path, final_path);
    assert!(Path::new(&final_path).exists());
    let meta = std::fs::metadata(&final_path).expect("File metadata must exist");
    assert!(meta.len() > 0, "Simultaneous recording must produce non-empty MP4 output");
}

#[test]
fn test_production_controller_output_integration() {
    let controller = ProductionController::new().expect("Controller must initialize");

    let caps = controller.output_get_encoder_capabilities();
    assert!(!caps.is_empty());

    let profiles = controller.output_get_profiles();
    assert_eq!(profiles.len(), 3);

    let destinations = controller.output_get_destinations();
    assert_eq!(destinations.len(), 1);

    // Test saving new destination with stream key
    let mut new_dest = StreamDestination::default();
    new_dest.id = "twitch-live".into();
    new_dest.name = "Twitch Primary".into();
    new_dest.server_url = "rtmp://live.twitch.tv/app".into();

    let updated_proj = controller
        .output_save_destination(new_dest, Some("live_user_test_token_12345".into()))
        .expect("Saving destination should succeed");

    assert!(updated_proj.streaming_destinations.iter().any(|d| d.id == "twitch-live"));
    assert!(controller.is_dirty());

    // Check masked credential
    let twitch_dest = updated_proj
        .streaming_destinations
        .iter()
        .find(|d| d.id == "twitch-live")
        .unwrap();
    let masked = controller.output_get_masked_credential(&twitch_dest.stream_key_ref);
    assert!(masked.contains('•'));
    assert!(!masked.contains("12345"));

    // Check initial output status
    let status = controller.output_get_status();
    assert!(!status.is_streaming);
    assert!(!status.is_recording);
    assert!(status.available_disk_space_bytes > 0);
}
