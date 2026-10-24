//! Latest decoded video frame and audio chunks received from each remote guest.
//!
//! The WebRTC receive pipeline (`remote::webrtc`) pushes into this hub; the switcher and audio
//! mixer read from it by input id (`guest-<guest id>`), exactly like they read local inputs.
use image::RgbaImage;
use parking_lot::RwLock;
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;

/// Maximum buffered audio chunks per guest (~ a few hundred ms) before the oldest are dropped.
const MAX_AUDIO_CHUNKS: usize = 24;

pub type GuestVideoStartedCallback = Arc<dyn Fn(&str) + Send + Sync>;

#[derive(Default)]
pub struct GuestMediaHub {
    video: RwLock<HashMap<String, RgbaImage>>,
    audio: RwLock<HashMap<String, VecDeque<Vec<u8>>>>,
    announced: RwLock<HashSet<String>>,
    on_video_started: RwLock<Option<GuestVideoStartedCallback>>,
}

impl GuestMediaHub {
    pub fn new() -> Self {
        Self::default()
    }

    /// Input id under which a guest appears in the switcher and mixer.
    pub fn input_id(guest_id: &str) -> String {
        format!("guest-{guest_id}")
    }

    pub fn guest_id_from_input(input_id: &str) -> Option<&str> {
        input_id.strip_prefix("guest-").filter(|s| !s.is_empty())
    }

    /// Registered once; invoked the first time a given guest delivers a video frame.
    pub fn set_on_video_started(&self, cb: GuestVideoStartedCallback) {
        *self.on_video_started.write() = Some(cb);
    }

    pub fn push_video(&self, guest_id: &str, frame: RgbaImage) {
        self.video.write().insert(guest_id.to_string(), frame);
        let first = self.announced.write().insert(guest_id.to_string());
        if first {
            if let Some(cb) = self.on_video_started.read().clone() {
                cb(guest_id);
            }
        }
    }

    /// Interleaved S16LE / 48 kHz / stereo PCM.
    pub fn push_audio(&self, guest_id: &str, pcm: Vec<u8>) {
        let mut all = self.audio.write();
        let q = all.entry(guest_id.to_string()).or_default();
        q.push_back(pcm);
        while q.len() > MAX_AUDIO_CHUNKS {
            q.pop_front();
        }
    }

    pub fn latest_video(&self, guest_id: &str) -> Option<RgbaImage> {
        self.video.read().get(guest_id).cloned()
    }

    /// Oldest buffered audio chunk, removing it from the queue.
    pub fn pull_audio(&self, guest_id: &str) -> Option<Vec<u8>> {
        self.audio.write().get_mut(guest_id)?.pop_front()
    }

    pub fn has_video(&self, guest_id: &str) -> bool {
        self.video.read().contains_key(guest_id)
    }

    /// Forget a guest's media (on disconnect) so a reconnect announces itself again.
    pub fn clear(&self, guest_id: &str) {
        self.video.write().remove(guest_id);
        self.audio.write().remove(guest_id);
        self.announced.write().remove(guest_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test]
    fn ids_round_trip() {
        assert_eq!(GuestMediaHub::input_id("abc"), "guest-abc");
        assert_eq!(GuestMediaHub::guest_id_from_input("guest-abc"), Some("abc"));
        assert_eq!(GuestMediaHub::guest_id_from_input("cam-1"), None);
        assert_eq!(GuestMediaHub::guest_id_from_input("guest-"), None);
    }

    #[test]
    fn announces_first_frame_once_until_cleared() {
        let hub = GuestMediaHub::new();
        let n = Arc::new(AtomicUsize::new(0));
        let n2 = n.clone();
        hub.set_on_video_started(Arc::new(move |_| {
            n2.fetch_add(1, Ordering::SeqCst);
        }));
        let f = RgbaImage::from_pixel(2, 2, Rgba([1, 2, 3, 255]));
        hub.push_video("g", f.clone());
        hub.push_video("g", f.clone());
        assert_eq!(n.load(Ordering::SeqCst), 1);
        assert!(hub.has_video("g"));
        hub.clear("g");
        assert!(hub.latest_video("g").is_none());
        hub.push_video("g", f);
        assert_eq!(n.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn audio_queue_is_fifo_and_bounded() {
        let hub = GuestMediaHub::new();
        for i in 0..40u8 {
            hub.push_audio("g", vec![i]);
        }
        assert_eq!(hub.pull_audio("g"), Some(vec![16])); // 40 - 24 oldest dropped
        assert!(hub.pull_audio("nobody").is_none());
    }
}
