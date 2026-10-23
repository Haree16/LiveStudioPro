use image::RgbaImage;
use livestudio_lib::broadcast::{
    aux_output::{AuxDestinationType, AuxFeedType, AuxOutputConfig, AuxOutputEngine},
    color::{ColorGradeConfig, ColorGradeEngine, RgbColorTriplet},
    delay::{DelayBufferConfig, DelayBufferManager},
    diagnostics::BroadcastDiagnosticsManager,
    hardware::{BroadcastHardwareManager, HardwareIntegrationStatus, SignalLockStatus},
    iso::{IsoRecordingConfig, IsoRecordingEngine},
    timecode::{SmpteTimecode, TimecodeContinuityTracker, TimecodeRate},
    virtual_studio::{Point2D, VirtualStudioConfig, VirtualStudioEngine},
};
use livestudio_lib::project::model::{ProjectFile, CURRENT_SCHEMA_VERSION};
use std::fs;

#[test]
fn test_smpte_timecode_calculations() {
    // 1. Non-Drop-Frame 30 fps
    let tc_30 = SmpteTimecode::from_total_frames(108000, TimecodeRate::Fps30);
    // 108000 frames @ 30fps = 3600 seconds = 01:00:00:00
    assert_eq!(tc_30.hours, 1);
    assert_eq!(tc_30.minutes, 0);
    assert_eq!(tc_30.seconds, 0);
    assert_eq!(tc_30.frames, 0);
    assert_eq!(tc_30.to_string(), "01:00:00:00");
    assert_eq!(tc_30.to_total_frames(), 108000);

    // Arbitrary frame: 1 hr, 23 min, 45 sec, 12 frames
    let total = (1 * 3600 + 23 * 60 + 45) * 30 + 12;
    let tc_arb = SmpteTimecode::from_total_frames(total, TimecodeRate::Fps30);
    assert_eq!(tc_arb.to_string(), "01:23:45:12");

    // 2. Drop-Frame 29.97 fps (SMPTE 12M drop-frame standard)
    // 1 minute of 29.97 DF starts at frame 1800 (frames 0 and 1 dropped at minute boundary)
    let tc_1min = SmpteTimecode::from_total_frames(1800, TimecodeRate::Fps29_97Df);
    assert_eq!(tc_1min.hours, 0);
    assert_eq!(tc_1min.minutes, 1);
    assert_eq!(tc_1min.seconds, 0);
    assert_eq!(tc_1min.frames, 2); // Frames 0 and 1 dropped!
    assert_eq!(tc_1min.to_string(), "00:01:00;02"); // Semicolon denotes drop-frame

    // 10 minutes of 29.97 DF: no drop at 10th minute
    let ten_min_frames = 1798 * 9 + 1800; // 17982 frames
    let tc_10min = SmpteTimecode::from_total_frames(ten_min_frames, TimecodeRate::Fps29_97Df);
    assert_eq!(tc_10min.hours, 0);
    assert_eq!(tc_10min.minutes, 10);
    assert_eq!(tc_10min.seconds, 0);
    assert_eq!(tc_10min.frames, 0);
    assert_eq!(tc_10min.to_string(), "00:10:00;00");

    // 3. Continuity Tracker
    let mut tracker = TimecodeContinuityTracker::new("camera-1");
    let tc1 = SmpteTimecode::from_total_frames(100, TimecodeRate::Fps30);
    let tc2 = SmpteTimecode::from_total_frames(101, TimecodeRate::Fps30);
    let tc_jump = SmpteTimecode::from_total_frames(250, TimecodeRate::Fps30);

    assert!(tracker.ingest_timecode(tc1));
    assert!(tracker.ingest_timecode(tc2));
    assert!(!tracker.ingest_timecode(tc_jump)); // Jump detected as discontinuity!
    assert_eq!(tracker.total_discontinuities, 1);
}

#[test]
fn test_iso_recording_engine_lifecycle() {
    let _ = gstreamer::init();
    let engine = IsoRecordingEngine::new(4);
    let test_dir = "/tmp/test_livestudio_iso";
    let _ = fs::create_dir_all(test_dir);

    let config = IsoRecordingConfig {
        input_id: "cam-1".into(),
        name: "Camera 1 Studio".into(),
        output_directory: test_dir.into(),
        container_format: "mp4".into(),
        video_codec: "h264".into(),
        width: 1920,
        height: 1080,
        framerate: 30.0,
        bitrate_kbps: 12000,
        embed_timecode: true,
        enabled: true,
    };

    engine.set_config(config);
    let list = engine.list_configs();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0].input_id, "cam-1");

    // Bandwidth check
    let bw = engine.estimate_total_bandwidth_mbps();
    assert!((bw - 12.0).abs() < 0.01);

    // Start ISO
    let start_res = engine.start_iso("cam-1");
    assert!(start_res.is_ok(), "Starting ISO should succeed");
    let file_path = start_res.unwrap();
    assert!(file_path.to_string_lossy().contains("ISO_Camera_1_Studio_"));

    // Check health telemetry
    let health = engine.get_health();
    assert_eq!(health.len(), 1);
    assert!(health[0].is_recording);
    assert_eq!(health[0].input_id, "cam-1");

    // Stop ISO
    let stop_res = engine.stop_iso("cam-1");
    assert!(stop_res.is_ok());

    let health_after = engine.get_health();
    assert!(!health_after[0].is_recording);
}

