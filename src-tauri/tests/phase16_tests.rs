use livestudio_lib::graphics::cloud::{CloudGraphicAppConfig, CloudGraphicControlPayload, CloudGraphicsBridge};
use livestudio_lib::graphics::psd::{PsdImporter, PsdLayerDescriptor};
use livestudio_lib::media::zoom::{ZoomMeetingManager, ZoomParticipantStream, ZoomSessionConfig};

#[test]
fn test_photoshop_psd_header_parsing_and_layer_canvas() {
    let psd_bytes = PsdImporter::create_test_psd_bytes(1920, 1080);
    assert_eq!(&psd_bytes[0..4], b"8BPS");

    let doc = PsdImporter::parse_psd_header(&psd_bytes).expect("Failed to parse valid PSD header");
    assert_eq!(doc.width, 1920);
    assert_eq!(doc.height, 1080);
    assert_eq!(doc.channels, 4);
    assert_eq!(doc.depth, 8);
    assert_eq!(doc.color_mode, "RGB");

    // Invalid signature check
    let invalid_bytes = b"NOT_A_PSD_FILE_HEADER";
    assert!(PsdImporter::parse_psd_header(invalid_bytes).is_err());

    // Test layer canvas rasterization
    let layer = PsdLayerDescriptor {
        layer_id: 1,
        name: "Lower Third Background".into(),
        left: 100,
        top: 800,
        right: 1200,
        bottom: 950,
        width: 1100,
        height: 150,
        opacity: 0.9,
        visible: true,
        blend_mode: "norm".into(),
    };

    let canvas = PsdImporter::render_layer_canvas(&layer, 1920, 1080);
    assert_eq!(canvas.dimensions(), (1920, 1080));

    // Verify drawn pixel inside layer bounding box
    let inside_px = canvas.get_pixel(500, 850);
    assert_eq!(inside_px[0], 50);
    assert_eq!(inside_px[1], 150);
    assert_eq!(inside_px[2], 250);
    assert!(inside_px[3] > 0);

    // Verify outside pixel is completely transparent
    let outside_px = canvas.get_pixel(10, 10);
    assert_eq!(outside_px[3], 0);
}

#[test]
fn test_cloud_graphics_singular_live_bridge() {
    let subkeys = vec![
        CloudGraphicControlPayload {
            subkey: "Headline".into(),
            value: "Breaking News: Live Event".into(),
        },
        CloudGraphicControlPayload {
            subkey: "HomeScore".into(),
            value: "3".into(),
        },
    ];

    let payload = CloudGraphicsBridge::format_singular_payload(&subkeys);
    assert_eq!(payload.get("Headline").unwrap(), "Breaking News: Live Event");
    assert_eq!(payload.get("HomeScore").unwrap(), "3");

    let valid_config = CloudGraphicAppConfig {
        app_id: "app-singular-1".into(),
        name: "Main Match Graphics".into(),
        provider: "SingularLive".into(),
        app_token: "tok_sec_12345".into(),
        control_url: "https://app.singular.live/api/v1/control/12345".into(),
        active_overlay_channel: 2,
        enabled: true,
    };
    assert!(CloudGraphicsBridge::validate_app_config(&valid_config).is_ok());

    let invalid_config = CloudGraphicAppConfig {
        app_id: "app-invalid".into(),
        name: "Broken App".into(),
        provider: "Custom".into(),
        app_token: "".into(), // empty token
        control_url: "ftp://bad-url".into(),
        active_overlay_channel: 9, // channel > 8
        enabled: true,
    };
    assert!(CloudGraphicsBridge::validate_app_config(&invalid_config).is_err());
}

#[test]
fn test_zoom_participant_ingestion_and_active_speaker() {
    let config = ZoomSessionConfig::default();
    assert_eq!(config.max_participants, 8);

    let pipe = ZoomMeetingManager::build_participant_pipeline("user-42", 1280, 720);
    assert!(pipe.contains("appsrc name=zoom_src_user-42"));
    assert!(pipe.contains("width=1280,height=720"));

    let participants = vec![
        ZoomParticipantStream {
            participant_id: "p1".into(),
            user_name: "Host Alice".into(),
            is_video_on: true,
            is_audio_muted: true, // muted
            is_screen_sharing: false,
            assigned_input_id: Some("cam-zoom-1".into()),
        },
        ZoomParticipantStream {
            participant_id: "p2".into(),
            user_name: "Guest Bob".into(),
            is_video_on: true,
            is_audio_muted: false, // active audio & video
            is_screen_sharing: false,
            assigned_input_id: Some("cam-zoom-2".into()),
        },
    ];

    let active = ZoomMeetingManager::find_active_speaker(&participants);
    assert!(active.is_some());
    assert_eq!(active.unwrap().user_name, "Guest Bob");
}
