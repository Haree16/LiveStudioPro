use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSink;
use image::RgbaImage;
use parking_lot::RwLock;
use tracing::{error, info, warn};

use crate::core::error::LiveStudioError;
use crate::project::model::{CaptureDeviceConfig, InputState, InputType, PlaybackState, RtspConfig};
use crate::switcher::compositor::SceneCompositor;

pub struct MediaInputInstance {
    pub id: String,
    pub generation: u64,
    pub input_type: InputType,
    pub source_path_or_id: String,
    pipeline: gst::Pipeline,
    _appsink: Option<AppSink>,
    _audio_appsink: Option<AppSink>,
    latest_rgba_frame: Arc<RwLock<Option<RgbaImage>>>,
    latest_audio_chunk: Arc<RwLock<Option<Vec<u8>>>>,
    pub frame_counter: Arc<AtomicU64>,
    cached_data_url: Arc<RwLock<Option<(u64, String)>>>,
    state: Arc<RwLock<InputState>>,
    is_looping: AtomicBool,
    volume: RwLock<f32>,
    muted: AtomicBool,
    last_position_ms: AtomicU64,
    duration_ms: AtomicU64,
    playback_rate: RwLock<f64>,
    error_message: Arc<RwLock<Option<String>>>,
    bus_watch_guard: RwLock<Option<gst::bus::BusWatchGuard>>,
}

