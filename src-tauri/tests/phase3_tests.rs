use image::{Rgba, RgbaImage};
use livestudio_lib::project::model::{
    InputItem, InputType, ProjectFile, SwitcherPersistedState, CURRENT_SCHEMA_VERSION,
};
use livestudio_lib::project::persistence::ProjectStore;
use livestudio_lib::switcher::compositor::SceneCompositor;
use livestudio_lib::switcher::controller::SwitcherController;
use livestudio_lib::switcher::model::{FitMode, MultiviewLayout, Scene, SceneLayer, TransitionType};
use livestudio_lib::switcher::transition::TransitionEngine;
use std::collections::HashMap;
use tempfile::tempdir;

#[test]
fn test_preview_program_bus_independence() {
    let switcher = SwitcherController::new();

    // Set initial program source
    switcher.set_program_source(Some("cam-1".into()));
    assert_eq!(switcher.get_status().program_source_id, Some("cam-1".into()));
    assert_eq!(switcher.get_status().preview_source_id, None);

    // Changing preview source must NOT alter program source
    switcher.set_preview_source(Some("cam-2".into()));
    assert_eq!(switcher.get_status().program_source_id, Some("cam-1".into()));
    assert_eq!(switcher.get_status().preview_source_id, Some("cam-2".into()));

    // Changing preview source to another one
    switcher.set_preview_source(Some("cam-3".into()));
    assert_eq!(switcher.get_status().program_source_id, Some("cam-1".into()));
    assert_eq!(switcher.get_status().preview_source_id, Some("cam-3".into()));

    // Changing preview scene must NOT alter program scene or program source
    let scene = switcher.create_scene("PiP Layout", 1920, 1080);
    switcher.set_preview_scene(Some(scene.id.clone()));

    assert_eq!(switcher.get_status().preview_scene_id, Some(scene.id));
    assert_eq!(switcher.get_status().program_scene_id, None);
    assert_eq!(switcher.get_status().program_source_id, Some("cam-1".into()));
}

#[test]
fn test_cut_transition_and_swapping() {
    let switcher = SwitcherController::new();

    switcher.set_preview_source(Some("cam-a".into()));
    switcher.set_program_source(Some("cam-b".into()));

    // Execute CUT
    switcher.cut();
    assert_eq!(switcher.get_status().program_source_id, Some("cam-a".into()));
    // In our cut() implementation: preview is switched to program
    assert_eq!(switcher.get_status().program_source_id, Some("cam-a".into()));
}

#[test]
fn test_transition_engine_pixel_accuracy() {
    let width = 100;
    let height = 100;

    // From: Pure Red
    let from_img = RgbaImage::from_pixel(width, height, Rgba([255, 0, 0, 255]));
    // To: Pure Blue
    let to_img = RgbaImage::from_pixel(width, height, Rgba([0, 0, 255, 255]));

    // 1. Cut
    let cut_0 = TransitionEngine::render_transition(TransitionType::Cut, &from_img, &to_img, 0.0);
    assert_eq!(cut_0.get_pixel(50, 50), &Rgba([255, 0, 0, 255]));
    let cut_1 = TransitionEngine::render_transition(TransitionType::Cut, &from_img, &to_img, 1.0);
    assert_eq!(cut_1.get_pixel(50, 50), &Rgba([0, 0, 255, 255]));

    // 2. Crossfade at 50%
    let fade_mid = TransitionEngine::render_transition(TransitionType::Crossfade, &from_img, &to_img, 0.5);
    let p = fade_mid.get_pixel(50, 50);
    // Red roughly 127/128, Blue roughly 127/128
    assert!((p[0] as i16 - 127).abs() <= 2);
    assert!((p[2] as i16 - 127).abs() <= 2);
    assert_eq!(p[3], 255);

    // 3. Wipe Horizontal at 50%
    let wipe_mid = TransitionEngine::render_transition(TransitionType::WipeHorizontal, &from_img, &to_img, 0.5);
    // Left side (x=25) should be destination (Blue), right side (x=75) should be source (Red)
    assert_eq!(wipe_mid.get_pixel(25, 50), &Rgba([0, 0, 255, 255]));
    assert_eq!(wipe_mid.get_pixel(75, 50), &Rgba([255, 0, 0, 255]));

    // 4. Wipe Vertical at 50%
    let wipe_v_mid = TransitionEngine::render_transition(TransitionType::WipeVertical, &from_img, &to_img, 0.5);
    // Top side (y=25) should be Blue, bottom side (y=75) should be Red
    assert_eq!(wipe_v_mid.get_pixel(50, 25), &Rgba([0, 0, 255, 255]));
    assert_eq!(wipe_v_mid.get_pixel(50, 75), &Rgba([255, 0, 0, 255]));

    // 5. Fade to Black at 50%
    let ftb_mid = TransitionEngine::render_transition(TransitionType::FadeToBlack, &from_img, &to_img, 0.5);
    let black_pixel = ftb_mid.get_pixel(50, 50);
    // At exactly mid-point, should be pitch black
    assert!(black_pixel[0] <= 5);
    assert!(black_pixel[1] <= 5);
    assert!(black_pixel[2] <= 5);

    // 6. Slide Horizontal at 50%
    let slide_mid = TransitionEngine::render_transition(TransitionType::SlideHorizontal, &from_img, &to_img, 0.5);
    assert_eq!(slide_mid.get_pixel(25, 50), &Rgba([255, 0, 0, 255])); // shifted old image
    assert_eq!(slide_mid.get_pixel(75, 50), &Rgba([0, 0, 255, 255])); // new incoming image
}

