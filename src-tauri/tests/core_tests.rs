use std::path::PathBuf;
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::diagnostics::CapabilityAuditor;
use livestudio_lib::media::pipeline::MediaPipelineTester;
use livestudio_lib::media::{GStreamerEngine, MediaEngine};
use livestudio_lib::project::autosave::AutosaveManager;
use livestudio_lib::project::db::DatabaseManager;
use livestudio_lib::project::model::{InputItem, InputType, MediaMetadata, ProjectFile, CURRENT_SCHEMA_VERSION};
use livestudio_lib::project::persistence::ProjectStore;
use tempfile::tempdir;

#[test]
fn test_project_file_creation_and_validation() {
    let mut proj = ProjectFile::new("Test Production");
    assert_eq!(proj.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(proj.name, "Test Production");
    assert!(proj.validate().is_ok());

    // Validation failure on empty name
    proj.name = "   ".into();
    assert!(proj.validate().is_err());
    proj.name = "Valid Name".into();

    // Validation failure on zero dimensions
    proj.video_settings.width = 0;
    assert!(proj.validate().is_err());
    proj.video_settings.width = 1920;

    // Validation failure on zero fps
    proj.video_settings.frame_rate_denominator = 0;
    assert!(proj.validate().is_err());
    proj.video_settings.frame_rate_denominator = 1;

    // Validation failure on duplicate input IDs
    let input1 = InputItem::new("input-1", "Camera 1", InputType::VideoCapture, "/dev/video0");
    let input2 = input1.clone();
    proj.inputs = vec![input1, input2];
    assert!(proj.validate().is_err());
}

#[test]
fn test_project_atomic_persistence() {
    let dir = tempdir().expect("Failed to create tempdir");
    let file_path = dir.path().join("my_show.lsproj");

    let mut proj = ProjectFile::new("Show Live");
    let mut cam = InputItem::new("cam-main", "Main Cam", InputType::VideoCapture, "/dev/video0");
    cam.volume = 0.9;
    proj.inputs.push(cam);

    ProjectStore::save(&proj, &file_path).expect("Failed to save project");
    assert!(file_path.exists());

    let loaded = ProjectStore::load(&file_path).expect("Failed to load project");
    assert_eq!(loaded.id, proj.id);
    assert_eq!(loaded.name, "Show Live");
    assert_eq!(loaded.inputs.len(), 1);
    assert_eq!(loaded.inputs[0].id, "cam-main");
}

#[test]
fn test_autosave_crash_recovery_cycle() {
    let dir = tempdir().expect("Failed to create tempdir");
    let recovery_path = dir.path().join("session_recovery.json");

    let mgr = AutosaveManager::with_custom_path(recovery_path.clone());
    assert!(mgr.check_recovery().is_none());

    let proj = ProjectFile::new("Crash Test Project");
    mgr.save_recovery_snapshot(&proj, None).expect("Failed to write snapshot");
    assert!(recovery_path.exists());

    let rec = mgr.check_recovery().expect("Expected recovery snapshot");
    assert_eq!(rec.project.name, "Crash Test Project");

    mgr.clear_recovery_snapshot();
    assert!(mgr.check_recovery().is_none());
    assert!(!recovery_path.exists());
}

#[test]
fn test_sqlite_asset_indexing() {
    let dir = tempdir().expect("Failed to create tempdir");
    let db_path = dir.path().join("test_assets.db");

    let db = DatabaseManager::with_path(db_path).expect("Failed to open db");
    let fake_path = PathBuf::from("/media/videos/intro.mp4");

    let meta = MediaMetadata {
        container_format: "video/quicktime".into(),
        duration_seconds: 45.2,
        width: Some(1920),
        height: Some(1080),
        framerate: Some(60.0),
        video_codec: Some("video/x-h264".into()),
        audio_codec: Some("audio/mpeg".into()),
        audio_channels: Some(2),
        audio_sample_rate: Some(48000),
        bitrate: None,
        file_size_bytes: 1024 * 1024 * 50,
    };

    db.index_media_asset("asset-1", &fake_path, "video", &meta, None)
        .expect("Failed to index asset");

    let cached = db.get_cached_metadata(&fake_path).expect("Failed to retrieve cached metadata");
    assert_eq!(cached.width, Some(1920));
    assert_eq!(cached.duration_seconds, 45.2);
    assert_eq!(cached.video_codec, Some("video/x-h264".into()));
}

#[test]
fn test_media_engine_initialization() {
    let engine = GStreamerEngine::new();
    let res = engine.initialize();
    assert!(res.is_ok(), "GStreamer initialization failed");

    let status = engine.status();
    assert!(status.initialized);
    assert!(status.is_healthy);
    assert!(status.major >= 1);
    assert_eq!(status.backend_name, "GStreamer Native");
}

#[test]
fn test_minimal_pipeline_probe() {
    let res = MediaPipelineTester::test_minimal_pipeline()
        .expect("Failed to execute real GStreamer minimal pipeline");
    assert!(res.success);
    assert_eq!(res.reached_state, "Playing");
    assert!(res.latency_ms > 0.0);
}

#[test]
fn test_diagnostics_capability_audit() {
    let report = CapabilityAuditor::audit();
    assert!(!report.gstreamer_version.is_empty());
    assert!(!report.plugins.is_empty());
    // On Linux systems with GStreamer base installed, videotestsrc and fakesink must be present
    assert!(report.critical_missing_dependencies.is_empty(), "Missing dependencies: {:?}", report.critical_missing_dependencies);
}

#[test]
fn test_production_controller_switching_and_inputs() {
    let controller = ProductionController::new().expect("Failed to instantiate controller");
    
    // Add input 1 (Test pattern)
    let input1 = InputItem::new("cam-1", "Camera 1", InputType::TestPattern, "smpte");
    let proj = controller.add_input(input1).expect("Failed to add input 1");
    // First input becomes default Preview
    assert_eq!(proj.switcher_state.preview_input_id, Some("cam-1".into()));
    assert_eq!(proj.switcher_state.program_input_id, None);
    assert!(controller.is_dirty());

    // Add input 2 (Color source)
    let mut input2 = InputItem::new("clip-intro", "Intro Clip", InputType::ColorSource, "smpte");
    input2.volume = 0.8;
    controller.add_input(input2).expect("Failed to add input 2");

    // Execute CUT
    let proj = controller.cut().expect("Failed CUT");
    assert_eq!(proj.switcher_state.program_input_id, Some("cam-1".into()));
    assert_eq!(proj.switcher_state.preview_input_id, None);

    // Set Preview to clip-intro
    let proj = controller.set_preview(Some("clip-intro".into())).expect("Failed set preview");
    assert_eq!(proj.switcher_state.preview_input_id, Some("clip-intro".into()));

    // Execute AUTO transition
    let proj = controller.auto_transition(Some(300)).expect("Failed AUTO");
    assert_eq!(proj.switcher_state.program_input_id, Some("clip-intro".into()));
    assert_eq!(proj.switcher_state.preview_input_id, Some("cam-1".into()));

    // T-Bar clamping test
    assert_eq!(controller.set_tbar(0.5), 0.5);
    assert_eq!(controller.set_tbar(1.5), 1.0);
    assert_eq!(controller.set_tbar(-0.5), 0.0);
}