impl MediaInputInstance {
    pub fn new(
        id: &str,
        generation: u64,
        input_type: InputType,
        source: &str,
        device_config: Option<&CaptureDeviceConfig>,
        rtsp_config: Option<&RtspConfig>,
    ) -> Result<Arc<Self>, LiveStudioError> {
        let _ = gst::init();

        let latest_rgba_frame = Arc::new(RwLock::new(None));
        let latest_audio_chunk = Arc::new(RwLock::new(None));
        let frame_counter = Arc::new(AtomicU64::new(0));
        let cached_data_url = Arc::new(RwLock::new(None));
        let state = Arc::new(RwLock::new(InputState::Opening));
        let error_message = Arc::new(RwLock::new(None));

        let (pipeline_str, has_video) = match input_type {
            InputType::MediaFile => {
                let abs_path = std::fs::canonicalize(Path::new(source))
                    .unwrap_or_else(|_| Path::new(source).to_path_buf());
                let uri = format!("file://{}", abs_path.to_string_lossy());
                let has_audio = crate::media::discoverer::MediaDiscoverer::inspect_file(&abs_path)
                    .map(|meta| meta.audio_channels.unwrap_or(0) > 0)
                    .unwrap_or(false);

                let pipe = if has_audio {
                    format!(
                        "uridecodebin uri=\"{uri}\" name=d \
                         d. ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=false sync=true \
                         d. ! queue name=delay max-size-buffers=0 max-size-bytes=0 max-size-time=3000000000 ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false"
                    )
                } else {
                    format!(
                        "uridecodebin uri=\"{uri}\" ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=false sync=true"
                    )
                };

                (pipe, true)
            }
            InputType::AudioFile => {
                let abs_path = std::fs::canonicalize(Path::new(source))
                    .unwrap_or_else(|_| Path::new(source).to_path_buf());
                let uri = format!("file://{}", abs_path.to_string_lossy());
                (
                    format!(
                        "uridecodebin uri=\"{uri}\" ! queue name=delay max-size-buffers=0 max-size-bytes=0 max-size-time=3000000000 ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false"
                    ),
                    false,
                )
            }
            InputType::Image => {
                let abs_path = std::fs::canonicalize(Path::new(source))
                    .unwrap_or_else(|_| Path::new(source).to_path_buf());
                if let Ok(dyn_img) = image::open(&abs_path) {
                    let rgba = dyn_img.to_rgba8();
                    let (w, h) = rgba.dimensions();
                    let final_rgba = if w > 1280 || h > 720 {
                        let scale = (1280.0 / w as f32).min(720.0 / h as f32);
                        let nw = ((w as f32 * scale) as u32).max(1);
                        let nh = ((h as f32 * scale) as u32).max(1);
                        image::imageops::resize(&rgba, nw, nh, image::imageops::FilterType::Triangle)
                    } else {
                        rgba
                    };
                    *latest_rgba_frame.write() = Some(final_rgba);
                    frame_counter.store(1, Ordering::Relaxed);
                }
                (
                    "videotestsrc pattern=black is-live=true ! video/x-raw,framerate=1/1 ! fakesink sync=true".to_string(),
                    false,
                )
            }
            InputType::VideoCapture => {
                #[cfg(target_os = "linux")]
                {
                    let dev = if source.starts_with("/dev/video") {
                        source
                    } else {
                        "/dev/video0"
                    };

                    let (w, h) = if let Some(cfg) = device_config {
                        (cfg.width.unwrap_or(1280), cfg.height.unwrap_or(720))
                    } else {
                        (1280, 720)
                    };

                    (
                        format!(
                            "v4l2src device=\"{dev}\" io-mode=mmap ! queue max-size-buffers=3 leaky=downstream ! decodebin ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width={w},height={h} ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false"
                        ),
                        true,
                    )
                }
                #[cfg(target_os = "windows")]
                {
                    let (w, h) = if let Some(cfg) = device_config {
                        (cfg.width.unwrap_or(1280), cfg.height.unwrap_or(720))
                    } else {
                        (1280, 720)
                    };
                    (
                        format!(
                            "mfvideosrc device-path=\"{source}\" ! queue max-size-buffers=3 leaky=downstream ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width={w},height={h} ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false"
                        ),
                        true,
                    )
                }
                #[cfg(not(any(target_os = "linux", target_os = "windows")))]
                {
                    (
                        "videotestsrc is-live=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".into(),
                        true,
                    )
                }
            }
            InputType::AudioCapture => {
                #[cfg(target_os = "linux")]
                let src_elem = if !source.is_empty() && source != "default" {
                    format!("pulsesrc device=\"{source}\"")
                } else {
                    "autoaudiosrc".to_string()
                };
                #[cfg(target_os = "windows")]
                let src_elem = if !source.is_empty() && source != "default" {
                    format!("wasapisrc device=\"{source}\"")
                } else {
                    "wasapisrc".to_string()
                };
                #[cfg(not(any(target_os = "linux", target_os = "windows")))]
                let src_elem = "autoaudiosrc".to_string();

                (
                    format!(
                        "{src_elem} ! queue name=delay max-size-buffers=5 ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false"
                    ),
                    false,
                )
            }
            InputType::RtspStream => {
                let latency = rtsp_config.map(|c| c.latency_ms).unwrap_or(200);
                let transport = rtsp_config.map(|c| c.transport.as_str()).unwrap_or("tcp");
                (
                    format!(
                        "rtspsrc location=\"{source}\" latency={latency} protocols={transport} ! decodebin ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false"
                    ),
                    true,
                )
            }
            InputType::ColorSource => {
                let hex = source.trim().trim_start_matches('#').trim_start_matches("0x");
                let color_val = u32::from_str_radix(hex, 16).unwrap_or(0x003366);
                let argb = if color_val <= 0xFFFFFF {
                    0xFF000000 | color_val
                } else {
                    color_val
                };
                (
                    format!(
                        "videotestsrc pattern=solid-color foreground-color={argb} ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=640,height=360 ! videobalance name=bal ! appsink name=vsink max-buffers=1 drop=true sync=false"
                    ),
                    true,
                )
            }
            InputType::TestPattern => {
                let pattern_name = match source.trim().to_lowercase().as_str() {
                    "snow" => "snow",
                    "black" => "black",
                    "white" => "white",
                    "red" => "red",
                    "green" => "green",
                    "blue" => "blue",
                    "checkers-1" | "checkers" => "checkers-1",
                    "checkers-2" => "checkers-2",
                    "checkers-4" => "checkers-4",
                    "checkers-8" => "checkers-8",
                    "circular" => "circular",
                    "blink" => "blink",
                    "smpte75" => "smpte75",
                    "zone-plate" => "zone-plate",
                    "gamut" => "gamut",
                    "chroma-zone-plate" => "chroma-zone-plate",
                    "solid-color" => "solid-color",
                    "ball" => "ball",
                    "smpte100" => "smpte100",
                    "bar" => "bar",
                    "pinwheel" => "pinwheel",
                    "spokes" => "spokes",
                    "gradient" => "gradient",
                    "colors" => "colors",
                    "smpte-rp-219" => "smpte-rp-219",
                    _ => "smpte",
                };
                (
                    format!(
                        "videotestsrc pattern={pattern_name} ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=640,height=360 ! videobalance name=bal ! appsink name=vsink max-buffers=1 drop=true sync=false"
                    ),
                    true,
                )
            }
            InputType::ScreenCapture => {
                #[cfg(target_os = "linux")]
                {
                    let has_x11 = std::env::var("DISPLAY").map(|d| !d.trim().is_empty()).unwrap_or(false);
                    let target = source;
                    let pipeline: String = if target == "portal" || target.starts_with("pipewire") {
                        "pipewiresrc do-timestamp=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string()
                    } else if target.starts_with("xid:") {
                        let xid = target.trim_start_matches("xid:").trim();
                        format!("ximagesrc xid={xid} use-damage=false do-timestamp=true ! video/x-raw,framerate=30/1 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false")
                    } else if target.starts_with("window:") {
                        let name = target.trim_start_matches("window:").trim();
                        format!("ximagesrc xname=\"{name}\" use-damage=false do-timestamp=true ! video/x-raw,framerate=30/1 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false")
                    } else if has_x11 {
                        "ximagesrc use-damage=false do-timestamp=true ! video/x-raw,framerate=30/1 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string()
                    } else {
                        "pipewiresrc do-timestamp=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string()
                    };
                    (pipeline, true)
                }
                #[cfg(target_os = "windows")]
                {
                    let target = source;
                    let pipeline: String = if target.starts_with("window:") {
                        let name = target.trim_start_matches("window:").trim();
                        format!("gdiscreencapsrc window-name=\"{name}\" ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false")
                    } else {
                        "gdiscreencapsrc ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string()
                    };
                    (pipeline, true)
                }
                #[cfg(not(any(target_os = "linux", target_os = "windows")))]
                {
                    (
                        "videotestsrc pattern=smpte ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string(),
                        true,
                    )
                }
            }
            // Remote guest picture comes from the WebRTC hub (see ProductionController); this
            // pipeline only supplies black until the guest's first frame arrives.
            InputType::RemoteGuest => (
                "videotestsrc pattern=black is-live=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string(),
                true,
            ),
            InputType::VirtualInput => (
                "videotestsrc pattern=ball is-live=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false".to_string(),
                true,
            ),
            InputType::SrtStream => {
                let uri = if source.starts_with("srt://") {
                    source.to_string()
                } else {
                    format!("srt://{source}")
                };
                (
                    format!(
                        "srtsrc uri=\"{uri}\" latency=200 ! tsdemux name=d \
                         d. ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=3000000000 ! decodebin ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=true sync=false \
                         d. ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=3000000000 ! decodebin ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false"
                    ),
                    true,
                )
            }
            InputType::SystemAudio => {
                #[cfg(target_os = "linux")]
                {
                    (
                        "pipewiresrc do-timestamp=true ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false".to_string(),
                        false,
                    )
                }
                #[cfg(target_os = "windows")]
                {
                    (
                        "wasapisrc loopback=true ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false".to_string(),
                        false,
                    )
                }
                #[cfg(not(any(target_os = "linux", target_os = "windows")))]
                {
                    (
                        "audiotestsrc is-live=true volume=0.0 wave=silence ! audioconvert ! audioresample ! appsink name=asink caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" max-buffers=5 drop=true sync=false".to_string(),
                        false,
                    )
                }
            }
            InputType::HtmlBrowser => (
                "videotestsrc pattern=colors is-live=true ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=640,height=360 ! videobalance name=bal ! appsink name=vsink max-buffers=1 drop=true sync=false".to_string(),
                true,
            ),
        };

        info!("Creating media pipeline for input '{id}': {pipeline_str}");

        let element = gst::parse::launch(&pipeline_str).map_err(|e| {
            let err_str = format!("Failed to parse GStreamer pipeline for input {id}: {e}");
            error!("{err_str}");
            *error_message.write() = Some(err_str.clone());
            *state.write() = InputState::Error;
            LiveStudioError::media(err_str, Some("Verify that required plugins are installed."))
        })?;

        let pipeline = element.dynamic_cast::<gst::Pipeline>().map_err(|_| {
            LiveStudioError::media("Pipeline cast failed", None)
        })?;

        let appsink = if has_video {
            if let Some(sink_elem) = pipeline.by_name("vsink") {
                if let Ok(appsink) = sink_elem.dynamic_cast::<AppSink>() {
                    let frame_store = Arc::clone(&latest_rgba_frame);
                    let frame_seq_store = Arc::clone(&frame_counter);
                    let input_id_str = id.to_string();
                    let last_monitor_time = Arc::new(parking_lot::RwLock::new(std::time::Instant::now()));
                    let monitor_frame_count = Arc::new(AtomicU64::new(0));
                    let last_monitor_pts = Arc::new(AtomicU64::new(0));

                    let callbacks = gstreamer_app::AppSinkCallbacks::builder()
                        .new_sample(move |sink| {
                            if let Ok(sample) = sink.pull_sample() {
                                if let Some(buffer) = sample.buffer() {
                                    let pts_ns = buffer.pts().map(|p| p.nseconds()).unwrap_or(0);
                                    let count = monitor_frame_count.fetch_add(1, Ordering::Relaxed) + 1;
                                    if count % 30 == 0 {
                                        let mut last_t = last_monitor_time.write();
                                        let elapsed = last_t.elapsed();
                                        if elapsed.as_millis() >= 1000 {
                                            let fps = (count as f64) / elapsed.as_secs_f64();
                                            let prev_pts = last_monitor_pts.swap(pts_ns, Ordering::Relaxed);
                                            let pts_delta_s = if pts_ns > prev_pts && prev_pts > 0 {
                                                (pts_ns - prev_pts) as f64 / 1_000_000_000.0
                                            } else {
                                                0.0
                                            };
                                            let speed = if pts_delta_s > 0.0 { pts_delta_s / elapsed.as_secs_f64() } else { 1.0 };
                                            info!(
                                                "[Playback Monitor] Input '{}': FPS={:.1} | Pos={:.2}s | Speed={:.2}x",
                                                input_id_str, fps, pts_ns as f64 / 1_000_000_000.0, speed
                                            );
                                            monitor_frame_count.store(0, Ordering::Relaxed);
                                            *last_t = std::time::Instant::now();
                                        }
                                    }
                                    if let Ok(map) = buffer.map_readable() {
                                        if let Some(caps) = sample.caps() {
                                            if let Some(st) = caps.structure(0) {
                                                let width = st.get::<i32>("width").unwrap_or(1280) as u32;
                                                let height = st.get::<i32>("height").unwrap_or(720) as u32;
                                                let row_bytes = (width * 4) as usize;
                                                let expected = (width * height * 4) as usize;
                                                let slice = map.as_slice();

                                                if slice.len() == expected {
                                                    if let Some(img) = RgbaImage::from_raw(width, height, slice.to_vec()) {
                                                        *frame_store.write() = Some(img);
                                                        frame_seq_store.fetch_add(1, Ordering::Relaxed);
                                                    }
                                                } else if slice.len() > expected && height > 0 {
                                                    let stride = slice.len() / (height as usize);
                                                    if stride >= row_bytes {
                                                        let mut tight = Vec::with_capacity(expected);
                                                        for y in 0..(height as usize) {
                                                            let start = y * stride;
                                                            let end = start + row_bytes;
                                                            if end <= slice.len() {
                                                                tight.extend_from_slice(&slice[start..end]);
                                                            }
                                                        }
                                                        if tight.len() == expected {
                                                            if let Some(img) = RgbaImage::from_raw(width, height, tight) {
                                                                *frame_store.write() = Some(img);
                                                                frame_seq_store.fetch_add(1, Ordering::Relaxed);
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Ok(gst::FlowSuccess::Ok)
                        })
                        .build();

                    appsink.set_callbacks(callbacks);
                    Some(appsink)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        };

        let audio_appsink = if let Some(sink_elem) = pipeline.by_name("asink") {
            if let Ok(asink) = sink_elem.dynamic_cast::<AppSink>() {
                let audio_store = Arc::clone(&latest_audio_chunk);
                let a_callbacks = gstreamer_app::AppSinkCallbacks::builder()
                    .new_sample(move |sink| {
                        if let Ok(sample) = sink.pull_sample() {
                            if let Some(buffer) = sample.buffer() {
                                if let Ok(map) = buffer.map_readable() {
                                    *audio_store.write() = Some(map.as_slice().to_vec());
                                }
                            }
                        }
                        Ok(gst::FlowSuccess::Ok)
                    })
                    .build();
                asink.set_callbacks(a_callbacks);
                Some(asink)
            } else {
                None
            }
        } else {
            None
        };

        let instance = Arc::new(Self {
            id: id.to_string(),
            generation,
            input_type,
            source_path_or_id: source.to_string(),
            pipeline,
            _appsink: appsink,
            _audio_appsink: audio_appsink,
            latest_rgba_frame,
            latest_audio_chunk,
            frame_counter,
            cached_data_url,
            state,
            is_looping: AtomicBool::new(true),
            volume: RwLock::new(1.0),
            muted: AtomicBool::new(false),
            last_position_ms: AtomicU64::new(0),
            duration_ms: AtomicU64::new(0),
            playback_rate: RwLock::new(1.0),
            error_message,
            bus_watch_guard: RwLock::new(None),
        });

        // Set up bus watch for async error and EOS handling
        let bus = instance.pipeline.bus().unwrap();
        let state_weak = Arc::downgrade(&instance.state);
        let loop_flag = Arc::clone(&instance);
        let err_store = Arc::downgrade(&instance.error_message);

        let watch = bus
            .add_watch(move |_, msg| {
                match msg.view() {
                    gst::MessageView::Eos(..) => {
                        info!("Input reached End-Of-Stream");
                        if loop_flag.is_looping.load(Ordering::SeqCst) {
                            let _ = loop_flag.seek(0);
                            let _ = loop_flag.play();
                        } else {
                            if let Some(st) = state_weak.upgrade() {
                                *st.write() = InputState::Ready;
                            }
                        }
                    }
                    gst::MessageView::Error(err) => {
                        let msg_text = format!("Pipeline error: {} (debug: {:?})", err.error(), err.debug());
                        error!("{msg_text}");
                        if let Some(err_ref) = err_store.upgrade() {
                            *err_ref.write() = Some(msg_text);
                        }
                        if let Some(st) = state_weak.upgrade() {
                            *st.write() = InputState::Error;
                        }
                    }
                    gst::MessageView::StateChanged(s) => {
                        if s.src().map(|src| src == loop_flag.pipeline.upcast_ref::<gst::Object>()).unwrap_or(false) {
                            if let Some(st) = state_weak.upgrade() {
                                match s.current() {
                                    gst::State::Playing => {
                                        *st.write() = if loop_flag.input_type == InputType::VideoCapture {
                                            InputState::Capturing
                                        } else {
                                            InputState::Playing
                                        };
                                    }
                                    gst::State::Paused => {
                                        *st.write() = InputState::Paused;
                                    }
                                    gst::State::Ready => {
                                        *st.write() = InputState::Ready;
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    _ => {}
                }
                gst::glib::ControlFlow::Continue
            })
            .map_err(|e| LiveStudioError::media(format!("Failed to attach bus watch: {e}"), None))?;

        *instance.bus_watch_guard.write() = Some(watch);

        // Start in Playing state for live cameras/images/screens/virtuals/media files so preview & program stream immediately
        let initial_state = gst::State::Playing;

        if let Err(e) = instance.pipeline.set_state(initial_state) {
            let err_msg = format!("Failed to set initial pipeline state {initial_state:?}: {e}");
            warn!("{err_msg}");
            *instance.error_message.write() = Some(err_msg);
            *instance.state.write() = InputState::Error;
        } else {
            *instance.state.write() = if instance.input_type == InputType::VideoCapture {
                InputState::Capturing
            } else {
                InputState::Playing
            };
        }

        // Query initial duration if available
        let _ = instance.query_duration();

        Ok(instance)
    }

    pub fn play(&self) -> Result<(), LiveStudioError> {
        self.pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to set Playing state: {e}"), None)
        })?;
        *self.state.write() = InputState::Playing;
        Ok(())
    }

    pub fn pause(&self) -> Result<(), LiveStudioError> {
        self.pipeline.set_state(gst::State::Paused).map_err(|e| {
            LiveStudioError::media(format!("Failed to set Paused state: {e}"), None)
        })?;
        let _ = self.pipeline.state(gst::ClockTime::from_mseconds(100));
        *self.state.write() = InputState::Paused;
        Ok(())
    }

    pub fn stop(&self) -> Result<(), LiveStudioError> {
        self.pipeline.set_state(gst::State::Ready).map_err(|e| {
            LiveStudioError::media(format!("Failed to set Ready state on stop: {e}"), None)
        })?;
        let _ = self.seek(0);
        *self.state.write() = InputState::Ready;
        Ok(())
    }

    pub fn seek(&self, position_ms: u64) -> Result<(), LiveStudioError> {
        let clock_time = gst::ClockTime::from_mseconds(position_ms);
        self.pipeline
            .seek_simple(
                gst::SeekFlags::FLUSH | gst::SeekFlags::KEY_UNIT,
                clock_time,
            )
            .map_err(|e| LiveStudioError::media(format!("Seek failed to {position_ms}ms: {e}"), None))?;
        self.last_position_ms.store(position_ms, Ordering::SeqCst);
        Ok(())
    }

    pub fn set_volume(&self, vol: f32) {
        let clamped = vol.clamp(0.0, 1.5);
        *self.volume.write() = clamped;
        if let Some(vol_elem) = self.pipeline.by_name("vol") {
            vol_elem.set_property("volume", clamped as f64);
        }
    }

    pub fn set_mute(&self, muted: bool) {
        self.muted.store(muted, Ordering::SeqCst);
        if let Some(vol_elem) = self.pipeline.by_name("vol") {
            vol_elem.set_property("mute", muted);
        }
    }

    pub fn set_loop(&self, looping: bool) {
        self.is_looping.store(looping, Ordering::SeqCst);
    }

    pub fn query_position(&self) -> u64 {
        if let Some(pos) = self.pipeline.query_position::<gst::ClockTime>() {
            let ms = pos.mseconds();
            self.last_position_ms.store(ms, Ordering::SeqCst);
            ms
        } else {
            self.last_position_ms.load(Ordering::SeqCst)
        }
    }

    pub fn query_duration(&self) -> u64 {
        if let Some(dur) = self.pipeline.query_duration::<gst::ClockTime>() {
            let ms = dur.mseconds();
            self.duration_ms.store(ms, Ordering::SeqCst);
            ms
        } else {
            self.duration_ms.load(Ordering::SeqCst)
        }
    }

    pub fn set_playback_rate(&self, rate: f64) -> Result<(), LiveStudioError> {
        let clamped = rate.clamp(0.1, 4.0);
        let current_pos_ms = self.query_position();
        let clock_time = gst::ClockTime::from_mseconds(current_pos_ms);
        self.pipeline
            .seek(
                clamped,
                gst::SeekFlags::FLUSH | gst::SeekFlags::ACCURATE,
                gst::SeekType::Set,
                clock_time,
                gst::SeekType::None,
                gst::ClockTime::NONE,
            )
            .map_err(|e| LiveStudioError::media(format!("Failed to set playback rate to {clamped}x: {e}"), None))?;
        *self.playback_rate.write() = clamped;
        Ok(())
    }

    pub fn set_color_adjustment(&self, brightness: f64, contrast: f64, saturation: f64, hue: f64) {
        if let Some(bal) = self.pipeline.by_name("bal") {
            bal.set_property("brightness", brightness.clamp(-1.0, 1.0));
            bal.set_property("contrast", contrast.clamp(0.0, 2.0));
            bal.set_property("saturation", saturation.clamp(0.0, 2.0));
            bal.set_property("hue", hue.clamp(-1.0, 1.0));
        }
    }

    pub fn pull_audio_chunk(&self) -> Option<Vec<u8>> {
        if let Some(chunk) = self.latest_audio_chunk.read().clone() {
            return Some(chunk);
        }
        if let Some(ref asink) = self._audio_appsink {
            if let Some(sample) = asink.try_pull_sample(gst::ClockTime::ZERO) {
                if let Some(buffer) = sample.buffer() {
                    if let Ok(map) = buffer.map_readable() {
                        let data = map.as_slice().to_vec();
                        *self.latest_audio_chunk.write() = Some(data.clone());
                        return Some(data);
                    }
                }
            }
        }
        None
    }

    pub fn get_latest_audio_chunk(&self) -> Option<Vec<u8>> {
        self.latest_audio_chunk.read().clone()
    }

    pub fn pipeline(&self) -> &gst::Pipeline {
        &self.pipeline
    }

    pub fn get_playback_state(&self) -> PlaybackState {
        let pos = self.query_position();
        let dur = self.query_duration();
        let st = *self.state.read();

        PlaybackState {
            position_ms: pos,
            duration_ms: dur,
            is_playing: st == InputState::Playing || st == InputState::Capturing,
            is_paused: st == InputState::Paused,
            is_looping: self.is_looping.load(Ordering::SeqCst),
            volume: *self.volume.read(),
            is_muted: self.muted.load(Ordering::SeqCst),
            playback_rate: *self.playback_rate.read(),
        }
    }

    pub fn get_latest_jpeg_bytes(&self) -> Option<Vec<u8>> {
        let guard = self.latest_rgba_frame.read();
        guard.as_ref().map(|img| {
            SceneCompositor::to_jpeg_bytes(img, 70)
        })
    }

    pub fn get_latest_frame_data_url(&self) -> Option<String> {
        let seq = self.frame_counter.load(Ordering::Relaxed);
        {
            let guard = self.cached_data_url.read();
            if let Some((cached_seq, ref url)) = *guard {
                if cached_seq == seq && seq > 0 {
                    return Some(url.clone());
                }
            }
        }

        // Clone the RGBA buffer and immediately release the read lock so GStreamer's
        // video appsink callback is never blocked while JPEG encoding runs.
        let img_opt = self.latest_rgba_frame.read().clone();
        if let Some(ref img) = img_opt {
            let url = SceneCompositor::to_data_url(img, 80);
            let cur_seq = self.frame_counter.load(Ordering::Relaxed).max(1);
            *self.cached_data_url.write() = Some((cur_seq, url.clone()));
            Some(url)
        } else {
            None
        }
    }

    pub fn get_latest_rgba_frame(&self) -> Option<image::RgbaImage> {
        self.latest_rgba_frame.read().clone()
    }

    pub fn get_state(&self) -> InputState {
        let current = *self.state.read();
        if current == InputState::Error || current == InputState::Closed {
            return current;
        }
        let (_, gst_state, pending) = self.pipeline.state(gst::ClockTime::ZERO);
        match gst_state {
            gst::State::Playing => {
                if pending == gst::State::Paused {
                    *self.state.write() = InputState::Paused;
                    InputState::Paused
                } else {
                    let s = if self.input_type == InputType::VideoCapture {
                        InputState::Capturing
                    } else {
                        InputState::Playing
                    };
                    *self.state.write() = s;
                    s
                }
            }
            gst::State::Paused => {
                if pending == gst::State::Playing {
                    let s = if self.input_type == InputType::VideoCapture {
                        InputState::Capturing
                    } else {
                        InputState::Playing
                    };
                    *self.state.write() = s;
                    s
                } else {
                    *self.state.write() = InputState::Paused;
                    InputState::Paused
                }
            }
            gst::State::Ready => {
                if pending == gst::State::Playing {
                    let s = if self.input_type == InputType::VideoCapture {
                        InputState::Capturing
                    } else {
                        InputState::Playing
                    };
                    *self.state.write() = s;
                    s
                } else {
                    *self.state.write() = InputState::Ready;
                    InputState::Ready
                }
            }
            _ => current,
        }
    }

    pub fn get_error_message(&self) -> Option<String> {
        self.error_message.read().clone()
    }

    pub fn close(&self) {
        let _ = self.pipeline.set_state(gst::State::Null);
        *self.state.write() = InputState::Closed;
        info!("Cleanly closed media input pipeline '{}'", self.id);
    }
}

impl Drop for MediaInputInstance {
    fn drop(&mut self) {
        self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_video_pipeline_parsing() {
        let _ = gst::init();
        let video_only = r#"uridecodebin uri="file:///tmp/dummy.mp4" ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=false sync=true"#;
        let elem = gst::parse::launch(video_only).expect("Failed to parse video-only pipeline");
        let bin = elem.dynamic_cast::<gst::Pipeline>().expect("Not pipeline");
        assert!(bin.by_name("vsink").is_some());
        assert!(bin.by_name("bal").is_some());

        let with_audio = r#"uridecodebin uri="file:///tmp/dummy.mp4" name=d d. ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! videoconvert ! videoscale ! video/x-raw,format=RGBA,width=1280,height=720 ! videobalance name=bal ! appsink name=vsink max-buffers=2 drop=false sync=true d. ! queue name=delay max-size-buffers=0 max-size-bytes=0 max-size-time=3000000000 ! audioconvert ! audioresample ! equalizer-3bands name=eq ! audiopanorama name=pan ! volume name=vol ! tee name=at ! queue max-size-buffers=0 max-size-bytes=0 max-size-time=2000000000 ! autoaudiosink at. ! queue max-size-buffers=10 leaky=downstream ! appsink name=asink caps="audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved" max-buffers=5 drop=true sync=false"#;
        let elem_a = gst::parse::launch(with_audio).expect("Failed to parse with-audio pipeline");
        let bin_a = elem_a.dynamic_cast::<gst::Pipeline>().expect("Not pipeline");
        assert!(bin_a.by_name("vsink").is_some());
        assert!(bin_a.by_name("asink").is_some());
        assert!(bin_a.by_name("vol").is_some());
    }
}
