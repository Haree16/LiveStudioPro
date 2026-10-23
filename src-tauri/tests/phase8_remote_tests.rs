use std::time::Duration;
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{
    PtzCameraConfig, TallyMappingConfig, CURRENT_SCHEMA_VERSION,
};
use livestudio_lib::remote::{
    director::DirectorRole,
    guest::{hash_token, GuestManager, GuestState},
    ptz::{PtzController, PtzDirection, PtzSimulator},
    tally::{TallyManager, TallyState},
    webrtc::WebRtcSessionManager,
};

#[test]
fn test_guest_invitation_lifecycle_and_token_hashing() {
    let manager = GuestManager::new(2);

    // 1. Create invitation
    let inv1 = manager
        .create_invitation(
            "Guest Alice".into(),
            "Expert".into(),
            30,
            None,
            true,
            true,
        )
        .expect("Failed to create invitation");

    assert_eq!(inv1.guest_name, "Guest Alice");
    assert_eq!(inv1.role, "Expert");
    assert_eq!(inv1.state, GuestState::Pending);
    assert_eq!(inv1.token_hash, hash_token(&inv1.token));

    // 2. Capacity limit check
    let inv2 = manager
        .create_invitation("Guest Bob".into(), "Caller".into(), 15, None, true, false)
        .expect("Failed to create second invitation");
    assert_eq!(inv2.guest_name, "Guest Bob");

    // 3. Exceed capacity
    let inv3_err = manager.create_invitation(
        "Guest Charlie".into(),
        "Caller".into(),
        15,
        None,
        true,
        false,
    );
    assert!(inv3_err.is_err(), "Should reject creation when capacity is reached");

    // 4. Token verification and connection
    let connected = manager
        .verify_token_and_connect(&inv1.token)
        .expect("Failed to verify valid token");
    assert_eq!(connected.state, GuestState::Connected);

    // 5. Revocation
    manager.revoke_invitation(&inv1.id).expect("Failed to revoke");
    let after_revoke = manager.verify_token_and_connect(&inv1.token);
    assert!(after_revoke.is_err(), "Revoked token must not be accepted");
}

#[test]
fn test_director_role_permissions_and_audit() {
    let controller = ProductionController::new().expect("Failed to initialize controller");
    let director_mgr = &controller.remote_engine.director_mgr;

    // 1. Authenticate Viewer
    let (v_session, v_sid) = director_mgr
        .authenticate("viewer", "127.0.0.1")
        .expect("Failed to auth viewer");
    assert_eq!(v_session.role, DirectorRole::Viewer);

    // Viewer can read status
    assert!(director_mgr.validate_action(&v_sid, "get_status").is_ok());
    assert!(director_mgr.validate_action(&v_sid, "get_tally").is_ok());

    // Viewer CANNOT switch or control
    assert!(director_mgr.validate_action(&v_sid, "cut").is_err());
    assert!(director_mgr.validate_action(&v_sid, "auto").is_err());
    assert!(director_mgr.validate_action(&v_sid, "ptz_drive").is_err());

    // 2. Authenticate Operator
    let (op_session, op_sid) = director_mgr
        .authenticate("operator", "127.0.0.1")
        .expect("Failed to auth operator");
    assert_eq!(op_session.role, DirectorRole::Operator);

    // Operator CAN cut, auto, control PTZ
    assert!(director_mgr.validate_action(&op_sid, "cut").is_ok());
    assert!(director_mgr.validate_action(&op_sid, "auto").is_ok());
    assert!(director_mgr.validate_action(&op_sid, "ptz_drive").is_ok());

    // Operator CANNOT configure server or administer
    assert!(director_mgr.validate_action(&op_sid, "configure_server").is_err());

    // 3. Authenticate Admin
    let (adm_session, adm_sid) = director_mgr
        .authenticate("admin", "127.0.0.1")
        .expect("Failed to auth admin");
    assert_eq!(adm_session.role, DirectorRole::Admin);
    assert!(director_mgr.validate_action(&adm_sid, "cut").is_ok());
    assert!(director_mgr.validate_action(&adm_sid, "configure_server").is_ok());

    // 4. Verify audit entries
    let logs = director_mgr.get_audit_log();
    assert!(!logs.is_empty(), "Audit log should contain authentication events");
}

