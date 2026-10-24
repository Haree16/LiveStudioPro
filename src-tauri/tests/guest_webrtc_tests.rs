//! End-to-end check of the remote-guest receive path: a second in-process `webrtcbin` plays the
//! role of the guest's browser (VP8 video + Opus audio), negotiates over loopback with
//! `WebRtcSessionManager::negotiate_offer`, and the decoded media must show up in the hub.
use std::sync::mpsc;
use std::time::{Duration, Instant};

use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_sdp as gst_sdp;
use gstreamer_webrtc as gst_webrtc;
use livestudio_lib::remote::webrtc::{WebRtcIceCandidateMessage, WebRtcSessionManager};

fn have(elements: &[&str]) -> bool {
    elements.iter().all(|e| gst::ElementFactory::find(e).is_some())
}

#[test]
fn test_guest_video_and_audio_reach_the_hub_over_real_webrtc() {
    gst::init().unwrap();
    if !have(&["webrtcbin", "vp8enc", "vp8dec", "rtpvp8pay", "opusenc", "opusdec", "rtpopuspay", "nicesrc", "decodebin"]) {
        eprintln!("SKIP: WebRTC/VP8/Opus GStreamer plugins not installed");
        return;
    }

    let mgr = WebRtcSessionManager::new();
    let guest = "alice";

    // --- Fake browser -------------------------------------------------------------------
    let browser = gst::parse::launch(
        "webrtcbin name=send bundle-policy=max-bundle \
         videotestsrc is-live=true pattern=ball ! video/x-raw,width=640,height=360,framerate=30/1 ! videoconvert ! \
           vp8enc deadline=1 keyframe-max-dist=15 ! rtpvp8pay pt=96 ! \
           application/x-rtp,media=video,encoding-name=VP8,payload=96 ! send. \
         audiotestsrc is-live=true wave=sine ! audioconvert ! audioresample ! opusenc ! rtpopuspay pt=111 ! \
           application/x-rtp,media=audio,encoding-name=OPUS,payload=111 ! send.",
    )
    .expect("browser pipeline")
    .downcast::<gst::Pipeline>()
    .unwrap();
    let send = browser.by_name("send").unwrap();

    let (cand_tx, cand_rx) = mpsc::channel::<(u32, String)>();
    send.connect("on-ice-candidate", false, move |v| {
        let _ = cand_tx.send((v[1].get::<u32>().unwrap(), v[2].get::<String>().unwrap()));
        None
    });
    let (neg_tx, neg_rx) = mpsc::channel::<()>();
    send.connect("on-negotiation-needed", false, move |_| {
        let _ = neg_tx.send(());
        None
    });
    browser.set_state(gst::State::Playing).unwrap();
    neg_rx.recv_timeout(Duration::from_secs(5)).expect("negotiation-needed");

    let (offer_tx, offer_rx) = mpsc::channel();
    let p = gst::Promise::with_change_func(move |reply| {
        let offer = reply.unwrap().unwrap().get::<gst_webrtc::WebRTCSessionDescription>("offer").unwrap();
        let _ = offer_tx.send(offer);
    });
    send.emit_by_name::<()>("create-offer", &[&None::<gst::Structure>, &p]);
    let offer = offer_rx.recv_timeout(Duration::from_secs(5)).expect("offer");
    send.emit_by_name::<()>("set-local-description", &[&offer, &None::<gst::Promise>]);
    let offer_text = offer.sdp().as_text().unwrap();
    assert!(offer_text.contains("m=video") && offer_text.contains("m=audio"));

    // --- Server side --------------------------------------------------------------------
    let (ice_tx, mut ice_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    let answer = mgr.negotiate_offer(guest, &offer_text, ice_tx).expect("negotiate_offer");
    assert_eq!(answer.sdp_type, "answer");
    assert!(answer.sdp.contains("m=video") && answer.sdp.contains("m=audio"));
    assert!(answer.sdp.contains("a=recvonly"), "server must only receive: {}", answer.sdp);

    let answer_desc = gst_webrtc::WebRTCSessionDescription::new(
        gst_webrtc::WebRTCSDPType::Answer,
        gst_sdp::SDPMessage::parse_buffer(answer.sdp.as_bytes()).unwrap(),
    );
    send.emit_by_name::<()>("set-remote-description", &[&answer_desc, &None::<gst::Promise>]);

    // Server ICE -> browser (forward on a thread).
    let send_for_ice = send.clone();
    std::thread::spawn(move || {
        while let Some(msg) = ice_rx.blocking_recv() {
            let v: serde_json::Value = serde_json::from_str(&msg).unwrap();
            let c = &v["candidate"];
            send_for_ice.emit_by_name::<()>(
                "add-ice-candidate",
                &[&(c["sdpMLineIndex"].as_u64().unwrap() as u32), &c["candidate"].as_str().unwrap()],
            );
        }
    });

    // Browser ICE -> server (poll while waiting for media).
    let deadline = Instant::now() + Duration::from_secs(20);
    let (mut got_video, mut got_audio) = (false, false);
    while Instant::now() < deadline && !(got_video && got_audio) {
        while let Ok((mline, cand)) = cand_rx.try_recv() {
            let _ = mgr.add_ice_candidate(
                guest,
                &WebRtcIceCandidateMessage { candidate: cand, sdp_mid: None, sdp_m_line_index: Some(mline) },
            );
        }
        got_video = mgr.media.has_video(guest);
        got_audio = got_audio || mgr.media.pull_audio(guest).map(|c| !c.is_empty()).unwrap_or(false);
        std::thread::sleep(Duration::from_millis(50));
    }

    let frame = mgr.media.latest_video(guest);
    mgr.close_session(guest);
    let _ = browser.set_state(gst::State::Null);

    assert!(got_video, "no decoded guest video arrived");
    assert!(got_audio, "no decoded guest audio arrived");
    let frame = frame.unwrap();
    assert_eq!(frame.dimensions(), (1280, 720));
    assert!(frame.pixels().any(|p| p[0] > 20 || p[1] > 20 || p[2] > 20), "frame is entirely black");
    assert!(!mgr.media.has_video(guest), "close_session must clear guest media");
}

#[test]
fn test_negotiate_offer_rejects_garbage() {
    let mgr = WebRtcSessionManager::new();
    let (tx, _rx) = tokio::sync::mpsc::unbounded_channel::<String>();
    assert!(mgr.negotiate_offer("g", "", tx.clone()).is_err());
    assert!(mgr.negotiate_offer("g", "v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n", tx).is_err(), "no media sections");
}

mod controller_integration {
    use image::{Rgba, RgbaImage};
    use livestudio_lib::core::controller::ProductionController;
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    #[test]
    fn test_first_guest_frame_creates_input_and_media_reaches_switcher_and_mixer() {
        let c = Arc::new(ProductionController::new().unwrap());
        c.spawn_guest_media_bridge();
        let hub = c.remote_engine.webrtc_mgr.media.clone();

        // First frame announces the guest -> input appears (created off-thread).
        hub.push_video("g1", RgbaImage::from_pixel(1280, 720, Rgba([200, 10, 10, 255])));
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline && !c.get_current_project().inputs.iter().any(|i| i.id == "guest-g1") {
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(c.get_current_project().inputs.iter().any(|i| i.id == "guest-g1"), "guest input not created");

        // Switcher sees the guest's picture.
        let f = c.resolve_source_frame("guest-g1").expect("guest frame");
        assert_eq!(f.get_pixel(5, 5).0, [200, 10, 10, 255]);
        c.set_program(Some("guest-g1".into())).unwrap();

        // Mixer sums the guest's audio (stereo S16LE, constant 1000).
        let pcm: Vec<u8> = (0..960).flat_map(|_| 1000i16.to_le_bytes()).collect();
        hub.push_audio("g1", pcm);
        let out = c.make_audio_provider()(1920);
        let nonzero = out.chunks_exact(2).any(|b| i16::from_le_bytes([b[0], b[1]]) != 0);
        assert!(nonzero, "guest audio missing from program mix");

        // Idempotent.
        c.ensure_guest_input("g1").unwrap();
        assert_eq!(c.get_current_project().inputs.iter().filter(|i| i.id == "guest-g1").count(), 1);
    }
}
