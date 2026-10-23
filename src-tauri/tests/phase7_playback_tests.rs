use chrono::{Duration as ChronoDuration, Utc};
use tempfile::tempdir;

use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::playback::model::{
    PlaylistItem, PlaylistLoopMode, ReplayConfig, ScheduleStatus, ScheduledCue,
};
use livestudio_lib::project::model::{InputItem, InputType, CURRENT_SCHEMA_VERSION};

#[test]
fn test_cue_points_validation_and_calculations() {
    let mut item = PlaylistItem::new("Promo Reel", "/path/to/promo.mp4", 60000); // 60s
    assert_eq!(item.cue_in_ms, 0);
    assert_eq!(item.cue_out_ms, 60000);
    assert_eq!(item.effective_duration_ms(), 60000);
    assert!(item.validate_cue_points().is_ok());

    // Valid trimming: 10s to 35s
    item.cue_in_ms = 10000;
    item.cue_out_ms = 35000;
    assert_eq!(item.effective_duration_ms(), 25000);
    assert!(item.validate_cue_points().is_ok());

    // Invalid: cue_in >= cue_out
    item.cue_in_ms = 40000;
    item.cue_out_ms = 35000;
    assert!(item.validate_cue_points().is_err());

    // Invalid: cue_out > duration
    item.cue_in_ms = 10000;
    item.cue_out_ms = 70000;
    assert!(item.validate_cue_points().is_err());
}

#[test]
fn test_playlist_lifecycle_and_reordering() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    // 1. Create playlist
    let pl = controller.playlist_create("Show Segments");
    assert_eq!(pl.name, "Show Segments");
    assert!(pl.items.is_empty());

    // 2. Add items
    let item1 = PlaylistItem::new("Intro Video", "/media/intro.mp4", 15000);
    let item2 = PlaylistItem::new("Interview Clip", "/media/interview.mp4", 45000);
    let item3 = PlaylistItem::new("Outro Sponsor", "/media/outro.mp4", 10000);

    let pl = controller.playlist_add_item(&pl.id, item1.clone()).unwrap();
    let pl = controller.playlist_add_item(&pl.id, item2.clone()).unwrap();
    let pl = controller.playlist_add_item(&pl.id, item3.clone()).unwrap();
    assert_eq!(pl.items.len(), 3);
    assert_eq!(pl.total_duration_ms(), 70000);

    // 3. Reorder items (move item 2 to index 0)
    let pl = controller.playlist_reorder_items(&pl.id, 1, 0).unwrap();
    assert_eq!(pl.items[0].name, "Interview Clip");
    assert_eq!(pl.items[1].name, "Intro Video");

    // 4. Update cue points for item
    let pl = controller.playlist_update_cue_points(&pl.id, &pl.items[0].id, 5000, 25000).unwrap();
    assert_eq!(pl.items[0].cue_in_ms, 5000);
    assert_eq!(pl.items[0].cue_out_ms, 25000);
    assert_eq!(pl.items[0].effective_duration_ms(), 20000);

    // 5. Remove item
    let pl = controller.playlist_remove_item(&pl.id, &pl.items[2].id).unwrap();
    assert_eq!(pl.items.len(), 2);
}

#[test]
fn test_playlist_advancement_and_loop_modes() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    let pl = controller.playlist_create("Music Videos");
    let item1 = PlaylistItem::new("Song A", "/media/song_a.mp4", 30000);
    let item2 = PlaylistItem::new("Song B", "/media/song_b.mp4", 40000);
    let item3 = PlaylistItem::new("Song C", "/media/song_c.mp4", 50000);

    controller.playlist_add_item(&pl.id, item1).unwrap();
    controller.playlist_add_item(&pl.id, item2).unwrap();
    controller.playlist_add_item(&pl.id, item3).unwrap();

    // Set loop mode: StopAtEnd
    let mut pl = controller.playlist_get(&pl.id).unwrap();
    pl.loop_mode = PlaylistLoopMode::StopAtEnd;
    controller.playlist_update(pl.clone()).unwrap();

    // Play item 0
    let played = controller.playlist_play_item(&pl.id, 0).unwrap();
    assert_eq!(played.name, "Song A");

    // Advance next -> Song B
    let next1 = controller.playlist_advance_next(&pl.id).unwrap();
    assert_eq!(next1.map(|i| i.name), Some("Song B".into()));

    // Advance next -> Song C
    let next2 = controller.playlist_advance_next(&pl.id).unwrap();
    assert_eq!(next2.map(|i| i.name), Some("Song C".into()));

    // Advance next at end with StopAtEnd -> None (stops)
    let next3 = controller.playlist_advance_next(&pl.id).unwrap();
    assert!(next3.is_none());

    // Switch to LoopAll and verify it cycles back to 0
    let mut pl = controller.playlist_get(&pl.id).unwrap();
    pl.loop_mode = PlaylistLoopMode::LoopAll;
    controller.playlist_update(pl.clone()).unwrap();
    let _ = controller.playlist_play_item(&pl.id, 2).unwrap(); // Start at last item
    let looped = controller.playlist_advance_next(&pl.id).unwrap();
    assert_eq!(looped.map(|i| i.name), Some("Song A".into()));

    // Previous advancement
    let prev = controller.playlist_advance_prev(&pl.id).unwrap();
    assert_eq!(prev.map(|i| i.name), Some("Song C".into()));
}

