use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

use livestudio_lib::core::lifecycle::LifecycleState;
use livestudio_lib::core::ProductionController;
use livestudio_lib::diagnostics::compatibility::SystemCompatibilityAuditor;
use livestudio_lib::diagnostics::logger::{sanitize_log_message, LogRingBuffer, LogSubsystem};
use livestudio_lib::diagnostics::updater::UpdateManager;
use livestudio_lib::output::recovery::{ActiveRecordingMarker, RecordingRecoveryManager};
use livestudio_lib::project::autosave::AutosaveManager;
use livestudio_lib::project::backup::BackupManager;
use livestudio_lib::project::model::{InputItem, InputType, ProjectFile, CURRENT_SCHEMA_VERSION};
use livestudio_lib::project::persistence::ProjectStore;
use livestudio_lib::project::portable::{PortableExportMode, PortableProjectManager};
use livestudio_lib::project::relink::{MediaRelinker, RelinkMatchMode};

#[test]
fn test_project_schema_v11_and_migration_backward_compatibility() {
    assert_eq!(CURRENT_SCHEMA_VERSION, 11);

    // Create a mock v10 project JSON (missing lifecycleConfig and portableConfig)
    let v10_json = serde_json::json!({
        "schemaVersion": 10,
        "id": "test-v10-migration",
        "name": "Phase 10 Migration Test",
        "createdAt": "2026-10-22T00:00:00Z",
        "updatedAt": "2026-10-22T00:00:00Z",
        "videoSettings": {
            "width": 1920,
            "height": 1080,
            "frameRateNumerator": 30,
            "frameRateDenominator": 1,
            "colorSpace": "bt709",
            "colorFormat": "NV12"
        },
        "audioSettings": {
            "sampleRate": 48000,
            "channels": 2,
            "bitDepth": 16
        },
        "outputSettings": {
            "streamEnabled": false,
            "streamService": "custom",
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
        }
    });

    let migrated = ProjectFile::migrate_from_v1(v10_json).expect("Migration from v10 must succeed");
    assert_eq!(migrated.schema_version, 11);
    assert_eq!(migrated.name, "Phase 10 Migration Test");
    assert_eq!(migrated.lifecycle_config.autosave_interval_seconds, 60);
    assert_eq!(migrated.lifecycle_config.max_recovery_snapshots, 10);
    assert_eq!(migrated.portable_config.relative_media_folder, "assets");
}

#[test]
fn test_autosave_bounded_snapshots_and_backup_preservation() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let recovery_file = tmp.path().join("session_recovery.json");

    let mut autosave = AutosaveManager::with_custom_path(recovery_file.clone());
    autosave.set_max_snapshots(3);

    let mut project = ProjectFile::new("Snapshot Test");
    project.id = "snap-test-proj".into();

    // 1. Save 5 snapshots to verify rotation limit to 3
    for i in 1..=5 {
        project.name = format!("Snapshot Test Version {i}");
        autosave
            .save_recovery_snapshot(&project, None)
            .expect("Saving snapshot must succeed");
        std::thread::sleep(std::time::Duration::from_millis(15));
    }

    let snapshots = autosave.list_recovery_snapshots(None);
    assert!(
        snapshots.len() <= 4, // 1 latest + up to 3 bounded historical
        "Snapshots count must be bounded by rotation limit"
    );

    // 2. Test safety backup creation before overwrite
    let original_project_path = tmp.path().join("original_project.lsp");
    ProjectStore::save(&project, &original_project_path).expect("Project save must succeed");
    assert!(original_project_path.exists());

    let backup_path = AutosaveManager::preserve_original_backup(&original_project_path)
        .expect("Preserving original backup must succeed");
    assert!(backup_path.exists(), "Safety backup file must be created on disk");
    assert_ne!(original_project_path, backup_path);

    // 3. Clean up
    autosave.clear_all_historical_snapshots();
    autosave.clear_recovery_snapshot();
    assert!(!recovery_file.exists());
}

#[test]
fn test_portable_project_packaging_and_relative_path_resolution() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let source_assets_dir = tmp.path().join("source_media");
    fs::create_dir_all(&source_assets_dir).unwrap();

    // Create mock asset files, including a Tamil Unicode filename
    let clip1_path = source_assets_dir.join("intro_clip.mp4");
    fs::write(&clip1_path, b"TEST_VIDEO_BYTES_12345").unwrap();

    let tamil_clip_path = source_assets_dir.join("காணொளி_நேரலை.mp4");
    fs::write(&tamil_clip_path, b"TAMIL_UNICODE_MEDIA_BYTES").unwrap();

    let mut project = ProjectFile::new("Portable Production");
    let in1 = InputItem::new("cam-1", "Intro Video", InputType::MediaFile, clip1_path.to_str().unwrap());
    let in2 = InputItem::new("cam-2", "Tamil Broadcast", InputType::MediaFile, tamil_clip_path.to_str().unwrap());
    project.inputs.push(in1);
    project.inputs.push(in2);

    let bundle_destination = tmp.path().join("PortableExport");
    let manifest = PortableProjectManager::export_portable_package(
        &project,
        &bundle_destination,
        PortableExportMode::CopyAllMedia,
    )
    .expect("Portable package export must succeed");

    assert_eq!(manifest.total_assets_count, 2);
    assert_eq!(manifest.copied_assets_count, 2);
    assert!(manifest.total_size_bytes > 0);

    // Verify bundle contents on disk
    let exported_manifest = bundle_destination.join("manifest.json");
    assert!(exported_manifest.exists(), "manifest.json must exist in bundle root");

    let assets_dir = bundle_destination.join("assets");
    assert!(assets_dir.exists(), "assets directory must exist in bundle");

    // Test relative path resolution
    let resolved = PortableProjectManager::resolve_asset_path(
        &bundle_destination,
        "assets/cam-1_intro_clip.mp4",
    );
    assert!(resolved.exists(), "Relative asset path must resolve successfully");
}

