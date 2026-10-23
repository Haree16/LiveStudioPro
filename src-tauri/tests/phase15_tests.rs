use image::{Rgba, RgbaImage};
use livestudio_lib::audio::vst3::{Vst3HostScanner, Vst3Parameter, Vst3PluginDescriptor, Vst3PluginInstance};
use livestudio_lib::automation::script_runner::{SandboxedScriptRunner, ScriptCommand};
use livestudio_lib::broadcast::scopes::BroadcastScopesAnalyzer;
use livestudio_lib::broadcast::virtual_studio::{VirtualCameraTrack, VirtualStudioEngine};
use livestudio_lib::graphics::timeline::{EasingFunction, GraphicAnimationTimeline, Keyframe};
use livestudio_lib::media::html_input::{HtmlInputConfig, HtmlInputEngine};
use livestudio_lib::switcher::telestrator::{TelestratorCanvas, TelestratorPoint, TelestratorStroke, TelestratorTool};

#[test]
fn test_broadcast_waveform_and_vectorscope() {
    // Construct a 100x100 test frame with pure red, green, and blue bars
    let mut frame = RgbaImage::from_pixel(100, 100, Rgba([0, 0, 0, 255]));
    for y in 0..100 {
        for x in 0..33 {
            *frame.get_pixel_mut(x, y) = Rgba([255, 0, 0, 255]); // Red
        }
        for x in 33..66 {
            *frame.get_pixel_mut(x, y) = Rgba([0, 255, 0, 255]); // Green
        }
        for x in 66..100 {
            *frame.get_pixel_mut(x, y) = Rgba([0, 0, 255, 255]); // Blue
        }
    }

    // 1. Compute waveform
    let wf = BroadcastScopesAnalyzer::compute_waveform(&frame, 64);
    assert_eq!(wf.columns, 64);
    assert_eq!(wf.bins, 256);
    assert!(wf.max_intensity > 0);

    // 2. Compute vectorscope
    let vs = BroadcastScopesAnalyzer::compute_vectorscope(&frame, 128);
    assert_eq!(vs.resolution, 128);
    assert!(vs.max_intensity > 0);
}

#[test]
fn test_vst3_plugin_hosting_and_audio_processing() {
    let descriptor = Vst3PluginDescriptor {
        id: "vst3-master-limiter".into(),
        name: "Broadcast Master Limiter".into(),
        vendor: "FabFilter Simulation".into(),
        version: "2.1.0".into(),
        category: "Limiter".into(),
        file_path: "/usr/lib/vst3/MasterLimiter.vst3".into(),
        is_64bit: true,
        parameters: vec![
            Vst3Parameter {
                id: 1,
                name: "Gain".into(),
                min_value: 0.0,
                max_value: 2.0,
                default_value: 1.0,
                current_value: 1.0,
                unit: "x".into(),
            },
        ],
        latency_samples: 32,
    };

    let mut instance = Vst3PluginInstance::new("inst-1", &descriptor);
    assert_eq!(instance.plugin_id, "vst3-master-limiter");
    assert_eq!(instance.get_parameter(1), Some(1.0));

    // Modulate gain parameter to 0.5x
    instance.set_parameter(1, 0.5);

    let mut left = vec![1.0f32, 0.8f32, -0.6f32];
    let mut right = vec![1.0f32, 0.8f32, -0.6f32];

    instance.process_stereo(&mut left, &mut right);

    assert_eq!(left[0], 0.5);
    assert_eq!(left[1], 0.4);
    assert_eq!(right[2], -0.3);

    // Verify VST3 host scanner paths
    let paths = Vst3HostScanner::get_default_vst3_paths();
    assert!(!paths.is_empty());
}

#[test]
fn test_3d_virtual_studio_camera_tracks_and_transform() {
    let engine = VirtualStudioEngine::new();

    let wide = VirtualCameraTrack {
        id: "track-wide".into(),
        name: "Wide Shot".into(),
        pan_x: 0.0,
        pan_y: 0.0,
        zoom: 1.0,
        duration_ms: 1000,
    };

    let close_up = VirtualCameraTrack {
        id: "track-close".into(),
        name: "Close Up Host".into(),
        pan_x: 0.2,
        pan_y: -0.1,
        zoom: 2.0,
        duration_ms: 1000,
    };

    engine.save_camera_track(wide.clone());
    engine.save_camera_track(close_up.clone());

    let tracks = engine.list_camera_tracks();
    assert!(tracks.len() >= 2);

    // Test cosine ease interpolation at midpoint (50%)
    let mid = VirtualStudioEngine::interpolate_camera_tracks(&wide, &close_up, 0.5);
    assert!((mid.zoom - 1.5).abs() < 0.01);
    assert!((mid.pan_x - 0.1).abs() < 0.01);

    // Test camera transform frame rendering
    let src = RgbaImage::from_pixel(64, 64, Rgba([200, 100, 50, 255]));
    let transformed = VirtualStudioEngine::apply_camera_transform(&src, &close_up);
    assert_eq!(transformed.dimensions(), (64, 64));
}

