use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::graphics::{
    GraphicAnimation, GraphicAnimationType, GraphicItem, GraphicTemplateType,
    NativeGraphicsEngine, GraphicsRenderer,
};
use livestudio_lib::project::model::CURRENT_SCHEMA_VERSION;
use image::{Rgba, RgbaImage};
use tempfile::NamedTempFile;

#[test]
fn test_graphic_item_template_svg_generation() {
    // 1. Lower Third
    let lower_third = GraphicItem::new_lower_third("Presenter", "Jane Doe", "Lead Director");
    let svg_lt = GraphicsRenderer::generate_template_svg(&lower_third, 960, 540);
    assert!(svg_lt.contains("<svg"));
    assert!(svg_lt.contains("Jane Doe"));
    assert!(svg_lt.contains("Lead Director"));

    // 2. Scoreboard
    let scoreboard = GraphicItem::new_scoreboard("Main Game", "HOME", "AWAY");
    let svg_sb = GraphicsRenderer::generate_template_svg(&scoreboard, 960, 540);
    assert!(svg_sb.contains("HOME"));
    assert!(svg_sb.contains("AWAY"));

    // 3. Ticker
    let ticker = GraphicItem::new_ticker("News", "ALERT", "Breaking news headline goes here");
    let svg_tk = GraphicsRenderer::generate_template_svg(&ticker, 960, 540);
    assert!(svg_tk.contains("ALERT"));
    assert!(svg_tk.contains("Breaking news headline goes here"));

    // 4. Station Bug
    let bug = GraphicItem::new_station_bug("Bug", "LSP HD");
    let svg_bg = GraphicsRenderer::generate_template_svg(&bug, 960, 540);
    assert!(svg_bg.contains("LSP HD"));

    // 5. Countdown
    let countdown = GraphicItem::new_countdown("Timer", 300, "STARTS IN");
    let svg_cd = GraphicsRenderer::generate_template_svg(&countdown, 960, 540);
    assert!(svg_cd.contains("STARTS IN"));
    assert!(svg_cd.contains("05:00"));

    // 6. Title Slate
    let slate = GraphicItem::new_title_slate("Slate", "LIVESTUDIO PRO", "BROADCAST BEGINS SHORTLY");
    let svg_sl = GraphicsRenderer::generate_template_svg(&slate, 960, 540);
    assert!(svg_sl.contains("LIVESTUDIO PRO"));
    assert!(svg_sl.contains("BROADCAST BEGINS SHORTLY"));
}

#[test]
fn test_native_graphics_engine_item_lifecycle() {
    let engine = NativeGraphicsEngine::new().expect("Failed to create NativeGraphicsEngine");
    let initial_count = engine.get_config().items.len();
    assert!(initial_count >= 4);

    let custom_item = GraphicItem {
        id: "custom-gfx-1".to_string(),
        name: "Custom Lower Third".to_string(),
        template_type: GraphicTemplateType::LowerThird,
        x: 0.1,
        y: 0.8,
        width: 0.5,
        height: 0.12,
        opacity: 0.95,
        z_index: 10,
        fields: std::collections::HashMap::new(),
        animation: GraphicAnimation {
            in_type: GraphicAnimationType::FlyLeft,
            out_type: GraphicAnimationType::FlyLeft,
            duration_ms: 300,
            auto_out_ms: Some(5000),
        },
        custom_svg: None,
        is_active: false,
    };

    // Save item
    engine.save_item(custom_item.clone());
    let cfg = engine.get_config();
    assert_eq!(cfg.items.len(), initial_count + 1);
    assert!(cfg.items.iter().any(|i| i.id == "custom-gfx-1"));

    // Assign to Overlay Channel 2
    engine.assign_to_overlay(2, "custom-gfx-1").expect("Failed to assign overlay");
    let ch2 = engine.get_config().overlay_channels.into_iter().find(|c| c.channel_index == 2).unwrap();
    assert_eq!(ch2.graphic_id.as_deref(), Some("custom-gfx-1"));

    // Delete item -> should remove from items and unassign from Overlay Channel 2
    let deleted = engine.delete_item("custom-gfx-1");
    assert!(deleted);
    let cfg2 = engine.get_config();
    assert_eq!(cfg2.items.len(), initial_count);
    let ch2_after = cfg2.overlay_channels.into_iter().find(|c| c.channel_index == 2).unwrap();
    assert_eq!(ch2_after.graphic_id, None);
    assert!(!ch2_after.is_on_air);
}

#[test]
fn test_overlay_channel_assignment_and_on_air_transitions() {
    let engine = NativeGraphicsEngine::new().expect("Failed to create NativeGraphicsEngine");
    let items = engine.get_config().items;
    let first_item = &items[0];

    // Assign to Overlay 1
    engine.assign_to_overlay(1, &first_item.id).expect("Assignment failed");

    // Take on air
    engine.take_overlay_on_air(1).expect("Take on air failed");
    let cfg = engine.get_config();
    let ch1 = cfg.overlay_channels.iter().find(|c| c.channel_index == 1).unwrap();
    assert!(ch1.is_on_air);
    assert_eq!(ch1.graphic_id.as_deref(), Some(first_item.id.as_str()));

    // Take off air
    engine.take_overlay_off_air(1).expect("Take off air failed");

    // Toggle overlay
    engine.toggle_overlay(1).expect("Toggle failed");
    let cfg2 = engine.get_config();
    let ch1_tog = cfg2.overlay_channels.iter().find(|c| c.channel_index == 1).unwrap();
    assert!(ch1_tog.is_on_air);
}