#[test]
fn test_media_relinking_and_ambiguous_candidate_detection() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let search_dir = tmp.path().join("relocation_folder");
    fs::create_dir_all(&search_dir).unwrap();

    // Place candidate files, including ambiguous duplicates in subdirectories
    let sub1 = search_dir.join("folder_a");
    let sub2 = search_dir.join("folder_b");
    fs::create_dir_all(&sub1).unwrap();
    fs::create_dir_all(&sub2).unwrap();

    let target_file_1 = sub1.join("interview_cam1.mp4");
    let duplicate_file = sub2.join("interview_cam1.mp4");
    fs::write(&target_file_1, b"INTERVIEW_BYTES_1").unwrap();
    fs::write(&duplicate_file, b"INTERVIEW_BYTES_DUPLICATE").unwrap();

    let mut project = ProjectFile::new("Relink Test Project");
    let mut missing_input = InputItem::new(
        "input-missing-1",
        "Interview Angle",
        InputType::MediaFile,
        "/non/existent/path/interview_cam1.mp4",
    );
    missing_input.is_missing = true;
    project.inputs.push(missing_input);

    let scan_report = MediaRelinker::scan_folder_for_missing_assets(
        &project,
        &search_dir,
        RelinkMatchMode::ExactFilename,
    )
    .expect("Media relinking scan must succeed");

    assert_eq!(scan_report.total_missing_assets, 1);
    assert_eq!(scan_report.matched_assets_count, 1);
    assert!(
        scan_report.candidates[0].is_ambiguous,
        "Ambiguous match must be detected when multiple duplicate filenames exist"
    );

    // Apply confirmed relink mapping
    let mut mappings = HashMap::new();
    mappings.insert("input-missing-1".into(), target_file_1.to_str().unwrap().into());

    let apply_result = MediaRelinker::apply_relink_mappings(&mut project, &mappings);
    assert_eq!(apply_result.successfully_relinked_count, 1);
    assert_eq!(project.inputs[0].is_missing, false);
    assert_eq!(project.inputs[0].source_path_or_id, target_file_1.to_str().unwrap());
}

#[test]
fn test_interrupted_recording_detection_and_non_destructive_recovery() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let recordings_dir = tmp.path().join("Recordings");
    fs::create_dir_all(&recordings_dir).unwrap();

    // 1. Simulate an interrupted MP4 recording session
    let target_recording_file = recordings_dir.join("Live_Broadcast_20261022.mp4");
    fs::write(&target_recording_file, b"SIMULATED_UNFINALIZED_MP4_DATA").unwrap();

    let marker = ActiveRecordingMarker {
        session_id: "session-crash-99".into(),
        output_path: target_recording_file.to_str().unwrap().into(),
        container_format: "mp4".into(),
        started_at: chrono::Utc::now(),
        is_iso: false,
        camera_name: None,
    };

    RecordingRecoveryManager::create_active_marker(&recordings_dir, &marker)
        .expect("Creating marker must succeed");

    // 2. Scan for interrupted recordings
    let interrupted_sessions = RecordingRecoveryManager::scan_interrupted_recordings(&recordings_dir);
    assert_eq!(interrupted_sessions.len(), 1);
    assert_eq!(interrupted_sessions[0].session_id, "session-crash-99");
    assert!(interrupted_sessions[0].file_exists);

    // 3. Attempt non-destructive recovery
    let outcome = RecordingRecoveryManager::recover_interrupted_recording(&interrupted_sessions[0])
        .expect("Recovery attempt must succeed");

    assert!(outcome.success);
    assert!(target_recording_file.exists(), "Original damaged file must remain intact");

    let recovered_path = PathBuf::from(outcome.recovered_file_path.unwrap());
    assert!(recovered_path.exists(), "Recovery copy (.recovered.mp4) must exist on disk");
    assert_ne!(target_recording_file, recovered_path);
}