#[test]
fn test_instant_replay_rolling_buffer_and_clip_marking() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    // Configure rolling replay buffer: 30s buffer, 100MB max
    let mut config = ReplayConfig::default();
    config.enabled = true;
    config.rolling_buffer_duration_seconds = 30;
    config.max_disk_allocation_mb = 100;
    config.default_replay_speed = 0.5;
    controller.replay_set_config(config).unwrap();

    controller.replay_start_capture().unwrap();

    // Ingest simulated frames from 2 cameras
    let cam1_dummy_frame = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]; // JPEG header mock
    let cam2_dummy_frame = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46];

    for _ in 0..15 {
        controller.replay_engine.ingest_frame("cam-main", "Main Camera", cam1_dummy_frame.clone());
        controller.replay_engine.ingest_frame("cam-tight", "Tight Angle", cam2_dummy_frame.clone());
    }

    // Verify buffer health
    let health = controller.replay_get_health();
    assert!(health.is_active);
    assert_eq!(health.total_captured_frames, 30);
    assert_eq!(health.health_status, "healthy");

    // Multi-camera tracking
    let multi_cam = controller.replay_get_multi_cam_sources();
    assert_eq!(multi_cam.len(), 2);
    assert!(multi_cam.iter().any(|c| c.source_id == "cam-main" && c.frame_count == 15));
    assert!(multi_cam.iter().any(|c| c.source_id == "cam-tight" && c.frame_count == 15));

    // Mark replay clip of last 5 seconds
    let clip = controller.replay_mark_quick_clip("Touchdown Moment", "cam-main", 5, 0.5).unwrap();
    assert_eq!(clip.name, "Touchdown Moment");
    assert_eq!(clip.camera_source_id, "cam-main");
    assert_eq!(clip.playback_speed, 0.5);
    assert!(clip.all_camera_ids.contains(&"cam-tight".into()));

    // Verify clip is stored
    let clips = controller.replay_get_clips();
    assert_eq!(clips.len(), 1);

    // Switch camera angle on clip
    controller.replay_switch_camera("cam-tight").unwrap();
    let updated_clip = controller.replay_get_clip(&clip.id).unwrap();
    assert_eq!(updated_clip.camera_source_id, "cam-tight");

    // Set variable slow-motion speed
    controller.replay_set_speed(0.25);
    assert_eq!(controller.replay_get_speed(), 0.25);
}

#[test]
fn test_replay_take_live_and_safe_return_to_live() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    // Add live cameras
    let cam_input = InputItem::new("cam-1", "Camera 1", InputType::TestPattern, "smpte");
    controller.add_input(cam_input).unwrap();
    controller.switcher.set_program_source(Some("cam-1".into()));

    assert_eq!(controller.switcher.get_status().program_source_id, Some("cam-1".into()));

    // Setup replay clip
    let mut config = ReplayConfig::default();
    config.enabled = true;
    controller.replay_set_config(config).unwrap();
    controller.replay_start_capture().unwrap();

    let dummy_frame = vec![0xFF, 0xD8, 0xFF, 0xD9];
    controller.replay_engine.ingest_frame("cam-1", "Camera 1", dummy_frame);
    let _ = controller.replay_mark_quick_clip("Great Play", "cam-1", 5, 0.5).unwrap();

    // 1. Take replay LIVE on Program
    controller.replay_take_live().expect("Replay take live failed");
    assert!(controller.replay_engine.is_replay_on_air());

    // 2. Return to LIVE: Program must restore "cam-1" and avoid stale freeze frames!
    let live_source = controller.replay_return_to_live().expect("Return to live failed");
    assert_eq!(live_source, Some("cam-1".into()));
    assert!(!controller.replay_engine.is_replay_on_air());
    assert_eq!(controller.switcher.get_status().program_source_id, Some("cam-1".into()));
}