#[tokio::test]
async fn test_ptz_visca_ip_simulator_and_presets() {
    let simulator = PtzSimulator::new(52389);
    simulator.start().await.expect("Failed to start PTZ simulator");

    // Give simulator socket time to bind
    tokio::time::sleep(Duration::from_millis(50)).await;

    let ptz = PtzController::new();
    let cam = PtzCameraConfig {
        id: "cam-test-1".into(),
        name: "Test PTZ".into(),
        protocol: "visca_ip".into(),
        host: "127.0.0.1".into(),
        port: 52389,
        camera_id: 1,
        username: None,
        password: None,
        presets: Vec::new(),
    };
    ptz.register_camera(cam);

    // Send Pan/Tilt commands
    let res = ptz.move_camera("cam-test-1", PtzDirection::Up, 12, 10).await;
    assert!(res.is_ok(), "VISCA Up command should dispatch successfully");

    let stop_res = ptz.move_camera("cam-test-1", PtzDirection::Stop, 12, 10).await;
    assert!(stop_res.is_ok(), "VISCA Stop command should dispatch successfully");

    // Save and recall preset
    let save_res = ptz.save_preset("cam-test-1", 1, "Wide Shot").await;
    assert!(save_res.is_ok(), "Preset save should succeed");

    let recall_res = ptz.recall_preset("cam-test-1", 1).await;
    assert!(recall_res.is_ok(), "Preset recall should succeed");

    // Allow time for UDP packets to arrive
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(simulator.get_received_count() >= 4, "Simulator should receive all dispatched VISCA packets");

    simulator.stop();
}

#[test]
fn test_tally_switcher_precedence_and_tsl_umd() {
    let tally_mgr = TallyManager::new();

    let mapping1 = TallyMappingConfig {
        input_id: "in1".into(),
        tally_number: 1,
        label: "CAM 1".into(),
        tsl_address: Some(1),
    };
    let mapping2 = TallyMappingConfig {
        input_id: "in2".into(),
        tally_number: 2,
        label: "CAM 2".into(),
        tsl_address: Some(2),
    };
    tally_mgr.set_mappings(vec![mapping1, mapping2]);

    let input_ids = vec!["in1".to_string(), "in2".to_string()];

    // Case 1: in1 is Program, in2 is Preview
    let statuses = tally_mgr.update_switcher_state(Some("in1"), Some("in2"), &input_ids);
    let s1 = statuses.iter().find(|s| s.input_id == "in1").unwrap();
    let s2 = statuses.iter().find(|s| s.input_id == "in2").unwrap();
    assert_eq!(s1.state, TallyState::Program);
    assert_eq!(s1.color_hex, "#E53E3E"); // Red
    assert_eq!(s2.state, TallyState::Preview);
    assert_eq!(s2.color_hex, "#38A169"); // Green

    // Case 2: Precedence rule (if input is in both Program and Preview, Program wins)
    let statuses_overlap = tally_mgr.update_switcher_state(Some("in1"), Some("in1"), &input_ids);
    let s1_overlap = statuses_overlap.iter().find(|s| s.input_id == "in1").unwrap();
    assert_eq!(s1_overlap.state, TallyState::Program);

    // Case 3: TSL UMD v3.1 Frame generation
    let tsl_frame = tally_mgr.format_tsl_umd_v31(1, "CAM 1", true, false);
    assert_eq!(tsl_frame.len(), 18);
    assert_eq!(tsl_frame[0], 0x80 | 1); // Header with address 1
    assert_eq!(tsl_frame[1], 0x01);     // Program tally bit set
    assert_eq!(&tsl_frame[2..7], b"CAM 1");
}

#[test]
fn test_webrtc_sdp_processing() {
    let manager = WebRtcSessionManager::new();
    let fake_offer = "v=0\r\no=alice 1 1 IN IP4 127.0.0.1\r\ns=-\r\n";
    let answer = manager
        .process_offer("guest-123", fake_offer)
        .expect("SDP processing failed");

    assert_eq!(answer.sdp_type, "answer");
    assert!(answer.sdp.contains("v=0"));
    assert!(answer.sdp.contains("opus"));
}

#[test]
fn test_schema_v8_migration_backward_compatibility() {
    assert!(CURRENT_SCHEMA_VERSION >= 8);

    // A valid Schema v7 project JSON without Phase 8 fields
    let v7_json = serde_json::json!({
        "schemaVersion": 7,
        "id": "proj-v7-test",
        "name": "Phase 7 Production",
        "createdAt": "2026-10-20T12:00:00Z",
        "updatedAt": "2026-10-20T12:00:00Z",
        "videoSettings": {
            "width": 1920,
            "height": 1080,
            "frameRateNumerator": 60,
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
            "streamService": "Custom RTMP",
            "streamUrl": "",
            "recordEnabled": false,
            "recordDirectory": "/tmp",
            "recordFormat": "mp4"
        },
        "inputs": [],
        "switcherState": {
            "programInputId": null,
            "previewInputId": null,
            "transitionType": "Cut",
            "transitionDurationMs": 500,
            "tbarPosition": 0.0,
            "multiviewLayout": "grid4"
        },
        "metadata": {
            "author": "Operator",
            "notes": "Test migration",
            "tags": []
        }
    });

    let migrated = livestudio_lib::project::model::ProjectFile::migrate_from_v1(v7_json)
        .expect("Migration from v7 to v8 must succeed");

    assert_eq!(migrated.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(migrated.remote_production.port, 8088);
    assert_eq!(migrated.remote_production.bind_address, "127.0.0.1");
    assert_eq!(migrated.remote_production.max_guests, 4);
    assert!(migrated.ptz_cameras.is_empty());
    assert!(migrated.tally_mappings.is_empty());
    assert!(migrated.network_sources.is_empty());
}