#[test]
fn test_concurrent_auto_transition_rejection() {
    let switcher = SwitcherController::new();
    switcher.set_preview_source(Some("src-1".into()));
    switcher.set_program_source(Some("src-2".into()));

    // Start auto transition with 1000ms duration
    switcher.set_transition_duration(1000);
    switcher.set_transition_type(TransitionType::Crossfade);
    let res = switcher.auto(Some(1000));
    assert!(res.is_ok());
    assert!(switcher.get_status().is_transitioning);

    // Attempting a second AUTO while one is running must be rejected
    let second_auto = switcher.auto(Some(1000));
    assert!(second_auto.is_err(), "Concurrent AUTO transition must be rejected");

    // But CUT should override immediately and clear the transition
    switcher.cut();
    assert!(!switcher.get_status().is_transitioning);
}

#[test]
fn test_scene_compositing_engine() {
    let width = 640;
    let height = 360;

    let scene = Scene {
        id: "scene-main".into(),
        name: "Main with PiP".into(),
        canvas_width: width,
        canvas_height: height,
        background_color: "#1e1e1e".into(),
        layers: vec![
            SceneLayer {
                id: "layer-bg".into(),
                name: "Background".into(),
                source_id: "cam-wide".into(),
                z_index: 0,
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
                fit_mode: FitMode::Fill,
                opacity: 1.0,
                crop_left: 0.0,
                crop_right: 0.0,
                crop_top: 0.0,
                crop_bottom: 0.0,
                visible: true,
            },
            SceneLayer {
                id: "layer-pip".into(),
                name: "Picture in Picture".into(),
                source_id: "cam-pip".into(),
                z_index: 10,
                x: 0.65,
                y: 0.05,
                width: 0.3,
                height: 0.3,
                fit_mode: FitMode::Fit,
                opacity: 0.8,
                crop_left: 0.0,
                crop_right: 0.0,
                crop_top: 0.1,
                crop_bottom: 0.1,
                visible: true,
            },
        ],
    };

    let mut frames: HashMap<String, RgbaImage> = HashMap::new();
    frames.insert(
        "cam-wide".into(),
        RgbaImage::from_pixel(320, 240, Rgba([100, 200, 50, 255])),
    );
    frames.insert(
        "cam-pip".into(),
        RgbaImage::from_pixel(320, 240, Rgba([200, 50, 100, 255])),
    );

    let frame_resolver = |id: &str| -> Option<RgbaImage> { frames.get(id).cloned() };

    let composed = SceneCompositor::render_scene(&scene, frame_resolver);
    assert_eq!(composed.width(), width);
    assert_eq!(composed.height(), height);

    // In bottom-left (x=50, y=300), only layer-bg should be visible
    let bg_pixel = composed.get_pixel(50, 300);
    assert_eq!(bg_pixel[0], 100);
    assert_eq!(bg_pixel[1], 200);
    assert_eq!(bg_pixel[2], 50);

    // Verify JPEG encoding data URL
    let data_url = SceneCompositor::to_data_url(&composed, 80);
    assert!(data_url.starts_with("data:image/jpeg;base64,"));
}

