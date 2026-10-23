use std::path::Path;
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::media::rtsp::RtspSecurity;
use livestudio_lib::media::thumbnail::ThumbnailGenerator;
use livestudio_lib::project::db::DatabaseManager;
use livestudio_lib::project::model::{
    InputItem, InputState, InputType, MediaMetadata, CURRENT_SCHEMA_VERSION,
};
use livestudio_lib::project::persistence::ProjectStore;
use tempfile::tempdir;

#[test]
fn test_rtsp_credential_redaction() {
    let raw_url = "rtsp://admin:SecretPass123!@192.168.1.50:554/stream1";
    let redacted = RtspSecurity::redact_credentials(raw_url);
    assert!(!redacted.contains("SecretPass123!"));
    assert!(!redacted.contains("admin"));
    assert!(redacted.contains("192.168.1.50:554/stream1"));
    assert!(redacted.contains("redacted:redacted"));

    let no_auth_url = "rtsp://10.0.0.12:8554/live";
    assert_eq!(RtspSecurity::redact_credentials(no_auth_url), no_auth_url);
}

#[test]
fn test_sqlite_phase2_features() {
    let dir = tempdir().expect("Failed to create tempdir");
    let db_path = dir.path().join("phase2_assets.db");

    let db = DatabaseManager::with_path(db_path).expect("Failed to open db");
    let old_video_path = dir.path().join("promo.mp4");
    std::fs::write(&old_video_path, b"test dummy data").unwrap();

    let meta = MediaMetadata {
        container_format: "quicktime".into(),
        duration_seconds: 120.5,
        width: Some(3840),
        height: Some(2160),
        framerate: Some(59.94),
        video_codec: Some("h264".into()),
        audio_codec: Some("aac".into()),
        audio_channels: Some(2),
        audio_sample_rate: Some(48000),
        bitrate: Some(15000000),
        file_size_bytes: 1024 * 1024 * 200,
    };

    let fake_thumb = dir.path().join("promo_thumb.jpg");
    std::fs::write(&fake_thumb, b"thumb-jpg-data").unwrap();

    // 1. Index media asset with thumbnail and type
    db.index_media_asset("asset-promo", &old_video_path, "video", &meta, Some(&fake_thumb))
        .expect("Failed to index asset");

    // 2. Query search and sorting
    let results = db.get_all_assets(Some("promo"), None).expect("Search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].media_type, "video");
    assert_eq!(results[0].width, Some(3840));
    assert_eq!(results[0].thumbnail_path, Some(fake_thumb.to_string_lossy().to_string()));
    assert!(!results[0].is_missing);

    // 3. Asset relinking
    let new_video_path = dir.path().join("relinked_promo.mp4");
    std::fs::write(&new_video_path, b"new location data").unwrap();

    db.relink_asset(&old_video_path, &new_video_path).expect("Relink failed");

    let updated = db.get_all_assets(None, None).expect("Query failed");
    assert_eq!(updated.len(), 1);
    assert_eq!(updated[0].file_path, new_video_path.to_string_lossy().to_string());
}

#[test]
fn test_media_pipeline_playback_controls() {
    let controller = ProductionController::new().expect("Failed to instantiate controller");

    // Add a live test pattern input
    let input = InputItem::new("test-pattern-1", "Color Bars", InputType::TestPattern, "smpte");
    let proj = controller.add_input(input).expect("Failed to add input");
    assert_eq!(proj.inputs.len(), 1);

    // Initial state is Playing or Ready
    let state = controller.get_input_playback_state("test-pattern-1");
    assert!(state.is_some());

    // Test pause
    assert!(controller.pause_input("test-pattern-1").is_ok());
    let state = controller.get_input_playback_state("test-pattern-1").unwrap();
    assert!(state.is_paused);

    // Test play
    assert!(controller.play_input("test-pattern-1").is_ok());
    let state = controller.get_input_playback_state("test-pattern-1").unwrap();
    assert!(state.is_playing);

    // Test volume and loop
    assert!(controller.set_input_playback_volume("test-pattern-1", 0.65).is_ok());
    assert!(controller.set_input_playback_loop("test-pattern-1", false).is_ok());

    let state = controller.get_input_playback_state("test-pattern-1").unwrap();
    assert!((state.volume - 0.65).abs() < 0.01);
    assert!(!state.is_looping);

    // Test preview frame retrieval (data URL)
    // Give pipeline a tiny slice of time for videotestsrc to push a buffer
    std::thread::sleep(std::time::Duration::from_millis(100));
    let frame_opt = controller.get_preview_frame("test-pattern-1");
    if let Some(frame_url) = frame_opt {
        assert!(frame_url.starts_with("data:image/jpeg;base64,"));
    }

    // Stop and remove
    assert!(controller.stop_input("test-pattern-1").is_ok());
    let removed = controller.remove_input("test-pattern-1").expect("Failed to remove input");
    assert!(removed.inputs.is_empty());
}

#[test]
fn test_project_v1_to_v2_backward_compatibility() {
    // V1 project JSON without Phase 2 fields
    let v1_json = r#"{
        "schemaVersion": 1,
        "id": "project-phase1-id",
        "name": "Phase 1 Legacy Project",
        "createdAt": "2026-10-19T00:00:00Z",
        "updatedAt": "2026-10-19T00:00:00Z",
        "metadata": {
            "author": "Hari",
            "notes": "Original v1 format",
            "tags": ["v1", "legacy"]
        },
        "videoSettings": {
            "width": 1920,
            "height": 1080,
            "frameRateNumerator": 30,
            "frameRateDenominator": 1,
            "colorFormat": "RGBA"
        },
        "audioSettings": {
            "sampleRate": 48000,
            "channels": 2,
            "bitrate": 320
        },
        "outputSettings": {
            "streamEnabled": false,
            "streamService": "Custom RTMP",
            "streamUrl": "",
            "recordEnabled": false,
            "recordDirectory": "/tmp",
            "recordFormat": "mp4"
        },
        "inputs": [
            {
                "id": "legacy-input-1",
                "name": "Old Camera",
                "inputType": "videoCapture",
                "sourcePathOrId": "/dev/video0",
                "enabled": true,
                "volume": 0.8,
                "muted": false,
                "loopMedia": false
            }
        ],
        "switcherState": {
            "previewInputId": "legacy-input-1",
            "programInputId": null,
            "transitionDurationMs": 400,
            "transitionType": "cut"
        }
    }"#;

    let dir = tempdir().expect("Failed to create tempdir");
    let file_path = dir.path().join("migrated.lsproj");
    std::fs::write(&file_path, v1_json).expect("Failed to write legacy file");

    let loaded = ProjectStore::load(&file_path).expect("Failed to load v1 project");
    // Loaded project automatically upgrades to CURRENT_SCHEMA_VERSION (4)
    assert_eq!(loaded.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(loaded.inputs.len(), 1);
    assert_eq!(loaded.inputs[0].id, "legacy-input-1");
    assert_eq!(loaded.inputs[0].state, InputState::Ready);
    assert_eq!(loaded.inputs[0].is_missing, false);

    // Resave to verify clean v4 serializability
    ProjectStore::save(&loaded, &file_path).expect("Failed to save upgraded project");
    let content = std::fs::read_to_string(&file_path).expect("Failed to read back");
    assert!(content.contains(&format!("\"schemaVersion\": {}", CURRENT_SCHEMA_VERSION)));
}

#[test]
fn test_thumbnail_missing_file_safety() {
    let non_existent = Path::new("/non/existent/path/video.mp4");
    let res = ThumbnailGenerator::generate_thumbnail(non_existent, "sample-id");
    assert!(res.is_err(), "Must error gracefully on non-existent file without panicking");
}
