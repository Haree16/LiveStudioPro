use chrono::Utc;
use gstreamer as gst;
use gstreamer::prelude::*;
use gstreamer_app::AppSrc;
use parking_lot::RwLock;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tracing::{error, info, warn};

use crate::core::error::LiveStudioError;
use crate::output::credential::{redact_secret_from_message, redact_stream_url, CredentialVault};
use crate::output::encoder::EncoderCapabilityAuditor;
use crate::output::model::{
    OutputProfile, OutputStatus, RecordingConfig, RecordingContainer, RecordingHealth,
    RecordingStatus, StreamDestination, StreamHealth, StreamStatus,
};

/// Active streaming session
pub struct ActiveStreamSession {
    pub destination_id: String,
    pub framerate: u32,
    pub pipeline: gst::Pipeline,
    pub appsrc: AppSrc,
    pub audio_appsrc: Option<AppSrc>,
    pub start_time: Instant,
    pub session_frame_index: Arc<AtomicU64>,
    pub audio_samples_pushed: Arc<AtomicU64>,
    pub status: Arc<RwLock<StreamStatus>>,
    pub total_frames: Arc<AtomicU64>,
    pub dropped_frames: Arc<AtomicU64>,
    pub current_bitrate_kbps: Arc<RwLock<f64>>,
    pub error_message: Arc<RwLock<Option<String>>>,
    pub bus_guard: Option<gst::bus::BusWatchGuard>,
}

/// Active local recording session
pub struct ActiveRecordingSession {
    pub framerate: u32,
    pub pipeline: gst::Pipeline,
    pub appsrc: AppSrc,
    pub audio_appsrc: Option<AppSrc>,
    pub start_time: Instant,
    pub session_frame_index: Arc<AtomicU64>,
    pub audio_samples_pushed: Arc<AtomicU64>,
    pub file_path: PathBuf,
    pub container: RecordingContainer,
    pub status: Arc<RwLock<RecordingStatus>>,
    pub total_frames: Arc<AtomicU64>,
    pub dropped_frames: Arc<AtomicU64>,
    pub error_message: Arc<RwLock<Option<String>>>,
    pub bus_guard: Option<gst::bus::BusWatchGuard>,
}

pub struct NativeOutputEngine {
    destinations: Arc<RwLock<HashMap<String, StreamDestination>>>,
    profiles: Arc<RwLock<HashMap<String, OutputProfile>>>,
    recording_config: Arc<RwLock<RecordingConfig>>,
    active_streams: Arc<RwLock<HashMap<String, ActiveStreamSession>>>,
    active_recording: Arc<RwLock<Option<ActiveRecordingSession>>>,
    credentials: Arc<CredentialVault>,
    feeder_running: Arc<AtomicBool>,
    feeder_handle: Arc<RwLock<Option<std::thread::JoinHandle<()>>>>,
    frame_provider: Arc<RwLock<Option<Arc<dyn Fn() -> image::RgbaImage + Send + Sync>>>>,
    audio_provider: Arc<RwLock<Option<Arc<dyn Fn(usize) -> Vec<u8> + Send + Sync>>>>,
}

impl NativeOutputEngine {
    pub fn new(credentials: Arc<CredentialVault>) -> Self {
        let _ = gst::init();

        let mut default_profiles = HashMap::new();
        let p_1080p60 = OutputProfile::default();
        let p_1080p30 = OutputProfile::preset_1080p30();
        let p_720p30 = OutputProfile::preset_720p30();

        default_profiles.insert(p_1080p60.id.clone(), p_1080p60);
        default_profiles.insert(p_1080p30.id.clone(), p_1080p30);
        default_profiles.insert(p_720p30.id.clone(), p_720p30);

        let mut default_destinations = HashMap::new();
        let yt = StreamDestination::default();
        default_destinations.insert(yt.id.clone(), yt);

        Self {
            destinations: Arc::new(RwLock::new(default_destinations)),
            profiles: Arc::new(RwLock::new(default_profiles)),
            recording_config: Arc::new(RwLock::new(RecordingConfig::default())),
            active_streams: Arc::new(RwLock::new(HashMap::new())),
            active_recording: Arc::new(RwLock::new(None)),
            credentials,
            feeder_running: Arc::new(AtomicBool::new(false)),
            feeder_handle: Arc::new(RwLock::new(None)),
            frame_provider: Arc::new(RwLock::new(None)),
            audio_provider: Arc::new(RwLock::new(None)),
        }
    }