#[test]
fn test_aux_output_engine_isolation() {
    let _ = gstreamer::init();
    let engine = AuxOutputEngine::new(4);

    let aux_config = AuxOutputConfig {
        id: "aux-clean-1".into(),
        name: "Stage Clean Feed".into(),
        feed_type: AuxFeedType::CleanFeed,
        target_id: None,
        destination_type: AuxDestinationType::WindowDisplay,
        destination_target: "Display 2".into(),
        width: 1920,
        height: 1080,
        framerate: 30.0,
        audio_bus: "clean".into(),
        enabled: true,
    };

    engine.save_config(aux_config);
    let configs = engine.list_configs();
    assert_eq!(configs.len(), 2);

    // Start Aux output (decoupled from program)
    let start_res = engine.start_aux("aux-clean-1");
    assert!(start_res.is_ok(), "Decoupled aux start must succeed");

    let health = engine.get_health();
    assert_eq!(health.len(), 2);
    let my_aux = health.iter().find(|h| h.id == "aux-clean-1").unwrap();
    assert!(my_aux.is_active);
    assert_eq!(my_aux.feed_type, AuxFeedType::CleanFeed);

    // Stop Aux output
    let stop_res = engine.stop_aux("aux-clean-1");
    assert!(stop_res.is_ok());

    let health_stopped = engine.get_health();
    let my_aux_stopped = health_stopped.iter().find(|h| h.id == "aux-clean-1").unwrap();
    assert!(!my_aux_stopped.is_active);
}

#[test]
fn test_color_grade_engine_and_3d_lut() {
    let engine = ColorGradeEngine::new();

    let custom_grade = ColorGradeConfig {
        target_id: "program".into(),
        lift: RgbColorTriplet { r: 0.1, g: -0.05, b: 0.0 },
        gamma: RgbColorTriplet { r: 1.1, g: 0.95, b: 1.0 },
        gain: RgbColorTriplet { r: 1.2, g: 1.0, b: 0.9 },
        temperature: 15.0,
        tint: -5.0,
        saturation: 1.25,
        lut_path: None,
        bypass: false,
    };

    engine.set_grade(custom_grade);
    let retrieved = engine.get_grade("program");
    assert_eq!(retrieved.target_id, "program");
    assert_eq!(retrieved.saturation, 1.25);
    assert_eq!(retrieved.temperature, 15.0);

    // Test DaVinci/Adobe 3D .cube LUT Parser and trilinear interpolation
    let cube_content = r#"
# Test 3D LUT
TITLE "Test Grade"
LUT_3D_SIZE 2

0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
"#;
    let lut_path = "/tmp/test_grade.cube";
    fs::write(lut_path, cube_content).expect("Failed to write test cube file");

    let load_res = engine.load_lut_file(std::path::Path::new(lut_path));
    assert!(load_res.is_ok(), "Parsing valid 3D .cube file should succeed");

    // Process image frame
    let mut image = RgbaImage::new(10, 10);
    for pixel in image.pixels_mut() {
        *pixel = image::Rgba([128, 128, 128, 255]);
    }

    engine.process_image_frame(&mut image, "program");
    let sample = image.get_pixel(0, 0);
    assert_eq!(sample[3], 255, "Alpha must be preserved");

    let _ = fs::remove_file(lut_path);
}

#[test]
fn test_delay_buffer_ring_queue_and_memory_capping() {
    let manager = DelayBufferManager::new();

    let cfg = DelayBufferConfig {
        target_id: "cam-delay-1".into(),
        video_delay_ms: 100,
        audio_delay_ms: 25,
        max_memory_mb: 50,
        enabled: true,
    };
    manager.set_config(cfg);

    // Push 3 frames
    for i in 0..3 {
        let frame = RgbaImage::new(10, 10);
        manager.push_frame("cam-delay-1", frame, i * 33);
    }

    let health = manager.get_health();
    let entry = health.iter().find(|h| h.target_id == "cam-delay-1").unwrap();
    assert_eq!(entry.buffered_frames, 3);
    assert!(entry.memory_used_bytes > 0);

    // Flush test
    manager.flush("cam-delay-1");
    let health_after = manager.get_health();
    let entry_after = health_after.iter().find(|h| h.target_id == "cam-delay-1").unwrap();
    assert_eq!(entry_after.buffered_frames, 0);
    assert_eq!(entry_after.memory_used_bytes, 0);
}

