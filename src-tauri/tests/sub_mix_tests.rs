use image::{Rgba, RgbaImage};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{InputItem, InputType};
use livestudio_lib::switcher::model::{parse_sub_mix_source_id, sub_mix_source_id};

#[test]
fn test_sub_mix_source_ids() {
    assert_eq!(sub_mix_source_id(3), "mix:3");
    assert_eq!(parse_sub_mix_source_id("mix:3"), Some(3));
    assert_eq!(parse_sub_mix_source_id("mix:1"), None);
    assert_eq!(parse_sub_mix_source_id("mix:17"), None);
    assert_eq!(parse_sub_mix_source_id("cam-1"), None);
}

#[test]
fn test_sub_mix_validation_and_cut() {
    let c = ProductionController::new().unwrap();
    c.add_input(InputItem::new("cam-1", "Cam 1", InputType::TestPattern, "smpte")).unwrap();

    assert!(c.sub_mix_set_source(1, Some("cam-1".into()), false).is_err());
    assert!(c.sub_mix_set_source(2, Some("nope".into()), false).is_err());
    assert!(c.sub_mix_set_source(2, Some("mix:3".into()), false).is_err());
    assert!(c.sub_mix_cut(99).is_err());

    c.sub_mix_set_source(2, Some("cam-1".into()), false).unwrap();
    assert_eq!(c.switcher_get_sub_mix(2).unwrap().program_source_id, None);
    c.sub_mix_cut(2).unwrap();
    assert_eq!(c.switcher_get_sub_mix(2).unwrap().program_source_id.as_deref(), Some("cam-1"));
}

#[test]
fn test_sub_mix_program_frame_is_usable_as_main_source_and_preview_stays_off_air() {
    let c = ProductionController::new().unwrap();
    c.add_input(InputItem::new("cam-1", "Cam 1", InputType::TestPattern, "smpte")).unwrap();
    // Nothing on mix program -> no frame, even though preview is cued.
    c.sub_mix_set_source(2, Some("cam-1".into()), false).unwrap();
    assert!(c.resolve_source_frame("mix:2").is_none());

    // A mix whose program is another mix is rejected at render time (no loops).
    let frame = |id: &str| -> Option<RgbaImage> {
        if id == "cam-1" { Some(RgbaImage::from_pixel(4, 4, Rgba([9, 9, 9, 255]))) } else { None }
    };
    c.switcher.set_sub_mix_program(3, Some("mix:2".into()));
    assert!(c.switcher.render_sub_mix_frame(3, frame).is_none());
    c.switcher.set_sub_mix_program(3, Some("cam-1".into()));
    assert_eq!(c.switcher.render_sub_mix_frame(3, frame).unwrap().get_pixel(0, 0).0, [9, 9, 9, 255]);

    // The main switcher can cue the mix like any input.
    c.set_preview(Some("mix:3".into())).unwrap();
    assert_eq!(c.switcher.get_preview_source().as_deref(), Some("mix:3"));
}
