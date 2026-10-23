use image::{Rgba, RgbaImage};
use livestudio_lib::automation::event_bus::{EventBus, EventTriggerRule, ProductionEventType};
use livestudio_lib::broadcast::aux_output::{AuxDestinationType, AuxFeedType, AuxOutputConfig, AuxOutputEngine};
use livestudio_lib::output::encoder::EncoderCapabilityAuditor;
use livestudio_lib::output::model::{OutputProfile, VideoCodec};
use livestudio_lib::switcher::controller::SwitcherController;
use livestudio_lib::switcher::model::TransitionType;
use livestudio_lib::switcher::transition::{ActiveTransition, TransitionEngine};
use serde_json::json;
use std::collections::HashMap;

#[test]
fn test_sub_mix_bus_state_and_switching() {
    let switcher = SwitcherController::new();

    // Ensure Sub-Mix 2 exists
    let bus2 = switcher.get_sub_mix(2).expect("Sub-Mix 2 should exist");
    assert_eq!(bus2.mix_index, 2);
    assert_eq!(bus2.program_source_id, None);
    assert_eq!(bus2.preview_source_id, None);

    // Set preview and program for Sub-Mix 2
    switcher.set_sub_mix_preview(2, Some("cam-1".into()));
    switcher.set_sub_mix_program(2, Some("cam-2".into()));

    let bus2_updated = switcher.get_sub_mix(2).unwrap();
    assert_eq!(bus2_updated.preview_source_id, Some("cam-1".into()));
    assert_eq!(bus2_updated.program_source_id, Some("cam-2".into()));

    // Perform CUT on Sub-Mix 2
    switcher.cut_sub_mix(2);

    let bus2_after_cut = switcher.get_sub_mix(2).unwrap();
    assert_eq!(bus2_after_cut.program_source_id, Some("cam-1".into()));
    assert_eq!(bus2_after_cut.preview_source_id, Some("cam-2".into()));

    // Verify sub-mix rendering provider
    let rendered = switcher.render_sub_mix_frame(2, |id| {
        if id == "cam-1" {
            Some(RgbaImage::from_pixel(64, 64, Rgba([255, 0, 0, 255])))
        } else {
            None
        }
    });
    assert!(rendered.is_some());
    assert_eq!(rendered.unwrap().get_pixel(0, 0)[0], 255);
}

#[test]
fn test_stinger_and_zoom_transitions() {
    let f1 = RgbaImage::from_pixel(100, 100, Rgba([255, 0, 0, 255]));
    let f2 = RgbaImage::from_pixel(100, 100, Rgba([0, 255, 0, 255]));

    // Test Stinger transition rendering
    let stinger_half = TransitionEngine::render_transition(TransitionType::Stinger, &f1, &f2, 0.6);
    assert_eq!(stinger_half.dimensions(), (100, 100));
    // At >0.5 progress, stinger transition cuts to f2
    assert_eq!(stinger_half.get_pixel(0, 0)[1], 255);

    // Test Zoom transition rendering
    let zoom_half = TransitionEngine::render_transition(TransitionType::Zoom, &f1, &f2, 0.5);
    assert_eq!(zoom_half.dimensions(), (100, 100));

    // Test ActiveTransition timing
    let active = ActiveTransition::new(TransitionType::Zoom, 1000, Some("c1".into()), Some("c2".into()));
    assert_eq!(active.transition_type, TransitionType::Zoom);
    assert!(active.progress() >= 0.0);
}

#[test]
fn test_virtual_webcam_aux_destination_config() {
    let aux_engine = AuxOutputEngine::new(4);
    let mut config = AuxOutputConfig::default();
    config.id = "aux-vcam-1".into();
    config.name = "OBS / Teams Virtual Cam".into();
    config.feed_type = AuxFeedType::CleanFeed;
    config.destination_type = AuxDestinationType::VirtualWebcam;
    config.destination_target = "/dev/video10".into();

    aux_engine.save_config(config.clone());
    let list = aux_engine.list_configs();
    let found = list.iter().find(|c| c.id == "aux-vcam-1");
    assert!(found.is_some());
    assert_eq!(found.unwrap().destination_type, AuxDestinationType::VirtualWebcam);
    assert_eq!(found.unwrap().destination_target, "/dev/video10");
}

#[test]
fn test_countdown_completed_automation_trigger() {
    let bus = EventBus::new();
    let rule = EventTriggerRule {
        id: "rule-countdown-ended".into(),
        name: "Auto Cut on Countdown Zero".into(),
        event_type: ProductionEventType::CountdownCompleted,
        filter_field: Some("timerId".into()),
        filter_value: Some(json!("intro-rundown")),
        target_macro_id: "macro-transition-program".into(),
        enabled: true,
        cooldown_ms: 100,
        last_triggered: None,
    };

    bus.register_rule(rule);

    let mut payload = HashMap::new();
    payload.insert("timerId".into(), json!("intro-rundown"));
    payload.insert("remainingSeconds".into(), json!(0));

    let triggered = bus.emit(ProductionEventType::CountdownCompleted, payload);
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0], "macro-transition-program");
}

#[test]
fn test_hevc_and_av1_output_profiles_and_encoder_selection() {
    let hevc_profile = OutputProfile::preset_1080p60_hevc();
    assert_eq!(hevc_profile.video_codec, VideoCodec::H265);
    assert_eq!(hevc_profile.video_bitrate_kbps, 4000);
    assert_eq!(hevc_profile.framerate, 60);

    let av1_profile = OutputProfile::preset_1080p60_av1();
    assert_eq!(av1_profile.video_codec, VideoCodec::Av1);
    assert_eq!(av1_profile.video_bitrate_kbps, 3500);

    // Verify encoder pipeline generation
    let bin_hevc = EncoderCapabilityAuditor::build_video_encode_bin(&hevc_profile);
    assert!(bin_hevc.contains("bitrate=") || bin_hevc.contains("parse"));

    let bin_av1 = EncoderCapabilityAuditor::build_video_encode_bin(&av1_profile);
    assert!(bin_av1.contains("bitrate=") || bin_av1.contains("parse"));
}