#[test]
fn test_freeze_frame_fallback_on_source_failure() {
    let switcher = SwitcherController::new();

    // Cache an initial valid program frame
    switcher.set_program_source(Some("live-camera".into()));
    let valid_frame = RgbaImage::from_pixel(640, 360, Rgba([255, 128, 0, 255]));
    let output1 = switcher.render_program_frame(|_| Some(valid_frame.clone()));
    assert_eq!(output1.get_pixel(50, 50), &Rgba([255, 128, 0, 255]));

    // Now simulate source disconnect or failure: resolver returns None
    let output2 = switcher.render_program_frame(|_| None);

    // Should fallback to cached freeze-frame instead of crashing
    let pixel = output2.get_pixel(50, 50);
    assert_eq!(pixel, &Rgba([255, 128, 0, 255]));
}

#[test]
fn test_multiview_layout_configuration() {
    let switcher = SwitcherController::new();
    assert_eq!(switcher.get_status().multiview_layout, MultiviewLayout::Grid4);

    switcher.set_multiview_layout(MultiviewLayout::Grid8);
    assert_eq!(switcher.get_status().multiview_layout, MultiviewLayout::Grid8);

    switcher.set_multiview_layout(MultiviewLayout::Grid16);
    assert_eq!(switcher.get_status().multiview_layout, MultiviewLayout::Grid16);
}

#[test]
fn test_project_v3_schema_persistence_and_scenes() {
    let dir = tempdir().expect("Failed to create tempdir");
    let file_path = dir.path().join("production_v3.lsproj");

    let mut project = ProjectFile::new("Phase 3 Mega Show");
    assert_eq!(project.schema_version, CURRENT_SCHEMA_VERSION);

    // Add inputs
    let cam1 = InputItem::new("cam-1", "Studio Cam 1", InputType::VideoCapture, "/dev/video0");
    let cam2 = InputItem::new("cam-2", "Studio Cam 2", InputType::VideoCapture, "/dev/video1");
    project.inputs = vec![cam1, cam2];

    // Add scenes
    let scene = Scene {
        id: "interview-scene".into(),
        name: "Host + Guest Split".into(),
        canvas_width: 1920,
        canvas_height: 1080,
        background_color: "#101010".into(),
        layers: vec![
            SceneLayer {
                id: "left-host".into(),
                name: "Host".into(),
                source_id: "cam-1".into(),
                z_index: 0,
                x: 0.0,
                y: 0.0,
                width: 0.5,
                height: 1.0,
                fit_mode: FitMode::Fill,
                opacity: 1.0,
                crop_left: 0.0,
                crop_right: 0.0,
                crop_top: 0.0,
                crop_bottom: 0.0,
                visible: true,
            },
            SceneLayer {
                id: "right-guest".into(),
                name: "Guest".into(),
                source_id: "cam-2".into(),
                z_index: 1,
                x: 0.5,
                y: 0.0,
                width: 0.5,
                height: 1.0,
                fit_mode: FitMode::Fill,
                opacity: 1.0,
                crop_left: 0.0,
                crop_right: 0.0,
                crop_top: 0.0,
                crop_bottom: 0.0,
                visible: true,
            },
        ],
    };
    project.scenes.push(scene);

    // Set switcher state
    project.switcher_state = SwitcherPersistedState {
        preview_input_id: Some("cam-2".into()),
        program_input_id: Some("cam-1".into()),
        preview_scene_id: Some("interview-scene".into()),
        program_scene_id: None,
        transition_duration_ms: 500,
        transition_type: "wipeHorizontal".into(),
        multiview_layout: "grid4".into(),
        display_output_id: Some("HDMI-1".into()),
        fallback_policy: "freeze".into(),
        ..Default::default()
    };

    ProjectStore::save(&project, &file_path).expect("Failed to save v3 project");

    // Load back
    let loaded = ProjectStore::load(&file_path).expect("Failed to load v3 project");
    assert_eq!(loaded.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(loaded.scenes.len(), 1);
    assert_eq!(loaded.scenes[0].id, "interview-scene");
    assert_eq!(loaded.scenes[0].layers.len(), 2);
    assert_eq!(loaded.switcher_state.transition_type, "wipeHorizontal");
    assert_eq!(loaded.switcher_state.preview_scene_id, Some("interview-scene".into()));
    assert_eq!(loaded.switcher_state.display_output_id, Some("HDMI-1".into()));
}