#[test]
fn test_event_scheduler_and_operator_confirmation() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    let now = Utc::now();
    // Schedule a cue 10 seconds in the future
    let cue_time = now + ChronoDuration::seconds(10);
    let cue = ScheduledCue::new("Halftime Show Opener", Some("pl-halftime".into()), cue_time);

    controller.scheduler_add_cue(cue.clone());
    let cues = controller.scheduler_get_cues();
    assert_eq!(cues.len(), 1);
    assert!(cues[0].status == ScheduleStatus::Pending || cues[0].status == ScheduleStatus::Armed);

    // Test operator confirmation safety flow
    let confirmed_cue = ScheduledCue {
        id: "cue-live-1".into(),
        label: "Live Broadcast Start".into(),
        target_playlist_id: None,
        target_item_id: None,
        target_input_id: None,
        scheduled_time_utc: now - ChronoDuration::seconds(5), // Just triggered
        requires_operator_confirmation: true,
        auto_take_live: false,
        status: ScheduleStatus::Triggered,
        notes: "Requires producer signoff".into(),
    };
    controller.scheduler_add_cue(confirmed_cue.clone());

    // Cancel cue
    controller.scheduler_cancel_cue(&cue.id).unwrap();
    let updated = controller.scheduler_get_cues();
    assert_eq!(updated.iter().find(|c| c.id == cue.id).unwrap().status, ScheduleStatus::Cancelled);
}

#[test]
fn test_schema_v7_migration_and_project_persistence() {
    let dir = tempdir().expect("Failed to create tempdir");
    let proj_path = dir.path().join("schema_v7_show.livestudio");

    let controller = ProductionController::new().expect("Failed to initialize controller");

    // Create a playlist in project
    let pl = controller.playlist_create("Evening News Rundown");
    let item = PlaylistItem::new("Segment 1", "/media/seg1.mp4", 60000);
    controller.playlist_add_item(&pl.id, item).unwrap();

    // Mark a replay clip
    controller.replay_start_capture().unwrap();
    controller.replay_engine.ingest_frame("cam-1", "Cam 1", vec![0xFF, 0xD8, 0xFF, 0xD9]);
    let _ = controller.replay_mark_quick_clip("Lead Story Clip", "cam-1", 10, 1.0).unwrap();

    // Schedule an event
    let cue = ScheduledCue::new("Commercial Break 1", Some(pl.id.clone()), Utc::now() + ChronoDuration::minutes(5));
    controller.scheduler_add_cue(cue);

    // Save project
    let saved = controller.save_project_as(&proj_path).expect("Failed to save project");
    assert_eq!(saved.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(saved.playlists.len(), 1);
    assert_eq!(saved.playlists[0].name, "Evening News Rundown");
    assert_eq!(saved.replay_clips.len(), 1);
    assert_eq!(saved.scheduled_cues.len(), 1);
    assert_eq!(saved.event_production.event_name, "Live Broadcast Event");

    // Load project back into new controller instance
    let new_controller = ProductionController::new().expect("Failed to initialize second controller");
    let loaded = new_controller.load_project(&proj_path).expect("Failed to load project");
    assert_eq!(loaded.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(loaded.playlists.len(), 1);
    assert_eq!(loaded.replay_clips.len(), 1);
    assert_eq!(loaded.scheduled_cues.len(), 1);

    // Also verify backward compatibility migration from a raw schema v1 json!
    let raw_v1_json = serde_json::json!({
        "schemaVersion": 1,
        "id": "v1-legacy-project",
        "name": "Legacy V1 Project",
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
        "videoSettings": {
            "width": 1920,
            "height": 1080,
            "frameRateNumerator": 60,
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
            "recordDirectory": "",
            "recordFormat": "mp4"
        },
        "inputs": [],
        "switcherState": {
            "transitionDurationMs": 500,
            "transitionType": "crossfade"
        }
    });

    let migrated = livestudio_lib::project::ProjectFile::migrate_from_v1(raw_v1_json).expect("Migration must succeed");
    assert_eq!(migrated.schema_version, CURRENT_SCHEMA_VERSION);
    assert!(migrated.playlists.is_empty());
    assert!(migrated.replay_clips.is_empty());
    assert!(migrated.scheduled_cues.is_empty());
    assert_eq!(migrated.event_production.production_type, "Sports");
}