#[test]
fn test_gt_designer_keyframe_animation_timeline() {
    let mut timeline = GraphicAnimationTimeline::default();
    timeline.duration_ms = 1000;
    timeline.x_track = vec![
        Keyframe { timestamp_ms: 0, value: -100.0, easing: EasingFunction::Linear },
        Keyframe { timestamp_ms: 500, value: 0.0, easing: EasingFunction::EaseOutQuad },
        Keyframe { timestamp_ms: 1000, value: 50.0, easing: EasingFunction::Linear },
    ];

    // At t=0
    let t0 = timeline.evaluate_at(0);
    assert_eq!(t0.x, -100.0);

    // At t=500
    let t500 = timeline.evaluate_at(500);
    assert_eq!(t500.x, 0.0);

    // At t=1000
    let t1000 = timeline.evaluate_at(1000);
    assert_eq!(t1000.x, 50.0);
}

#[test]
fn test_telestrator_drawing_layer_and_overlay_render() {
    let mut canvas = TelestratorCanvas::new();

    let stroke = TelestratorStroke {
        id: "stroke-1".into(),
        tool: TelestratorTool::Pen,
        color_rgba: [255, 255, 0, 255], // Yellow
        line_width: 4.0,
        points: vec![
            TelestratorPoint { x: 0.5, y: 0.5 },
            TelestratorPoint { x: 0.51, y: 0.51 },
        ],
    };

    canvas.add_stroke(stroke);
    assert_eq!(canvas.strokes.len(), 1);

    // Render to overlay
    let overlay = canvas.render_to_overlay(100, 100);
    assert_eq!(overlay.dimensions(), (100, 100));

    // Verify center pixel has been drawn
    let center_px = overlay.get_pixel(50, 50);
    assert_eq!(center_px[0], 255);
    assert_eq!(center_px[1], 255);
    assert_eq!(center_px[2], 0);

    // Test Undo
    assert!(canvas.undo());
    assert_eq!(canvas.strokes.len(), 0);

    // Test Redo
    assert!(canvas.redo());
    assert_eq!(canvas.strokes.len(), 1);
}

#[test]
fn test_sandboxed_script_runner() {
    let script = r#"
        // Broadcast intro routine
        FADER mic-1 -6.0
        CUT cam-1
        FADE cam-2 500
        OVERLAY 1 lower-third-host on
        LOG Broadcast routine executed cleanly
    "#;

    let parsed = SandboxedScriptRunner::parse_script(script).expect("Failed to parse script");
    assert_eq!(parsed.len(), 5);

    match &parsed[0] {
        ScriptCommand::SetFaderDb { input_id, fader_db } => {
            assert_eq!(input_id, "mic-1");
            assert_eq!(*fader_db, -6.0);
        }
        _ => panic!("Expected SetFaderDb"),
    }

    let result = SandboxedScriptRunner::execute_sandboxed(&parsed, 100);
    assert!(result.success);
    assert_eq!(result.steps_executed, 5);
    assert_eq!(result.logs.len(), 5);
}

#[test]
fn test_html_browser_input_pipeline_and_texture() {
    let config = HtmlInputConfig {
        url: "https://overlays.stream/scoreboard".into(),
        width: 1280,
        height: 720,
        framerate: 60,
        transparent_background: true,
        custom_css: Some(".clock { color: #ff0000; }".into()),
        custom_js: None,
    };

    let pipe = HtmlInputEngine::build_browser_pipeline(&config);
    assert!(pipe.contains("appsrc name=browser_src"));
    assert!(pipe.contains("width=1280,height=720"));

    let frame = HtmlInputEngine::render_html_placeholder(&config, "Scoreboard");
    assert_eq!(frame.dimensions(), (1280, 720));
}