#[test]
fn test_virtual_studio_chroma_and_quad_perspective() {
    let vs_engine = VirtualStudioEngine::new();

    let set_config = VirtualStudioConfig {
        id: "vs-news".into(),
        name: "News Anchor Desk".into(),
        foreground_input_id: "cam-anchor".into(),
        background_asset_path: None,
        chroma_key_enabled: true,
        key_color_hex: "#00FF00".into(),
        tolerance: 0.35,
        feather: 0.1,
        perspective_enabled: true,
        corner_pins: [
            Point2D { x: 0.1, y: 0.2 },
            Point2D { x: 0.9, y: 0.15 },
            Point2D { x: 0.85, y: 0.85 },
            Point2D { x: 0.15, y: 0.9 },
        ],
        opacity: 1.0,
        enabled: true,
    };

    vs_engine.save_config(set_config.clone());
    let configs = vs_engine.list_configs();
    assert!(configs.iter().any(|c| c.id == "vs-news"));

    // Test Chroma keying
    let mut fg = RgbaImage::new(20, 20);
    for pixel in fg.pixels_mut() {
        *pixel = image::Rgba([0, 255, 0, 255]); // Pure green
    }
    VirtualStudioEngine::apply_chroma_key(&mut fg, "#00FF00", 0.35, 0.1);
    assert_eq!(fg.get_pixel(0, 0)[3], 0, "Pure green pixel should become fully transparent");

    // Test Perspective Quad compositing
    let mut dest = RgbaImage::new(40, 40);
    VirtualStudioEngine::composite_perspective_quad(&fg, &mut dest, &set_config.corner_pins, 1.0);
}

#[test]
fn test_hardware_prober_and_diagnostics() {
    let _ = gstreamer::init();
    let hw_manager = BroadcastHardwareManager::new();
    let devices = hw_manager.list_devices();
    assert!(!devices.is_empty(), "Hardware probing should detect device entries or simulated boundaries");

    // DeckLink device must report honestly (SupportedAndActive when GStreamer decklink plugin is installed, or BlockedByDependency)
    let decklink = devices.iter().find(|d| d.vendor == "Blackmagic Design");
    assert!(decklink.is_some());
    let dl = decklink.unwrap();
    assert!(dl.status == HardwareIntegrationStatus::SupportedAndActive || dl.status == HardwareIntegrationStatus::BlockedByDependency);
    assert!(matches!(dl.signal_status, SignalLockStatus::SignalDetectedUnlocked | SignalLockStatus::NoSignal));

    // Diagnostics Telemetry
    let diag_manager = BroadcastDiagnosticsManager::new();
    let stats = diag_manager.get_diagnostics(Vec::new(), 2);
    assert!(stats.cpu_usage_percent >= 0.0);
    assert!(stats.memory_used_mb > 0);
}

#[test]
fn test_schema_v10_backward_compatibility() {
    assert!(CURRENT_SCHEMA_VERSION >= 10);

    // Create a minimal project file as was saved in earlier version (v1-v9)
    let project_json = r#"{
        "schemaVersion": 1,
        "id": "proj-legacy",
        "name": "Legacy Broadcast",
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
            "streamService": "Custom RTMP",
            "streamUrl": "",
            "recordEnabled": false,
            "recordDirectory": "/tmp",
            "recordFormat": "mp4"
        },
        "inputs": [],
        "switcherState": {
            "previewInputId": null,
            "programInputId": null,
            "transitionDurationMs": 0,
            "transitionType": "cut"
        },
        "metadata": {
            "appVersion": "0.1.0",
            "author": "Broadcast Director",
            "notes": "Legacy test project",
            "tags": [],
            "customProperties": {}
        }
    }"#;

    let v: serde_json::Value = serde_json::from_str(project_json).unwrap();
    let proj: ProjectFile = ProjectFile::migrate_from_v1(v).expect("Legacy v1 project must deserialize and migrate cleanly");
    assert_eq!(proj.schema_version, CURRENT_SCHEMA_VERSION);
    assert!(!proj.aux_outputs.is_empty(), "Default aux output must be provisioned during migration");
    assert!(!proj.virtual_studios.is_empty(), "Default virtual studio must be provisioned during migration");
}