    /// Spawns or ensures the frame feeder thread is running
    pub fn ensure_feeder_running<F>(&self, frame_provider: F)
    where
        F: Fn() -> image::RgbaImage + Send + Sync + 'static,
    {
        *self.frame_provider.write() = Some(Arc::new(frame_provider));
        if self.feeder_running.load(Ordering::SeqCst) {
            return;
        }

        self.feeder_running.store(true, Ordering::SeqCst);
        let feeder_running = self.feeder_running.clone();
        let active_streams = self.active_streams.clone();
        let active_recording = self.active_recording.clone();
        let frame_provider_store = self.frame_provider.clone();
        let audio_provider = self.audio_provider.clone();

        let handle = std::thread::Builder::new()
            .name("livestudio-output-feeder".into())
            .spawn(move || {
                info!("Output frame feeder thread started");
                let mut loop_counter: u64 = 0;
                let mut feeder_epoch = Instant::now();
                let mut current_fps: u64 = 30;

                while feeder_running.load(Ordering::Relaxed) {
                    let has_streams = !active_streams.read().is_empty();
                    let has_recording = active_recording.read().is_some();

                    if !has_streams && !has_recording {
                        // When idle, sleep lightly to conserve CPU and reset pacing epoch
                        std::thread::sleep(Duration::from_millis(50));
                        feeder_epoch = Instant::now();
                        loop_counter = 0;
                        continue;
                    }

                    // Dynamically resolve target framerate from active streams and recording
                    let target_fps: u64 = {
                        let streams = active_streams.read();
                        let stream_max = streams.values().map(|s| s.framerate).max();
                        let rec_fps = active_recording.read().as_ref().map(|r| r.framerate);
                        stream_max.into_iter().chain(rec_fps).max().unwrap_or(30).clamp(15, 60) as u64
                    };

                    // If framerate changed, reset pacing epoch to maintain smooth cadence
                    if target_fps != current_fps {
                        current_fps = target_fps;
                        feeder_epoch = Instant::now();
                        loop_counter = 0;
                    }

                    loop_counter += 1;
                    let frame_duration_ns = 1_000_000_000 / target_fps;

                    // Authoritative Program frame from switcher compositor, normalized to 1920x1080 Full HD RGBA
                    let raw_frame = if let Some(ref prov) = *frame_provider_store.read() {
                        prov()
                    } else {
                        image::RgbaImage::from_pixel(1920, 1080, image::Rgba([0, 0, 0, 255]))
                    };
                    let frame = if raw_frame.dimensions() == (1920, 1080) {
                        raw_frame
                    } else {
                        image::imageops::resize(&raw_frame, 1920, 1080, image::imageops::FilterType::Nearest)
                    };
                    let raw_bytes = frame.as_raw();

                    // Push to active streams
                    {
                        let streams = active_streams.read();
                        for (dest_id, session) in streams.iter() {
                            if *session.status.read() == StreamStatus::Failed {
                                continue;
                            }

                            let session_elapsed_ns = session.start_time.elapsed().as_nanos() as u64;
                            let stream_dur_ns = 1_000_000_000 / (session.framerate as u64).max(1);

                            // Push Video Frame if needed by this session
                            let target_frames = session_elapsed_ns / stream_dur_ns;
                            let current_frames = session.session_frame_index.load(Ordering::Relaxed);
                            if current_frames <= target_frames {
                                let pts_ns = current_frames * stream_dur_ns;

                                if let Ok(mut buffer) = gst::Buffer::with_size(raw_bytes.len()) {
                                    {
                                        let buf_ref = buffer.get_mut().unwrap();
                                        buf_ref.set_pts(gst::ClockTime::from_nseconds(pts_ns));
                                        buf_ref.set_duration(gst::ClockTime::from_nseconds(stream_dur_ns));
                                        if let Ok(mut map) = buf_ref.map_writable() {
                                            map.copy_from_slice(raw_bytes);
                                        }
                                    }

                                    match session.appsrc.push_buffer(buffer) {
                                        Ok(_) => {
                                            session.total_frames.fetch_add(1, Ordering::Relaxed);
                                        }
                                        Err(err) => {
                                            session.dropped_frames.fetch_add(1, Ordering::Relaxed);
                                            warn!("Stream {dest_id} push buffer error: {err}");
                                        }
                                    }
                                }

                                if target_frames > current_frames + 2 {
                                    session.session_frame_index.store(target_frames, Ordering::Relaxed);
                                } else {
                                    session.session_frame_index.store(current_frames + 1, Ordering::Relaxed);
                                }
                            }

                            // Push Audio Buffer independently to prevent any starvation
                            if let Some(ref asrc) = session.audio_appsrc {
                                let target_audio_samples = (session_elapsed_ns * 48000) / 1_000_000_000;
                                let pushed_samples = session.audio_samples_pushed.load(Ordering::Relaxed);
                                if target_audio_samples > pushed_samples {
                                    let needed_samples = (target_audio_samples - pushed_samples).min(48000);
                                    if needed_samples >= 480 {
                                        let needed_bytes = (needed_samples * 4) as usize;
                                        let pcm = if let Some(ref prov) = *audio_provider.read() {
                                            prov(needed_bytes)
                                        } else {
                                            vec![0u8; needed_bytes]
                                        };

                                        let audio_pts_ns = (pushed_samples * 1_000_000_000) / 48000;
                                        let audio_dur_ns = (needed_samples * 1_000_000_000) / 48000;

                                        if let Ok(mut abuf) = gst::Buffer::with_size(pcm.len()) {
                                            {
                                                let buf_ref = abuf.get_mut().unwrap();
                                                buf_ref.set_pts(gst::ClockTime::from_nseconds(audio_pts_ns));
                                                buf_ref.set_duration(gst::ClockTime::from_nseconds(audio_dur_ns));
                                                if let Ok(mut map) = buf_ref.map_writable() {
                                                    map.copy_from_slice(&pcm);
                                                }
                                            }
                                            let _ = asrc.push_buffer(abuf);
                                            session.audio_samples_pushed.store(pushed_samples + needed_samples, Ordering::Relaxed);
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Push to active recording
                    {
                        let recording_guard = active_recording.read();
                        if let Some(session) = recording_guard.as_ref() {
                            if *session.status.read() != RecordingStatus::Failed {
                                let session_elapsed_ns = session.start_time.elapsed().as_nanos() as u64;
                                let rec_dur_ns = 1_000_000_000 / (session.framerate as u64).max(1);

                                // Push Video Frame if needed by recording
                                let target_frames = session_elapsed_ns / rec_dur_ns;
                                let current_frames = session.session_frame_index.load(Ordering::Relaxed);
                                if current_frames <= target_frames {
                                    let pts_ns = current_frames * rec_dur_ns;

                                    if let Ok(mut buffer) = gst::Buffer::with_size(raw_bytes.len()) {
                                        {
                                            let buf_ref = buffer.get_mut().unwrap();
                                            buf_ref.set_pts(gst::ClockTime::from_nseconds(pts_ns));
                                            buf_ref.set_duration(gst::ClockTime::from_nseconds(rec_dur_ns));
                                            if let Ok(mut map) = buf_ref.map_writable() {
                                                map.copy_from_slice(raw_bytes);
                                            }
                                        }

                                        match session.appsrc.push_buffer(buffer) {
                                            Ok(_) => {
                                                session.total_frames.fetch_add(1, Ordering::Relaxed);
                                            }
                                            Err(err) => {
                                                session.dropped_frames.fetch_add(1, Ordering::Relaxed);
                                                warn!("Recording push buffer error: {err}");
                                            }
                                        }
                                    }

                                    if target_frames > current_frames + 2 {
                                        session.session_frame_index.store(target_frames, Ordering::Relaxed);
                                    } else {
                                        session.session_frame_index.store(current_frames + 1, Ordering::Relaxed);
                                    }
                                }

                                // Push Audio Buffer independently to recording
                                if let Some(ref asrc) = session.audio_appsrc {
                                    let target_audio_samples = (session_elapsed_ns * 48000) / 1_000_000_000;
                                    let pushed_samples = session.audio_samples_pushed.load(Ordering::Relaxed);
                                    if target_audio_samples > pushed_samples {
                                        let needed_samples = (target_audio_samples - pushed_samples).min(48000);
                                        if needed_samples >= 480 {
                                            let needed_bytes = (needed_samples * 4) as usize;
                                            let pcm = if let Some(ref prov) = *audio_provider.read() {
                                                prov(needed_bytes)
                                            } else {
                                                vec![0u8; needed_bytes]
                                            };

                                            let audio_pts_ns = (pushed_samples * 1_000_000_000) / 48000;
                                            let audio_dur_ns = (needed_samples * 1_000_000_000) / 48000;

                                            if let Ok(mut abuf) = gst::Buffer::with_size(pcm.len()) {
                                                {
                                                    let buf_ref = abuf.get_mut().unwrap();
                                                    buf_ref.set_pts(gst::ClockTime::from_nseconds(audio_pts_ns));
                                                    buf_ref.set_duration(gst::ClockTime::from_nseconds(audio_dur_ns));
                                                    if let Ok(mut map) = buf_ref.map_writable() {
                                                        map.copy_from_slice(&pcm);
                                                    }
                                                }
                                                let _ = asrc.push_buffer(abuf);
                                                session.audio_samples_pushed.store(pushed_samples + needed_samples, Ordering::Relaxed);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Periodic broadcast stream metrics logger every 3 seconds
                    if loop_counter % (target_fps * 3).max(1) == 0 {
                        let streams = active_streams.read();
                        for (id, s) in streams.iter() {
                            let up = s.start_time.elapsed().as_secs();
                            let tot = s.total_frames.load(Ordering::Relaxed);
                            let fps = if up > 0 { tot as f64 / up as f64 } else { target_fps as f64 };
                            let dropped = s.dropped_frames.load(Ordering::Relaxed);
                            info!("[Output Engine] RTMP Stream '{}': Uptime={}s | FPS={:.1} | TotalFrames={} | Dropped={}", id, up, fps, tot, dropped);
                        }
                    }

                    // Drift-free monotonic clock pacing
                    let target_deadline = feeder_epoch + Duration::from_nanos(loop_counter * 1_000_000_000 / target_fps);
                    let now = Instant::now();
                    if target_deadline > now {
                        let to_sleep = target_deadline - now;
                        if to_sleep > Duration::from_millis(1) {
                            std::thread::sleep(to_sleep - Duration::from_micros(400));
                        }
                        while Instant::now() < target_deadline {
                            std::hint::spin_loop();
                        }
                    } else if now > target_deadline + Duration::from_nanos(frame_duration_ns * 3) {
                        feeder_epoch = Instant::now();
                        loop_counter = 0;
                    }
                }

                info!("Output frame feeder thread stopped cleanly");
            })
            .expect("Failed to spawn output feeder thread");

        *self.feeder_handle.write() = Some(handle);
    }

    /// Sets the dynamic audio provider generating mixed PCM audio buffers
    pub fn set_audio_provider<A>(&self, provider: A)
    where
        A: Fn(usize) -> Vec<u8> + Send + Sync + 'static,
    {
        *self.audio_provider.write() = Some(Arc::new(provider));
    }

    /// Starts streaming to a specific destination
    pub fn start_stream<F>(&self, destination_id: &str, frame_provider: F) -> Result<(), LiveStudioError>
    where
        F: Fn() -> image::RgbaImage + Send + Sync + 'static,
    {
        // Check if destination exists
        let dest = {
            let destinations = self.destinations.read();
            destinations
                .get(destination_id)
                .cloned()
                .ok_or_else(|| LiveStudioError::validation("Destination not found", Some("destination_id")))?
        };

        if let Some(existing) = self.active_streams.read().get(destination_id) {
            let st = *existing.status.read();
            if st == StreamStatus::Streaming || st == StreamStatus::Connecting || st == StreamStatus::Reconnecting {
                return Ok(());
            }
        }
        let _ = self.stop_stream(destination_id);

        // Resolve profile
        let profile = {
            let profiles = self.profiles.read();
            profiles
                .get(&dest.profile_id)
                .cloned()
                .unwrap_or_else(OutputProfile::default)
        };

        // Resolve secret stream key
        let secret_key = self.credentials.get_secret(&dest.stream_key_ref).unwrap_or_default();
        let target_url = if secret_key.is_empty() {
            dest.server_url.clone()
        } else if dest.server_url.ends_with('/') {
            format!("{}{}", dest.server_url, secret_key)
        } else {
            format!("{}/{}", dest.server_url, secret_key)
        };

        let sanitized_url = redact_stream_url(&target_url);
        info!("Starting RTMP streaming pipeline for destination '{}' to {}", dest.name, sanitized_url);

        let video_enc_bin = EncoderCapabilityAuditor::build_video_encode_bin(&profile);
        let audio_enc_bin = EncoderCapabilityAuditor::build_audio_encode_bin(&profile);
        let rtmp_sink_elem = if gst::ElementFactory::find("rtmp2sink").is_some() {
            "rtmp2sink"
        } else {
            "rtmpsink"
        };

        let pipeline_str = format!(
            "appsrc name=vsrc is-live=true format=time block=false max-bytes=0 max-buffers=0 \
             caps=\"video/x-raw,format=RGBA,width={},height={},framerate={}/1\" ! \
             queue max-size-buffers=30 max-size-time=1000000000 max-size-bytes=0 ! \
             videoconvert ! videoscale ! video/x-raw,format=NV12,width={},height={} ! {} ! \
             queue max-size-buffers=60 max-size-time=2000000000 max-size-bytes=0 ! \
             flvmux streamable=true latency=100000000 name=mux ! {} name=sink location=\"{}\" sync=false async=false \
             appsrc name=asrc is-live=true format=time block=false max-bytes=0 max-buffers=0 \
             caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" ! \
             queue max-size-buffers=60 max-size-time=1000000000 max-size-bytes=0 ! \
             audioconvert ! audioresample ! audio/x-raw,rate=48000,channels=2 ! {} ! \
             queue max-size-buffers=60 max-size-time=2000000000 max-size-bytes=0 ! mux.",
            profile.width, profile.height, profile.framerate, profile.width, profile.height, video_enc_bin, rtmp_sink_elem, target_url, audio_enc_bin
        );

        let pipeline = gst::parse::launch(&pipeline_str).map_err(|e| {
            let safe_err = redact_secret_from_message(&e.to_string(), Some(&secret_key));
            LiveStudioError::media(format!("Failed to build streaming pipeline: {safe_err}"), None)
        })?;

        let pipeline = pipeline
            .dynamic_cast::<gst::Pipeline>()
            .map_err(|_| LiveStudioError::media("Pipeline cast failed", None))?;

        let appsrc = pipeline
            .by_name("vsrc")
            .and_then(|e| e.dynamic_cast::<AppSrc>().ok())
            .ok_or_else(|| LiveStudioError::media("Could not find appsrc in streaming pipeline", None))?;

        let audio_appsrc = pipeline
            .by_name("asrc")
            .and_then(|e| e.dynamic_cast::<AppSrc>().ok());

        let status = Arc::new(RwLock::new(StreamStatus::Connecting));
        let error_message = Arc::new(RwLock::new(None));
        let total_frames = Arc::new(AtomicU64::new(0));
        let dropped_frames = Arc::new(AtomicU64::new(0));
        let current_bitrate_kbps = Arc::new(RwLock::new(profile.video_bitrate_kbps as f64));

        // Attach bus watcher
        let status_clone = status.clone();
        let err_clone = error_message.clone();
        let dest_name = dest.name.clone();
        let sec_key_copy = secret_key.clone();

        let bus = pipeline.bus().ok_or_else(|| {
            LiveStudioError::media("Streaming pipeline has no bus", None)
        })?;

        let pipeline_obj_name = pipeline.name();
        let bus_guard = bus
            .add_watch(move |_, msg| {
                match msg.view() {
                    gst::MessageView::Error(err) => {
                        let safe_msg = redact_secret_from_message(err.error().message(), Some(&sec_key_copy));
                        error!("Streaming error on '{}': {}", dest_name, safe_msg);
                        *status_clone.write() = StreamStatus::Failed;
                        *err_clone.write() = Some(safe_msg);
                    }
                    gst::MessageView::StateChanged(sc) => {
                        if sc.current() == gst::State::Playing
                            && sc.src().map(|s| s.name() == pipeline_obj_name).unwrap_or(false)
                        {
                            info!("Stream '{}' entered PLAYING state (Live)", dest_name);
                            *status_clone.write() = StreamStatus::Streaming;
                        }
                    }
                    _ => {}
                }
                gst::glib::ControlFlow::Continue
            })
            .map_err(|e| LiveStudioError::media(format!("Failed to add bus watch: {e}"), None))?;

        pipeline.set_state(gst::State::Playing).map_err(|e| {
            let safe_err = redact_secret_from_message(&e.to_string(), Some(&secret_key));
            LiveStudioError::media(format!("Failed to start streaming pipeline: {safe_err}"), None)
        })?;

        let session = ActiveStreamSession {
            destination_id: destination_id.to_string(),
            framerate: profile.framerate,
            pipeline,
            appsrc,
            audio_appsrc,
            start_time: Instant::now(),
            session_frame_index: Arc::new(AtomicU64::new(0)),
            audio_samples_pushed: Arc::new(AtomicU64::new(0)),
            status,
            total_frames,
            dropped_frames,
            current_bitrate_kbps,
            error_message,
            bus_guard: Some(bus_guard),
        };

        self.active_streams.write().insert(destination_id.to_string(), session);
        self.ensure_feeder_running(frame_provider);

        Ok(())
    }

    /// Stops streaming to a specific destination
    pub fn stop_stream(&self, destination_id: &str) -> Result<(), LiveStudioError> {
        let session_opt = self.active_streams.write().remove(destination_id);
        if let Some(session) = session_opt {
            let total = session.total_frames.load(Ordering::Relaxed);
            let dropped = session.dropped_frames.load(Ordering::Relaxed);
            let up = session.start_time.elapsed().as_secs();
            let fps = if up > 0 { total as f64 / up as f64 } else { 0.0 };
            info!("Stopping stream destination: {destination_id} (Uptime: {}s, Total frames: {}, FPS: {:.1}, Dropped: {})", up, total, fps, dropped);
            *session.status.write() = StreamStatus::Disconnected;
            let _ = session.appsrc.end_of_stream();
            let _ = session.pipeline.set_state(gst::State::Null);
        }
        Ok(())
    }

    /// Stops all active streaming sessions
    pub fn stop_all_streams(&self) {
        let keys: Vec<String> = self.active_streams.read().keys().cloned().collect();
        for key in keys {
            let _ = self.stop_stream(&key);
        }
    }

    /// Starts local recording
    pub fn start_recording<F>(
        &self,
        override_config: Option<RecordingConfig>,
        frame_provider: F,
    ) -> Result<String, LiveStudioError>
    where
        F: Fn() -> image::RgbaImage + Send + Sync + 'static,
    {
        if self.active_recording.read().is_some() {
            return Err(LiveStudioError::validation("Recording is already in progress", None));
        }

        let config = override_config.unwrap_or_else(|| self.recording_config.read().clone());

        // Ensure recording directory exists
        let rec_dir = Path::new(&config.directory);
        if !rec_dir.exists() {
            std::fs::create_dir_all(rec_dir).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to create recording directory: {e}"), Some(&config.directory))
            })?;
        }

        // Verify available disk space (> 200 MB)
        let available_space = get_available_disk_space(rec_dir);
        let min_required = 200 * 1024 * 1024; // 200 MB
        if available_space < min_required {
            return Err(LiveStudioError::validation(
                format!(
                    "Insufficient disk space for recording: {:.1} MB available, minimum {} MB required",
                    available_space as f64 / (1024.0 * 1024.0),
                    min_required / (1024 * 1024)
                ),
                Some("directory"),
            ));
        }

        // Generate collision-resistant filename
        let ext = config.container_format.extension();
        let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let base_name = config.filename_pattern.replace("{timestamp}", &timestamp);

        let mut candidate_path = rec_dir.join(format!("{base_name}.{ext}"));
        let mut collision_index = 1;
        while candidate_path.exists() {
            candidate_path = rec_dir.join(format!("{base_name}_{collision_index}.{ext}"));
            collision_index += 1;
        }

        let file_path_str = candidate_path.to_string_lossy().to_string();
        info!("Starting local program recording to: {file_path_str}");

        // Resolve profile
        let profile = {
            let profiles = self.profiles.read();
            profiles
                .get(&config.profile_id)
                .cloned()
                .unwrap_or_else(OutputProfile::default)
        };

        let video_enc_bin = EncoderCapabilityAuditor::build_video_encode_bin(&profile);
        let audio_enc_bin = EncoderCapabilityAuditor::build_audio_encode_bin(&profile);

        let mux_bin = match config.container_format {
            RecordingContainer::Mp4 => "mp4mux fragment-duration=2000 faststart=true name=mux",
            RecordingContainer::Mkv => "matroskamux name=mux",
        };

        let pipeline_str = format!(
            "appsrc name=vsrc is-live=true format=time block=false max-bytes=0 max-buffers=0 \
             caps=\"video/x-raw,format=RGBA,width={},height={},framerate={}/1\" ! \
             queue max-size-buffers=30 max-size-time=1000000000 max-size-bytes=0 ! \
             videoconvert ! videoscale ! video/x-raw,format=NV12,width={},height={} ! {} ! \
             queue max-size-buffers=60 max-size-time=2000000000 max-size-bytes=0 ! \
             mux. {} ! filesink name=sink location=\"{}\" \
             appsrc name=asrc is-live=true format=time block=false max-bytes=0 max-buffers=0 \
             caps=\"audio/x-raw,format=S16LE,rate=48000,channels=2,layout=interleaved\" ! \
             queue max-size-buffers=60 max-size-time=1000000000 max-size-bytes=0 ! \
             audioconvert ! audioresample ! audio/x-raw,rate=48000,channels=2 ! {} ! \
             queue max-size-buffers=60 max-size-time=2000000000 max-size-bytes=0 ! mux.",
            profile.width, profile.height, profile.framerate, profile.width, profile.height, video_enc_bin, mux_bin, file_path_str, audio_enc_bin
        );

        let pipeline = gst::parse::launch(&pipeline_str).map_err(|e| {
            LiveStudioError::media(format!("Failed to build recording pipeline: {e}"), None)
        })?;

        let pipeline = pipeline
            .dynamic_cast::<gst::Pipeline>()
            .map_err(|_| LiveStudioError::media("Recording pipeline cast failed", None))?;

        let appsrc = pipeline
            .by_name("vsrc")
            .and_then(|e| e.dynamic_cast::<AppSrc>().ok())
            .ok_or_else(|| LiveStudioError::media("Could not find appsrc in recording pipeline", None))?;

        let audio_appsrc = pipeline
            .by_name("asrc")
            .and_then(|e| e.dynamic_cast::<AppSrc>().ok());

        let status = Arc::new(RwLock::new(RecordingStatus::Starting));
        let error_message = Arc::new(RwLock::new(None));
        let total_frames = Arc::new(AtomicU64::new(0));
        let dropped_frames = Arc::new(AtomicU64::new(0));

        let status_clone = status.clone();
        let err_clone = error_message.clone();

        let bus = pipeline.bus().ok_or_else(|| {
            LiveStudioError::media("Recording pipeline has no bus", None)
        })?;

        let rec_pipeline_name = pipeline.name();
        let bus_guard = bus
            .add_watch(move |_, msg| {
                match msg.view() {
                    gst::MessageView::Error(err) => {
                        let err_msg = err.error().to_string();
                        error!("Recording pipeline error: {err_msg}");
                        *status_clone.write() = RecordingStatus::Failed;
                        *err_clone.write() = Some(err_msg);
                    }
                    gst::MessageView::StateChanged(sc) => {
                        if sc.current() == gst::State::Playing
                            && sc.src().map(|s| s.name() == rec_pipeline_name).unwrap_or(false)
                        {
                            info!("Recording pipeline entered PLAYING state");
                            *status_clone.write() = RecordingStatus::Recording;
                        }
                    }
                    _ => {}
                }
                gst::glib::ControlFlow::Continue
            })
            .map_err(|e| LiveStudioError::media(format!("Failed to add recording bus watch: {e}"), None))?;

        pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to start recording pipeline: {e}"), None)
        })?;

        let session = ActiveRecordingSession {
            framerate: profile.framerate,
            pipeline,
            appsrc,
            audio_appsrc,
            start_time: Instant::now(),
            session_frame_index: Arc::new(AtomicU64::new(0)),
            audio_samples_pushed: Arc::new(AtomicU64::new(0)),
            file_path: candidate_path.clone(),
            container: config.container_format,
            status,
            total_frames,
            dropped_frames,
            error_message,
            bus_guard: Some(bus_guard),
        };

        *self.active_recording.write() = Some(session);
        self.ensure_feeder_running(frame_provider);

        Ok(file_path_str)
    }

    /// Stops local recording and finalizes container headers
    pub fn stop_recording(&self) -> Result<String, LiveStudioError> {
        let session_opt = self.active_recording.write().take();
        if let Some(session) = session_opt {
            let path_str = session.file_path.to_string_lossy().to_string();
            info!("Stopping recording and finalizing container: {path_str}");

            *session.status.write() = RecordingStatus::Stopping;
            let _ = session.appsrc.end_of_stream();

            // Wait briefly for EOS to flush muxer headers
            std::thread::sleep(Duration::from_millis(300));
            let _ = session.pipeline.set_state(gst::State::Null);

            *session.status.write() = RecordingStatus::Idle;
            info!("Recording finalized successfully: {path_str}");
            Ok(path_str)
        } else {
            Err(LiveStudioError::validation("No active recording in progress", None))
        }
    }

    /// Collects the current operational output status
    pub fn get_status(&self) -> OutputStatus {
        let mut stream_health_map = HashMap::new();
        let streams = self.active_streams.read();

        for (dest_id, session) in streams.iter() {
            let uptime = session.start_time.elapsed().as_secs();
            let total = session.total_frames.load(Ordering::Relaxed);
            let dropped = session.dropped_frames.load(Ordering::Relaxed);
            let fps = if uptime > 0 { (total as f64) / (uptime as f64) } else { 30.0 };
            let bitrate = *session.current_bitrate_kbps.read();

            stream_health_map.insert(
                dest_id.clone(),
                StreamHealth {
                    destination_id: dest_id.clone(),
                    status: *session.status.read(),
                    uptime_seconds: uptime,
                    bitrate_kbps: bitrate,
                    fps: fps.clamp(0.0, 120.0),
                    dropped_frames: dropped,
                    total_frames: total,
                    error_message: session.error_message.read().clone(),
                },
            );
        }

        let recording_health = {
            let rec_guard = self.active_recording.read();
            rec_guard.as_ref().map(|session| {
                let uptime = session.start_time.elapsed().as_secs();
                let total = session.total_frames.load(Ordering::Relaxed);
                let dropped = session.dropped_frames.load(Ordering::Relaxed);
                let fps = if uptime > 0 { (total as f64) / (uptime as f64) } else { 30.0 };
                let file_size = std::fs::metadata(&session.file_path).map(|m| m.len()).unwrap_or(0);
                let available_disk = get_available_disk_space(&session.file_path);

                RecordingHealth {
                    status: *session.status.read(),
                    uptime_seconds: uptime,
                    file_path: session.file_path.to_string_lossy().to_string(),
                    file_size_bytes: file_size,
                    fps: fps.clamp(0.0, 120.0),
                    dropped_frames: dropped,
                    available_disk_space_bytes: available_disk,
                    error_message: session.error_message.read().clone(),
                }
            })
        };

        let rec_config = self.recording_config.read();
        let rec_dir = Path::new(&rec_config.directory);
        let global_disk_space = get_available_disk_space(rec_dir);

        OutputStatus {
            is_streaming: !stream_health_map.is_empty(),
            is_recording: recording_health.is_some(),
            streaming: stream_health_map,
            recording: recording_health,
            available_disk_space_bytes: global_disk_space,
            timestamp: Utc::now(),
        }
    }

    // Output Profiles Management
    pub fn get_profiles(&self) -> Vec<OutputProfile> {
        self.profiles.read().values().cloned().collect()
    }

    pub fn save_profile(&self, profile: OutputProfile) {
        self.profiles.write().insert(profile.id.clone(), profile);
    }

    pub fn delete_profile(&self, profile_id: &str) -> bool {
        self.profiles.write().remove(profile_id).is_some()
    }

    // Streaming Destinations Management
    pub fn get_destinations(&self) -> Vec<StreamDestination> {
        self.destinations.read().values().cloned().collect()
    }

    pub fn save_destination(&self, dest: StreamDestination, secret_key: Option<String>) {
        if let Some(key) = secret_key {
            if !key.is_empty() {
                self.credentials.set_secret(&dest.stream_key_ref, &key);
            }
        }
        self.destinations.write().insert(dest.id.clone(), dest);
    }

    pub fn delete_destination(&self, dest_id: &str) -> bool {
        let _ = self.stop_stream(dest_id);
        self.destinations.write().remove(dest_id).is_some()
    }

    // Recording Config
    pub fn get_recording_config(&self) -> RecordingConfig {
        self.recording_config.read().clone()
    }

    pub fn set_recording_config(&self, config: RecordingConfig) {
        *self.recording_config.write() = config;
    }
}

impl Drop for NativeOutputEngine {
    fn drop(&mut self) {
        self.feeder_running.store(false, Ordering::SeqCst);
        self.stop_all_streams();
        let _ = self.stop_recording();
    }
}

/// Portable query for available disk space in bytes
pub fn get_available_disk_space(path: &Path) -> u64 {
    #[cfg(unix)]
    {
        use std::ffi::CString;
        use std::os::unix::ffi::OsStrExt;

        let check_path = if path.exists() {
            path.to_path_buf()
        } else {
            path.ancestors().find(|p| p.exists()).map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("/"))
        };

        if let Ok(c_path) = CString::new(check_path.as_os_str().as_bytes()) {
            unsafe {
                let mut stat: libc::statvfs = std::mem::zeroed();
                if libc::statvfs(c_path.as_ptr(), &mut stat) == 0 {
                    return (stat.f_bavail as u64) * (stat.f_frsize as u64);
                }
            }
        }
    }

    // Fallback: 50 GB default if unsupported
    50 * 1024 * 1024 * 1024
}