#[test]
fn test_scoreboard_score_adjustment() {
    let engine = NativeGraphicsEngine::new().expect("Failed to create NativeGraphicsEngine");
    let scoreboard = GraphicItem::new_scoreboard("Test Game", "TEAM ALPHA", "TEAM BETA");
    let sb_id = scoreboard.id.clone();
    engine.save_item(scoreboard);

    // Initial scores are 0
    let cfg0 = engine.get_config();
    let it0 = cfg0.items.iter().find(|i| i.id == sb_id).unwrap();
    assert_eq!(it0.fields.get("scoreA").map(|s| s.as_str()), Some("0"));
    assert_eq!(it0.fields.get("scoreB").map(|s| s.as_str()), Some("0"));

    // Increment Team A by +3
    engine.adjust_scoreboard_score(&sb_id, "A", 3).expect("Adjustment failed");
    let cfg1 = engine.get_config();
    let it1 = cfg1.items.iter().find(|i| i.id == sb_id).unwrap();
    assert_eq!(it1.fields.get("scoreA").map(|s| s.as_str()), Some("3"));

    // Increment Team B by +1
    engine.adjust_scoreboard_score(&sb_id, "B", 1).expect("Adjustment failed");
    let cfg2 = engine.get_config();
    let it2 = cfg2.items.iter().find(|i| i.id == sb_id).unwrap();
    assert_eq!(it2.fields.get("scoreB").map(|s| s.as_str()), Some("1"));

    // Decrement Team A by -5 (should clamp at 0)
    engine.adjust_scoreboard_score(&sb_id, "A", -5).expect("Adjustment failed");
    let cfg3 = engine.get_config();
    let it3 = cfg3.items.iter().find(|i| i.id == sb_id).unwrap();
    assert_eq!(it3.fields.get("scoreA").map(|s| s.as_str()), Some("0"));
}

#[test]
fn test_native_frame_overlay_compositing() {
    let engine = NativeGraphicsEngine::new().expect("Failed to create NativeGraphicsEngine");
    let items = engine.get_config().items;
    let mut lt_item = items.into_iter().find(|i| i.template_type == GraphicTemplateType::LowerThird).unwrap();
    // Use Cut animation so it immediately renders
    lt_item.animation.in_type = GraphicAnimationType::Cut;
    lt_item.animation.duration_ms = 1;
    let lt_id = lt_item.id.clone();
    engine.save_item(lt_item.clone());

    // Assign Lower Third to Overlay 1 and take on air
    engine.assign_to_overlay(1, &lt_id).expect("Failed to assign");
    engine.take_overlay_on_air(1).expect("Failed to take on air");
    std::thread::sleep(std::time::Duration::from_millis(15));

    // Create a 640x360 solid dark blue canvas
    let mut canvas = RgbaImage::from_pixel(640, 360, Rgba([10, 15, 25, 255]));
    let pixel_before = canvas.get_pixel(82, 313).clone();

    // Composite overlays onto canvas
    engine.composite_active_overlays(&mut canvas);

    // Verify canvas dimensions preserved
    assert_eq!(canvas.width(), 640);
    assert_eq!(canvas.height(), 360);

    // Also test direct compositing helper at 1.0 progress
    GraphicsRenderer::composite_graphic_on_canvas(&mut canvas, &lt_item, 1.0, false);
    let pixel_after = canvas.get_pixel(82, 313).clone();

    // Pixel in lower-third region should have changed from original solid background
    assert_ne!(pixel_before, pixel_after, "Overlay pixel compositing did not modify canvas");
}

#[test]
fn test_schema_v6_migration_and_project_persistence() {
    let controller = ProductionController::new().expect("Failed to init ProductionController");
    let temp_file = NamedTempFile::new().expect("Failed to create temp file");
    let proj_path = temp_file.path().to_path_buf();

    // Controller should start with 4 default graphics items and 4 overlay channels
    let initial_gfx = controller.graphics_get_state();
    assert_eq!(initial_gfx.overlay_channels.len(), 4);
    assert!(initial_gfx.items.len() >= 4);

    // Modify a graphic item and assign to Overlay 1
    let mut item = initial_gfx.items[0].clone();
    item.fields.insert("title".into(), "Chief Architect Broadcast".into());
    controller.graphics_save_item(item.clone()).expect("Failed to save item");
    controller.graphics_set_overlay_item(1, &item.id).expect("Failed to assign overlay");
    controller.graphics_take_overlay_on_air(1).expect("Failed to take on air");

    // Save project to disk
    let saved = controller.save_project_as(&proj_path).expect("Failed to save project");
    assert_eq!(saved.schema_version, CURRENT_SCHEMA_VERSION);
    assert_eq!(saved.graphics.overlay_channels.len(), 4);
    assert_eq!(saved.graphics.overlay_channels[0].graphic_id.as_deref(), Some(item.id.as_str()));

    // Load project back into controller
    let loaded = controller.load_project(&proj_path).expect("Failed to load project");
    assert_eq!(loaded.schema_version, CURRENT_SCHEMA_VERSION);
    let loaded_gfx = controller.graphics_get_state();
    assert_eq!(loaded_gfx.overlay_channels.len(), 4);
    assert_eq!(loaded_gfx.overlay_channels[0].graphic_id.as_deref(), Some(item.id.as_str()));
    let loaded_item = loaded_gfx.items.iter().find(|i| i.id == item.id).unwrap();
    assert_eq!(loaded_item.fields.get("title").map(|s| s.as_str()), Some("Chief Architect Broadcast"));

    // Verify preview frame generation returns a valid base64 data URL
    let preview_url = controller.graphics_get_preview_frame(&item.id);
    assert!(preview_url.is_some());
    let url = preview_url.unwrap();
    assert!(url.starts_with("data:image/jpeg;base64,"));
}
