use std::thread::sleep;
use std::time::Duration;

use image::{ImageFormat, Rgba, RgbaImage};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::playback::model::ReplayConfig;
use livestudio_lib::playback::replay::REPLAY_SOURCE_ID;
use livestudio_lib::project::model::{InputItem, InputType};

fn solid_jpeg(r: u8, g: u8, b: u8) -> Vec<u8> {
    let img = RgbaImage::from_pixel(64, 36, Rgba([r, g, b, 255]));
    let mut buf = Vec::new();
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Jpeg)
        .unwrap();
    buf
}

fn dominant(img: &RgbaImage) -> char {
    let p = img.get_pixel(32, 18).0;
    if p[0] > 150 && p[1] < 100 && p[2] < 100 {
        'r'
    } else if p[2] > 150 && p[0] < 100 && p[1] < 100 {
        'b'
    } else if p[1] > 150 && p[0] < 100 && p[2] < 100 {
        'g'
    } else {
        '?'
    }
}

// Synthetic footage is ingested under "ext-cam" (not a live input) so the background
// ingest worker capturing "cam-1" cannot mix extra frames into the clip.
fn setup() -> ProductionController {
    let c = ProductionController::new().expect("controller");
    c.add_input(InputItem::new("cam-1", "Cam 1", InputType::TestPattern, "smpte")).unwrap();
    c.switcher.set_program_source(Some("cam-1".into()));
    let mut cfg = ReplayConfig::default();
    cfg.enabled = true;
    c.replay_set_config(cfg).unwrap();
    c.replay_start_capture().unwrap();
    c
}

#[test]
fn test_replay_take_plays_buffered_footage_not_live_input() {
    let c = setup();
    for (r, g, b) in [(255, 0, 0), (0, 0, 255), (0, 255, 0)] {
        c.replay_engine.ingest_frame("ext-cam", "Ext Cam", solid_jpeg(r, g, b));
        sleep(Duration::from_millis(80));
    }
    c.replay_mark_quick_clip("Play", "ext-cam", 5, 1.0).unwrap();

    c.replay_take_live().unwrap();
    assert_eq!(c.switcher.get_preview_source().as_deref(), Some(REPLAY_SOURCE_ID));

    // Starts at the first buffered frame (red) rather than the newest.
    let first = c.resolve_source_frame(REPLAY_SOURCE_ID).expect("replay frame");
    assert_eq!(dominant(&first), 'r');

    // Plays through and holds the last frame (green) at the end of the clip.
    sleep(Duration::from_millis(600));
    let last = c.resolve_source_frame(REPLAY_SOURCE_ID).expect("replay frame");
    assert_eq!(dominant(&last), 'g', "pixel was {:?}", last.get_pixel(32, 18));
    assert!(c.replay_engine.is_playout_finished());
}

#[test]
fn test_replay_speed_scales_playout_position() {
    let c = setup();
    for (r, g, b) in [(255, 0, 0), (0, 0, 255), (0, 255, 0)] {
        c.replay_engine.ingest_frame("ext-cam", "Ext Cam", solid_jpeg(r, g, b));
        sleep(Duration::from_millis(100));
    }
    // 0.1x: after ~250 ms of wall time only ~25 ms of the clip has played -> still the first frame.
    c.replay_mark_quick_clip("Slow", "ext-cam", 5, 0.1).unwrap();
    c.replay_take_live().unwrap();
    let _ = c.resolve_source_frame(REPLAY_SOURCE_ID);
    sleep(Duration::from_millis(250));
    let slow = c.resolve_source_frame(REPLAY_SOURCE_ID).unwrap();
    assert_eq!(dominant(&slow), 'r');
    assert!(!c.replay_engine.is_playout_finished());
}

#[test]
fn test_replay_take_requires_a_clip_and_return_restores_live() {
    let c = setup();
    assert!(c.replay_take_live().is_err());
    assert!(!c.replay_engine.is_replay_on_air());

    c.replay_engine.ingest_frame("cam-1", "Cam 1", solid_jpeg(255, 0, 0));
    c.replay_mark_quick_clip("x", "cam-1", 5, 0.5).unwrap();
    c.replay_take_live().unwrap();
    assert_eq!(c.replay_return_to_live().unwrap(), Some("cam-1".into()));
    assert_eq!(c.switcher.get_status().program_source_id, Some("cam-1".into()));
    assert!(c.resolve_source_frame(REPLAY_SOURCE_ID).is_none(), "no playout after return");
}
