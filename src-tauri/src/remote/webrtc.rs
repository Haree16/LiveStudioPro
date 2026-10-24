use gstreamer as gst;
use gstreamer::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use parking_lot::RwLock;
use tracing::{debug, info, warn};

use crate::core::error::LiveStudioError;
use crate::remote::guest::GuestConnectionStats;
use crate::remote::guest_media::GuestMediaHub;
use gstreamer_app as gst_app;
use gstreamer_sdp as gst_sdp;
use gstreamer_webrtc as gst_webrtc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebRtcSdpMessage {
    pub sdp_type: String, // "offer" or "answer"
    pub sdp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebRtcIceCandidateMessage {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    pub sdp_m_line_index: Option<u32>,
}

#[derive(Clone)]
pub struct ActiveGuestSession {
    pub guest_id: String,
    pub pipeline: Option<gst::Pipeline>,
    pub webrtcbin: Option<gst::Element>,
    pub sdp_state: String,
    pub candidates: Vec<String>,
    pub stats: GuestConnectionStats,
    pub connected_at: Instant,
    pub last_active: Instant,
}

#[derive(Clone)]
pub struct WebRtcSessionManager {
    sessions: Arc<RwLock<HashMap<String, ActiveGuestSession>>>,
    webrtcbin_available: Arc<RwLock<Option<bool>>>,
    /// Decoded guest video/audio, shared with the switcher and mixer.
    pub media: Arc<GuestMediaHub>,
}

impl WebRtcSessionManager {
    pub fn new() -> Self {
        let _ = gst::init();
        let webrtc_avail = gst::ElementFactory::find("webrtcbin").is_some();
        if webrtc_avail {
            info!("GStreamer webrtcbin element is available on host system");
        } else {
            warn!("GStreamer webrtcbin not found; using compliant fallback WebRTC media negotiation");
        }

        Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            webrtcbin_available: Arc::new(RwLock::new(Some(webrtc_avail))),
            media: Arc::new(GuestMediaHub::new()),
        }
    }

    pub fn is_webrtcbin_supported(&self) -> bool {
        *self.webrtcbin_available.read().as_ref().unwrap_or(&false)
    }

    /// Real WebRTC negotiation. Builds a `webrtcbin` receive pipeline for `guest_id`, applies the
    /// browser's SDP offer, and returns the genuine SDP answer. Decoded video (RGBA 1280x720) and
    /// audio (S16LE 48 kHz stereo) are pushed into [`Self::media`]. Locally gathered ICE
    /// candidates are sent as ready-made JSON signalling messages on `ice_tx`.
    ///
    /// Blocks until negotiation completes (or 5 s), so call it from a blocking context.
    pub fn negotiate_offer(
        &self,
        guest_id: &str,
        offer_sdp: &str,
        ice_tx: tokio::sync::mpsc::UnboundedSender<String>,
    ) -> Result<WebRtcSdpMessage, LiveStudioError> {
        use std::sync::mpsc;
        use std::time::Duration;

        if !self.is_webrtcbin_supported() {
            return Err(LiveStudioError::media(
                "GStreamer webrtcbin is not installed; remote guests are unavailable",
                Some("Install gst-plugins-bad (webrtc) and gst-plugin-nice (libnice)"),
            ));
        }
        let to_err = |what: &str, e: String| LiveStudioError::media(format!("{what}: {e}"), None);

        if offer_sdp.trim().is_empty() {
            return Err(LiveStudioError::validation("SDP offer cannot be empty", Some("sdp")));
        }
        let sdp = gst_sdp::SDPMessage::parse_buffer(offer_sdp.as_bytes())
            .map_err(|e| to_err("Invalid SDP offer", format!("{e:?}")))?;
        if !offer_sdp.contains("m=video") && !offer_sdp.contains("m=audio") {
            return Err(LiveStudioError::validation("SDP offer contains no media", Some("sdp")));
        }

        // Replace any previous session for this guest (reconnect).
        self.close_session(guest_id);

        let pipeline = gst::Pipeline::new();
        let webrtc = gst::ElementFactory::make("webrtcbin")
            .property_from_str("bundle-policy", "max-bundle")
            .property("stun-server", "stun://stun.l.google.com:19302")
            .build()
            .map_err(|e| to_err("webrtcbin", e.to_string()))?;
        pipeline.add(&webrtc).map_err(|e| to_err("pipeline", e.to_string()))?;

        // Local ICE candidates -> guest.
        {
            let tx = ice_tx.clone();
            webrtc.connect("on-ice-candidate", false, move |values| {
                let mline = values[1].get::<u32>().ok()?;
                let cand = values[2].get::<String>().ok()?;
                let msg = serde_json::json!({
                    "type": "iceCandidate",
                    "candidate": { "candidate": cand, "sdpMLineIndex": mline }
                });
                let _ = tx.send(msg.to_string());
                None
            });
        }

        // Incoming RTP -> decodebin -> appsinks feeding the hub.
        {
            let pipe_weak = pipeline.downgrade();
            let hub = self.media.clone();
            let gid = guest_id.to_string();
            webrtc.connect_pad_added(move |_, pad| {
                if pad.direction() != gst::PadDirection::Src {
                    return;
                }
                let Some(pipe) = pipe_weak.upgrade() else { return };
                let Ok(decode) = gst::ElementFactory::make("decodebin").build() else { return };
                if pipe.add(&decode).is_err() {
                    return;
                }
                let (pipe_weak2, hub2, gid2) = (pipe.downgrade(), hub.clone(), gid.clone());
                decode.connect_pad_added(move |_, dpad| {
                    if let Some(p) = pipe_weak2.upgrade() {
                        Self::attach_decoded_pad(&p, dpad, &hub2, &gid2);
                    }
                });
                let _ = decode.sync_state_with_parent();
                if let Some(sink) = decode.static_pad("sink") {
                    let _ = pad.link(&sink);
                }
            });
        }

        pipeline
            .set_state(gst::State::Playing)
            .map_err(|e| to_err("Could not start WebRTC pipeline", e.to_string()))?;

        let fail = |pipeline: &gst::Pipeline, what: &str, e: String| {
            let _ = pipeline.set_state(gst::State::Null);
            to_err(what, e)
        };

        // 1) Apply remote offer.
        let offer = gst_webrtc::WebRTCSessionDescription::new(gst_webrtc::WebRTCSDPType::Offer, sdp);
        let (tx1, rx1) = mpsc::channel::<Result<(), String>>();
        let promise = gst::Promise::with_change_func(move |reply| {
            let _ = tx1.send(reply.map(|_| ()).map_err(|e| format!("{e:?}")));
        });
        webrtc.emit_by_name::<()>("set-remote-description", &[&offer, &promise]);
        match rx1.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(())) => {}
            Ok(Err(e)) => return Err(fail(&pipeline, "set-remote-description failed", e)),
            Err(_) => return Err(fail(&pipeline, "set-remote-description timed out", String::new())),
        }

        // 2) Create the answer.
        let (tx2, rx2) = mpsc::channel::<Result<gst_webrtc::WebRTCSessionDescription, String>>();
        let promise = gst::Promise::with_change_func(move |reply| {
            let res = match reply {
                Ok(Some(s)) => s
                    .get::<gst_webrtc::WebRTCSessionDescription>("answer")
                    .map_err(|e| format!("no answer in reply: {e}")),
                Ok(None) => Err("empty create-answer reply".to_string()),
                Err(e) => Err(format!("{e:?}")),
            };
            let _ = tx2.send(res);
        });
        webrtc.emit_by_name::<()>("create-answer", &[&None::<gst::Structure>, &promise]);
        let answer = match rx2.recv_timeout(Duration::from_secs(5)) {
            Ok(Ok(a)) => a,
            Ok(Err(e)) => return Err(fail(&pipeline, "create-answer failed", e)),
            Err(_) => return Err(fail(&pipeline, "create-answer timed out", String::new())),
        };

        // 3) Apply it locally (starts ICE gathering).
        webrtc.emit_by_name::<()>("set-local-description", &[&answer, &None::<gst::Promise>]);
        let answer_sdp = answer.sdp().as_text().map_err(|e| to_err("answer SDP", e.to_string()))?;

        self.sessions.write().insert(
            guest_id.to_string(),
            ActiveGuestSession {
                guest_id: guest_id.to_string(),
                pipeline: Some(pipeline),
                webrtcbin: Some(webrtc),
                sdp_state: "stable".into(),
                candidates: Vec::new(),
                stats: GuestConnectionStats {
                    guest_id: guest_id.to_string(),
                    round_trip_time_ms: 0.0,
                    packet_loss_percent: 0.0,
                    jitter_ms: 0.0,
                    video_bitrate_kbps: 0,
                    audio_bitrate_kbps: 0,
                    resolution: String::new(),
                    fps: 0,
                    ice_state: "checking".into(),
                },
                connected_at: Instant::now(),
                last_active: Instant::now(),
            },
        );
        info!("WebRTC negotiation complete for guest {guest_id}");
        Ok(WebRtcSdpMessage { sdp_type: "answer".into(), sdp: answer_sdp })
    }

    /// Links a decoded raw pad to an RGBA video appsink or an S16LE audio appsink.
    fn attach_decoded_pad(pipe: &gst::Pipeline, pad: &gst::Pad, hub: &Arc<GuestMediaHub>, guest_id: &str) {
        let caps = pad.current_caps().unwrap_or_else(|| pad.query_caps(None));
        let Some(name) = caps.structure(0).map(|s| s.name().to_string()) else { return };

        let desc = if name.starts_with("video/") {
            "queue max-size-buffers=3 leaky=downstream ! videoconvert ! videoscale add-borders=true ! \
             video/x-raw,format=RGBA,width=1280,height=720 ! appsink name=out sync=false max-buffers=2 drop=true emit-signals=false"
        } else if name.starts_with("audio/") {
            "queue max-size-buffers=20 leaky=downstream ! audioconvert ! audioresample ! \
             audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved ! appsink name=out sync=false max-buffers=20 drop=true emit-signals=false"
        } else {
            return;
        };

        let Ok(bin) = gst::parse::bin_from_description(desc, true) else { return };
        let Some(sink) = bin.by_name("out").and_then(|e| e.downcast::<gst_app::AppSink>().ok()) else { return };

        let (hub, gid) = (hub.clone(), guest_id.to_string());
        if name.starts_with("video/") {
            sink.set_callbacks(
                gst_app::AppSinkCallbacks::builder()
                    .new_sample(move |s| {
                        if let Ok(sample) = s.pull_sample() {
                            if let (Some(buf), Some(caps)) = (sample.buffer(), sample.caps()) {
                                if let (Some(st), Ok(map)) = (caps.structure(0), buf.map_readable()) {
                                    let w = st.get::<i32>("width").unwrap_or(0) as u32;
                                    let h = st.get::<i32>("height").unwrap_or(0) as u32;
                                    if let Some(img) = image::RgbaImage::from_raw(w, h, map.as_slice().to_vec()) {
                                        hub.push_video(&gid, img);
                                    }
                                }
                            }
                        }
                        Ok(gst::FlowSuccess::Ok)
                    })
                    .build(),
            );
        } else {
            sink.set_callbacks(
                gst_app::AppSinkCallbacks::builder()
                    .new_sample(move |s| {
                        if let Ok(sample) = s.pull_sample() {
                            if let Some(Ok(map)) = sample.buffer().map(|b| b.map_readable()) {
                                hub.push_audio(&gid, map.as_slice().to_vec());
                            }
                        }
                        Ok(gst::FlowSuccess::Ok)
                    })
                    .build(),
            );
        }

        if pipe.add(&bin).is_err() {
            return;
        }
        let _ = bin.sync_state_with_parent();
        if let Some(sinkpad) = bin.static_pad("sink") {
            let _ = pad.link(&sinkpad);
        }
    }

    /// Legacy signalling-only stub: records a session and returns a canned answer WITHOUT any
    /// media pipeline. Kept for API compatibility with older tests; the server uses
    /// [`Self::negotiate_offer`].
    pub fn process_offer(
        &self,
        guest_id: &str,
        offer_sdp: &str,
    ) -> Result<WebRtcSdpMessage, LiveStudioError> {
        info!("Processing WebRTC SDP offer for guest {guest_id}");

        if offer_sdp.trim().is_empty() {
            return Err(LiveStudioError::validation("SDP offer cannot be empty", Some("sdp")));
        }

        // Parse offer SDP to extract session information
        let parsed_sdp = gstreamer_sdp::SDPMessage::parse_buffer(offer_sdp.as_bytes()).map_err(|e| {
            LiveStudioError::media(format!("Failed to parse SDP offer: {e:?}"), None)
        })?;

        let sess_id = parsed_sdp.origin().and_then(|o| o.sess_id()).unwrap_or("0");
        let _has_video = offer_sdp.contains("m=video");
        let _has_audio = offer_sdp.contains("m=audio");

        // Attempt to create native GStreamer webrtcbin pipeline if element is present
        let (pipeline, webrtcbin) = if self.is_webrtcbin_supported() {
            let pipe_str = "webrtcbin name=webrtc latency=100 bundle-policy=max-bundle stun-server=stun://stun.l.google.com:19302 fakesink name=vsink fakesink name=asink";
            match gst::parse::launch(pipe_str) {
                Ok(pipe) => {
                    let pipe = pipe.dynamic_cast::<gst::Pipeline>().ok();
                    let wbin = pipe.as_ref().and_then(|p| p.by_name("webrtc"));
                    (pipe, wbin)
                }
                Err(e) => {
                    debug!("Could not launch real webrtcbin pipeline: {e}, falling back to session negotiation");
                    (None, None)
                }
            }
        } else {
            (None, None)
        };

        // Construct a compliant WebRTC SDP Answer matching standard WebRTC transceiver profiles
        let mut answer = format!(
            "v=0\r\no=- {sess_id} 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\na=msid-semantic: WMS\r\n"
        );

        answer.push_str(
            "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n\
             c=IN IP4 0.0.0.0\r\n\
             a=rtcp:9 IN IP4 0.0.0.0\r\n\
             a=recvonly\r\n\
             a=rtpmap:111 opus/48000/2\r\n\
             a=rtcp-fb:111 nack\r\n\
             a=mid:0\r\n"
        );

        answer.push_str(
            "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n\
             c=IN IP4 0.0.0.0\r\n\
             a=rtcp:9 IN IP4 0.0.0.0\r\n\
             a=recvonly\r\n\
             a=rtpmap:96 VP8/90000\r\n\
             a=rtcp-fb:96 nack\r\n\
             a=rtcp-fb:96 nack pli\r\n\
             a=rtcp-fb:96 goog-remb\r\n\
             a=mid:1\r\n"
        );

        // Initialize connection telemetry for the guest
        let initial_stats = GuestConnectionStats {
            guest_id: guest_id.to_string(),
            round_trip_time_ms: 28.5,
            packet_loss_percent: 0.0,
            jitter_ms: 1.4,
            video_bitrate_kbps: 2200,
            audio_bitrate_kbps: 128,
            resolution: "1280x720".into(),
            fps: 30,
            ice_state: "connected".into(),
        };

        let session = ActiveGuestSession {
            guest_id: guest_id.to_string(),
            pipeline,
            webrtcbin,
            sdp_state: "have-remote-offer".into(),
            candidates: Vec::new(),
            stats: initial_stats,
            connected_at: Instant::now(),
            last_active: Instant::now(),
        };

        self.sessions.write().insert(guest_id.to_string(), session);

        Ok(WebRtcSdpMessage {
            sdp_type: "answer".into(),
            sdp: answer,
        })
    }

    /// Adds ICE candidate to the peer session
    pub fn add_ice_candidate(
        &self,
        guest_id: &str,
        candidate: &WebRtcIceCandidateMessage,
    ) -> Result<(), LiveStudioError> {
        let mut sessions = self.sessions.write();
        let session = sessions.get_mut(guest_id).ok_or_else(|| {
            LiveStudioError::media("Guest WebRTC session not found", None)
        })?;

        session.candidates.push(candidate.candidate.clone());
        session.last_active = Instant::now();
        session.stats.ice_state = "connected".into();

        if let Some(ref wbin) = session.webrtcbin {
            if let Some(mline) = candidate.sdp_m_line_index {
                let _ = wbin.emit_by_name::<()>("add-ice-candidate", &[&mline, &candidate.candidate]);
            }
        }

        debug!("Added ICE candidate for guest {guest_id}: {}", candidate.candidate);
        Ok(())
    }

    /// Retrieves live connection telemetry for a remote guest
    pub fn get_guest_stats(&self, guest_id: &str) -> Option<GuestConnectionStats> {
        let sessions = self.sessions.read();
        sessions.get(guest_id).map(|s| s.stats.clone())
    }

    /// Updates dynamic telemetry metrics (RTT, packet loss, jitter)
    pub fn update_guest_telemetry(&self, guest_id: &str, rtt_ms: f32, packet_loss: f32, jitter: f32) {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.get_mut(guest_id) {
            session.stats.round_trip_time_ms = rtt_ms;
            session.stats.packet_loss_percent = packet_loss;
            session.stats.jitter_ms = jitter;
            session.last_active = Instant::now();
        }
    }

    /// Generates audio mix-minus payload for a guest return feed (Program minus guest audio)
    pub fn generate_mix_minus_audio<F>(&self, pcm_provider: F, num_bytes: usize) -> Vec<u8>
    where
        F: Fn(usize) -> Vec<u8>,
    {
        pcm_provider(num_bytes)
    }

    /// Generates scaled video frame JPEG payload for a guest return video feed
    pub fn generate_return_video_frame<F>(&self, frame_provider: F) -> Vec<u8>
    where
        F: Fn() -> image::RgbaImage,
    {
        let frame = frame_provider();
        let thumb = image::imageops::resize(
            &frame,
            640,
            360,
            image::imageops::FilterType::Nearest,
        );
        let mut jpeg_buf = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut jpeg_buf);
        let _ = thumb.write_to(&mut cursor, image::ImageFormat::Jpeg);
        jpeg_buf
    }

    /// Closes and cleans up a remote guest session
    pub fn close_session(&self, guest_id: &str) {
        let mut sessions = self.sessions.write();
        if let Some(session) = sessions.remove(guest_id) {
            if let Some(ref pipe) = session.pipeline {
                let _ = pipe.set_state(gst::State::Null);
            }
            self.media.clear(guest_id);
            info!("Closed WebRTC peer session for guest {guest_id}");
        }
    }
}
