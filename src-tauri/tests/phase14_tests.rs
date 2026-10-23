use livestudio_lib::audio::matrix::{AudioChannelRoute, AudioMatrixConfig, AudioMatrixEngine, ProAudioDriver};
use livestudio_lib::broadcast::hardware::SignalLockStatus;
use livestudio_lib::broadcast::ndi::NdiEcosystemManager;
use livestudio_lib::broadcast::sdi_playout::{SdiPlayoutConfig, SdiPlayoutEngine, SdiVideoMode};
use livestudio_lib::broadcast::timecode::{SmpteTimecode, TimecodeRate};

#[test]
fn test_ndi_ecosystem_probe_and_pipelines() {
    let status = NdiEcosystemManager::probe_ecosystem();
    assert_eq!(status.download_url, "https://ndi.video/tools/ndi-core-suite/");

    // Verify NDI input pipeline generation
    let in_pipe = NdiEcosystemManager::build_ndi_input_pipeline("STUDIO-CAM1", false);
    assert!(in_pipe.contains("ndisrc source-name=\"STUDIO-CAM1\""));
    assert!(in_pipe.contains("video/x-raw,format=RGBA"));

    // Verify NDI low-bandwidth HX flag
    let in_hx_pipe = NdiEcosystemManager::build_ndi_input_pipeline("PTZ-CAMERA", true);
    assert!(in_hx_pipe.contains("low-bandwidth=true"));

    // Verify NDI output pipeline generation
    let out_pipe = NdiEcosystemManager::build_ndi_output_pipeline("LiveStudio Pro Program");
    assert!(out_pipe.contains("appsrc name=ndisrc"));
    assert!(out_pipe.contains("ndisink stream-name=\"LiveStudio Pro Program\""));
}

#[test]
fn test_sdi_playout_modes_and_pipeline_generation() {
    let mut config = SdiPlayoutConfig::default();
    config.device_number = 1;
    config.mode = SdiVideoMode::Mode1080p5994;

    let (fmt, w, h, num, den) = config.mode.gstreamer_video_format();
    assert_eq!(fmt, "UYVY");
    assert_eq!(w, 1920);
    assert_eq!(h, 1080);
    assert_eq!(num, 60000);
    assert_eq!(den, 1001);

    let pipe = SdiPlayoutEngine::build_playout_pipeline(&config);
    assert!(pipe.contains("appsrc name=sdisrc"));
    assert!(pipe.contains("width=1920,height=1080"));
    assert!(pipe.contains("decklinkvideosink") || pipe.contains("fakesink"));
}

#[test]
fn test_sdi_hardware_genlock_reference_locking() {
    // With external tri-level reference signal
    let locked_status = SdiPlayoutEngine::evaluate_genlock_reference(true, SdiVideoMode::Mode1080p5994);
    match locked_status {
        SignalLockStatus::GenlockLocked(ref desc) => {
            assert!(desc.contains("Tri-Level Reference Sync"));
        }
        _ => panic!("Expected GenlockLocked status"),
    }

    // Without external reference (Free run clock)
    let freerun_status = SdiPlayoutEngine::evaluate_genlock_reference(false, SdiVideoMode::Mode1080p5994);
    match freerun_status {
        SignalLockStatus::Locked(ref desc) => {
            assert!(desc.contains("Free Run Internal Clock"));
        }
        _ => panic!("Expected Locked free-run status"),
    }
}

#[test]
fn test_sdi_embedded_smpte_rp188_timecode() {
    let tc_ndf = SmpteTimecode {
        hours: 14,
        minutes: 30,
        seconds: 15,
        frames: 22,
        rate: TimecodeRate::Fps59_94Ndf,
    };
    let rp188_ndf = SdiPlayoutEngine::format_sdi_rp188_timecode(&tc_ndf);
    assert_eq!(rp188_ndf, "RP188:14:30:15:22");

    let tc_df = SmpteTimecode {
        hours: 1,
        minutes: 0,
        seconds: 0,
        frames: 2,
        rate: TimecodeRate::Fps29_97Df,
    };
    let rp188_df = SdiPlayoutEngine::format_sdi_rp188_timecode(&tc_df);
    assert_eq!(rp188_df, "RP188:01:00:00;02");
}

#[test]
fn test_audio_16x16_matrix_mapping_and_driver_selection() {
    let mut config = AudioMatrixConfig::default();
    config.driver = ProAudioDriver::DirectPipeWire;
    config.sample_rate = 48000;
    config.buffer_size_frames = 128;

    let mut engine = AudioMatrixEngine::new(config);

    // Map physical input channel 7 to strip "desk-mic" channel 1 (Left) with unity gain
    engine.add_route(AudioChannelRoute {
        physical_input_channel: 7,
        target_strip_id: "desk-mic".into(),
        target_strip_channel: 1,
        gain_linear: 1.0,
        invert_phase: false,
    });

    // Map physical input channel 8 to strip "desk-mic" channel 2 (Right) with inverted phase
    engine.add_route(AudioChannelRoute {
        physical_input_channel: 8,
        target_strip_id: "desk-mic".into(),
        target_strip_channel: 2,
        gain_linear: 1.0,
        invert_phase: true,
    });

    // Construct a synthetic 16-channel interleaved buffer with 2 frames
    // Frame 0: channels 1..=16 with value = channel number
    // Frame 1: channels 1..=16 with value = channel number * 2.0
    let mut multi_channel_samples = Vec::new();
    for ch in 1..=16 {
        multi_channel_samples.push(ch as f32);
    }
    for ch in 1..=16 {
        multi_channel_samples.push((ch as f32) * 2.0);
    }

    let mut out_l = Vec::new();
    let mut out_r = Vec::new();
    engine.map_frame_to_strip(&multi_channel_samples, 16, "desk-mic", &mut out_l, &mut out_r);

    assert_eq!(out_l.len(), 2);
    assert_eq!(out_r.len(), 2);

    // Physical ch 7 -> left (7.0, 14.0)
    assert_eq!(out_l[0], 7.0);
    assert_eq!(out_l[1], 14.0);

    // Physical ch 8 -> right with phase inversion (-8.0, -16.0)
    assert_eq!(out_r[0], -8.0);
    assert_eq!(out_r[1], -16.0);
}