#[test]
fn test_structured_logging_and_secret_redaction() {
    let raw_msg_with_streamkey = "Connecting to rtmp://live.twitch.tv/app/live_user_abcdef123456789 with secret=super_secret_token_xyz";
    let sanitized = sanitize_log_message(raw_msg_with_streamkey);

    assert!(
        !sanitized.contains("live_user_abcdef123456789"),
        "Stream key must be redacted from log message"
    );
    assert!(
        !sanitized.contains("super_secret_token_xyz"),
        "Password / secret must be redacted from log message"
    );
    assert!(sanitized.contains("[REDACTED]"));

    let ring = LogRingBuffer::new(50);
    ring.push_structured(
        "INFO",
        LogSubsystem::Streaming,
        Some("corr-001"),
        "StreamEngine",
        raw_msg_with_streamkey,
    );

    let recent = ring.get_recent(1);
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].subsystem, "Streaming");
    assert_eq!(recent[0].correlation_id.as_deref(), Some("corr-001"));
    assert!(!recent[0].message.contains("super_secret_token_xyz"));
}

#[test]
fn test_system_compatibility_audit_execution() {
    let report = SystemCompatibilityAuditor::run_comprehensive_audit();
    assert!(report.total_checks >= 5);
    assert!(!report.os_name.is_empty());

    // Verify key subsystems are audited
    let has_gst_check = report.checks.iter().any(|c| c.id == "gstreamer_core");
    let has_platform_check = report.checks.iter().any(|c| c.id == "os_platform");
    let has_storage_check = report.checks.iter().any(|c| c.id == "storage_permissions");

    assert!(has_gst_check, "GStreamer core must be included in compatibility audit");
    assert!(has_platform_check, "OS platform must be checked");
    assert!(has_storage_check, "Storage permissions must be verified");
}

#[test]
fn test_backup_archive_creation_inspection_and_restore_safety() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let backup_file = tmp.path().join("production_backup.lspbak");

    let mut project = ProjectFile::new("Backup Studio Project");
    project.id = "proj-backup-123".into();

    // 1. Create backup archive
    let payload = BackupManager::create_backup_archive(&backup_file, &project, true, true)
        .expect("Creating backup archive must succeed");
    assert!(backup_file.exists());
    assert!(!payload.checksum.is_empty());

    // 2. Inspect archive
    let inspection = BackupManager::inspect_backup_archive(&backup_file)
        .expect("Inspecting backup archive must succeed");
    assert!(inspection.is_valid);
    assert!(inspection.is_compatible);
    assert_eq!(inspection.schema_version, CURRENT_SCHEMA_VERSION);
    assert!(inspection.items_count >= 1);

    // 3. Restore archive safely into a target project
    let mut target_project = ProjectFile::new("Empty Canvas");
    let restore_report = BackupManager::restore_from_archive(
        &backup_file,
        &mut target_project,
        true,
        true,
        true,
    )
    .expect("Restoring backup archive must succeed");

    assert!(restore_report.success);
    assert_eq!(target_project.name, "Backup Studio Project");
    assert!(restore_report.safety_notice.contains("will not auto-execute"));
}

#[test]
fn test_update_manifest_validation_and_security_policy() {
    let manifest_json = r#"{
        "version": "1.1.0",
        "releaseDate": "2026-11-01T00:00:00Z",
        "releaseNotes": "Phase 11 Production Stability & Enhancements",
        "schemaVersion": 11,
        "downloadUrls": {
            "linux-deb": "https://releases.livestudio.pro/v1.1.0/livestudio-pro_1.1.0_amd64.deb",
            "windows-nsis": "https://releases.livestudio.pro/v1.1.0/LiveStudioPro_1.1.0_Setup.exe"
        },
        "sha256Checksums": {
            "linux-deb": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "windows-nsis": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        }
    }"#;

    let eval_result = UpdateManager::evaluate_update_manifest("1.0.0-rc1", manifest_json, "linux-deb")
        .expect("Evaluating manifest must succeed");

    assert!(eval_result.is_update_available);
    assert!(!eval_result.is_downgrade);
    assert!(eval_result.security_validation_passed);
    assert_eq!(eval_result.latest_version, "1.1.0");
    assert!(eval_result.target_platform_download_url.unwrap().starts_with("https://"));
}

#[test]
fn test_production_controller_lifecycle_and_shutdown_workflow() {
    let controller = ProductionController::new().expect("Controller initialization must succeed");

    // 1. Initial lifecycle state must be Ready
    assert_eq!(controller.get_lifecycle_state(), LifecycleState::Ready);

    // 2. When idle, shutdown safety should indicate ready to close
    let safety = controller.check_shutdown_safety();
    assert!(safety.can_shutdown);
    assert!(!safety.streaming_active);
    assert!(!safety.recording_active);

    // 3. Execute orderly 10-step shutdown
    let shutdown_report = controller
        .execute_orderly_shutdown(false)
        .expect("Orderly shutdown must succeed");

    assert!(shutdown_report.success);
    assert!(shutdown_report.steps_completed.len() >= 8);
    assert_eq!(controller.get_lifecycle_state(), LifecycleState::Terminated);
}
