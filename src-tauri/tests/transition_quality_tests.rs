use image::{Rgba, RgbaImage};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{InputItem, InputType};
use livestudio_lib::switcher::{TransitionEngine, TransitionType};

/// Left half red, right half green, so spatial scaling is observable.
fn split_frame(w: u32, h: u32, left: [u8; 4], right: [u8; 4]) -> RgbaImage {
    RgbaImage::from_fn(w, h, |x, _| Rgba(if x < w / 2 { left } else { right }))
}

#[test]
fn test_zoom_is_spatial_not_a_crossfade() {
    let (w, h) = (100, 100);
    // Outgoing: white centre column on black. Incoming: solid blue.
    let from = RgbaImage::from_fn(w, h, |x, _| if (40..60).contains(&x) { Rgba([255, 255, 255, 255]) } else { Rgba([0, 0, 0, 255]) });
    let to = RgbaImage::from_pixel(w, h, Rgba([0, 0, 255, 255]));

    // p = 0 -> identical to outgoing picture; p = 1 -> identical to incoming picture.
    let start = TransitionEngine::render_transition(TransitionType::Zoom, &from, &to, 0.0);
    assert_eq!(start.get_pixel(50, 50).0, [255, 255, 255, 255]);
    assert_eq!(start.get_pixel(10, 50).0, [0, 0, 0, 255]);
    let end = TransitionEngine::render_transition(TransitionType::Zoom, &from, &to, 1.0);
    assert_eq!(end.get_pixel(10, 50).0, [0, 0, 255, 255]);
    assert_eq!(end.get_pixel(50, 50).0, [0, 0, 255, 255]);

    // Mid-way the outgoing column has zoomed wider than its original 20px, which a plain
    // crossfade (where x=35 stays pure black/blue mix) could never produce.
    let mid = TransitionEngine::render_transition(TransitionType::Zoom, &from, &to, 0.5);
    let crossfade = TransitionEngine::render_transition(TransitionType::Crossfade, &from, &to, 0.5);
    assert_ne!(mid.get_pixel(35, 50).0, crossfade.get_pixel(35, 50).0);
    assert!(mid.get_pixel(35, 50)[0] > 0, "zoomed white column reaches x=35");
    assert_eq!(crossfade.get_pixel(35, 50)[0], 0, "crossfade never spreads the column");
}

#[test]
fn test_stinger_composites_user_media_with_alpha_and_cut_point() {
    let from = RgbaImage::from_pixel(10, 10, Rgba([255, 0, 0, 255]));
    let to = RgbaImage::from_pixel(10, 10, Rgba([0, 255, 0, 255]));
    // Stinger: left half opaque white, right half fully transparent.
    let stinger = split_frame(10, 10, [255, 255, 255, 255], [0, 0, 0, 0]);

    let before_cut = TransitionEngine::render_stinger(&from, &to, &stinger, 0.3, 0.5);
    assert_eq!(before_cut.get_pixel(1, 5).0, [255, 255, 255, 255], "opaque stinger pixel covers picture");
    assert_eq!(before_cut.get_pixel(8, 5).0, [255, 0, 0, 255], "transparent pixel shows outgoing source");

    let after_cut = TransitionEngine::render_stinger(&from, &to, &stinger, 0.7, 0.5);
    assert_eq!(after_cut.get_pixel(8, 5).0, [0, 255, 0, 255], "after cut point the incoming source shows");

    // Custom cut point honoured.
    let late_cut = TransitionEngine::render_stinger(&from, &to, &stinger, 0.7, 0.9);
    assert_eq!(late_cut.get_pixel(8, 5).0, [255, 0, 0, 255]);

    // Half-transparent stinger blends.
    let half = RgbaImage::from_pixel(10, 10, Rgba([0, 0, 0, 128]));
    let blended = TransitionEngine::render_stinger(&from, &to, &half, 0.1, 0.5);
    let r = blended.get_pixel(5, 5)[0];
    assert!((120..=135).contains(&r), "got {r}");
}

#[test]
fn test_set_stinger_validates_input_and_persists_in_project() {
    let c = ProductionController::new().expect("controller");
    c.add_input(InputItem::new("st-1", "My Stinger", InputType::Image, "/tmp/none.png")).unwrap();

    assert!(c.set_stinger(Some("missing".into()), 0.5).is_err());
    c.set_stinger(Some("st-1".into()), 3.0).unwrap(); // clamped to 1.0
    let state = c.get_current_project().switcher_state;
    assert_eq!(state.stinger_input_id.as_deref(), Some("st-1"));
    assert_eq!(state.stinger_cut_point, 1.0);

    c.set_stinger(None, 0.5).unwrap();
    assert!(c.get_current_project().switcher_state.stinger_input_id.is_none());
}
