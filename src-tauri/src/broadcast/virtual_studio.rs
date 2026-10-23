use image::{Rgba, RgbaImage};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Point2D {
    pub x: f32, // 0.0 to 1.0 (normalized coordinate)
    pub y: f32, // 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VirtualCameraTrack {
    pub id: String,
    pub name: String,
    pub pan_x: f32, // -1.0 to 1.0 (normalized center offset)
    pub pan_y: f32, // -1.0 to 1.0
    pub zoom: f32,  // 0.5 to 3.0 (1.0 = unity)
    pub duration_ms: u32,
}

impl Default for VirtualCameraTrack {
    fn default() -> Self {
        Self {
            id: "track-wide".into(),
            name: "Wide Master Shot".into(),
            pan_x: 0.0,
            pan_y: 0.0,
            zoom: 1.0,
            duration_ms: 1000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VirtualStudioConfig {
    pub id: String,
    pub name: String,
    pub foreground_input_id: String,
    pub background_asset_path: Option<String>,
    pub chroma_key_enabled: bool,
    pub key_color_hex: String, // e.g. "#00FF00" for green screen
    pub tolerance: f32,        // 0.0 to 1.0
    pub feather: f32,          // Edge smoothness 0.0 to 1.0
    pub perspective_enabled: bool,
    pub corner_pins: [Point2D; 4], // TopLeft, TopRight, BottomRight, BottomLeft
    pub opacity: f32,              // 0.0 to 1.0
    pub enabled: bool,
}

impl Default for VirtualStudioConfig {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name: "Virtual Set Perspective 1".into(),
            foreground_input_id: String::new(),
            background_asset_path: None,
            chroma_key_enabled: true,
            key_color_hex: "#00FF00".into(),
            tolerance: 0.35,
            feather: 0.1,
            perspective_enabled: true,
            corner_pins: [
                Point2D { x: 0.1, y: 0.1 }, // TopLeft
                Point2D { x: 0.9, y: 0.15 }, // TopRight
                Point2D { x: 0.85, y: 0.85 }, // BottomRight
                Point2D { x: 0.15, y: 0.9 }, // BottomLeft
            ],
            opacity: 1.0,
            enabled: true,
        }
    }
}

pub struct VirtualStudioEngine {
    configs: Arc<RwLock<HashMap<String, VirtualStudioConfig>>>,
    camera_tracks: Arc<RwLock<HashMap<String, VirtualCameraTrack>>>,
}

impl VirtualStudioEngine {
    pub fn new() -> Self {
        let mut map = HashMap::new();
        let def = VirtualStudioConfig::default();
        map.insert(def.id.clone(), def);

        let mut tracks = HashMap::new();
        let def_track = VirtualCameraTrack::default();
        tracks.insert(def_track.id.clone(), def_track);

        Self {
            configs: Arc::new(RwLock::new(map)),
            camera_tracks: Arc::new(RwLock::new(tracks)),
        }
    }

    pub fn save_camera_track(&self, track: VirtualCameraTrack) {
        self.camera_tracks.write().insert(track.id.clone(), track);
    }

    pub fn list_camera_tracks(&self) -> Vec<VirtualCameraTrack> {
        let mut list: Vec<VirtualCameraTrack> = self.camera_tracks.read().values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    /// Interpolates smoothly between two camera shot tracks using cosine ease-in-out
    pub fn interpolate_camera_tracks(from: &VirtualCameraTrack, to: &VirtualCameraTrack, progress: f32) -> VirtualCameraTrack {
        let p = progress.clamp(0.0, 1.0);
        // Cosine easing: 0.5 * (1 - cos(p * PI))
        let eased = 0.5 * (1.0 - (p * std::f32::consts::PI).cos());

        VirtualCameraTrack {
            id: format!("{}-to-{}", from.id, to.id),
            name: "Interpolated Shot".into(),
            pan_x: from.pan_x + (to.pan_x - from.pan_x) * eased,
            pan_y: from.pan_y + (to.pan_y - from.pan_y) * eased,
            zoom: from.zoom + (to.zoom - from.zoom) * eased,
            duration_ms: from.duration_ms,
        }
    }

    /// Applies 2D/3D pan and zoom camera transform to an RGBA video frame
    pub fn apply_camera_transform(source: &RgbaImage, track: &VirtualCameraTrack) -> RgbaImage {
        let (width, height) = source.dimensions();
        if width == 0 || height == 0 {
            return source.clone();
        }

        let mut output = RgbaImage::from_pixel(width, height, Rgba([0, 0, 0, 255]));
        let zoom = track.zoom.clamp(0.2, 5.0);
        let center_x = width as f32 / 2.0;
        let center_y = height as f32 / 2.0;

        let offset_x = track.pan_x * width as f32 * 0.5;
        let offset_y = track.pan_y * height as f32 * 0.5;

        for out_y in 0..height {
            for out_x in 0..width {
                // Inverse mapping from output pixel to source pixel
                let src_xf = (out_x as f32 - center_x - offset_x) / zoom + center_x;
                let src_yf = (out_y as f32 - center_y - offset_y) / zoom + center_y;

                let src_x = src_xf.round() as i32;
                let src_y = src_yf.round() as i32;

                if src_x >= 0 && src_x < width as i32 && src_y >= 0 && src_y < height as i32 {
                    *output.get_pixel_mut(out_x, out_y) = *source.get_pixel(src_x as u32, src_y as u32);
                }
            }
        }

        output
    }

    pub fn save_config(&self, config: VirtualStudioConfig) {
        self.configs.write().insert(config.id.clone(), config);
    }

    pub fn remove_config(&self, id: &str) -> bool {
        self.configs.write().remove(id).is_some()
    }

    pub fn list_configs(&self) -> Vec<VirtualStudioConfig> {
        let mut list: Vec<VirtualStudioConfig> = self.configs.read().values().cloned().collect();
        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    pub fn get_config(&self, id: &str) -> Option<VirtualStudioConfig> {
        self.configs.read().get(id).cloned()
    }

    pub fn get_config_for_input(&self, input_id: &str) -> Option<VirtualStudioConfig> {
        if input_id.is_empty() {
            return None;
        }
        let map = self.configs.read();
        if let Some(cfg) = map.values().find(|c| c.enabled && c.foreground_input_id == input_id) {
            return Some(cfg.clone());
        }
        map.get(input_id).filter(|c| c.enabled && !c.foreground_input_id.is_empty()).cloned()
    }

    /// Performs chroma key transparency extraction on a frame with green/blue dominance analysis & despill
    pub fn apply_chroma_key(image: &mut RgbaImage, key_color_hex: &str, tolerance: f32, feather: f32) {
        let key_rgb = parse_hex_color(key_color_hex);
        let is_green_key = key_rgb[1] > key_rgb[0] && key_rgb[1] > key_rgb[2];
        let is_blue_key = key_rgb[2] > key_rgb[0] && key_rgb[2] > key_rgb[1];

        let tol = tolerance.clamp(0.01, 1.0);
        let tol_dist = tol * 441.67;
        let tol_sq = tol_dist * tol_dist;
        let feather_range = (feather.clamp(0.0, 1.0) * 120.0).max(1.0).powi(2);

        for pixel in image.pixels_mut() {
            let r = pixel[0] as f32;
            let g = pixel[1] as f32;
            let b = pixel[2] as f32;

            let dr = r - key_rgb[0] as f32;
            let dg = g - key_rgb[1] as f32;
            let db = b - key_rgb[2] as f32;
            let dist_sq = dr * dr + dg * dg + db * db;

            // Check channel dominance for standard Green or Blue screen
            let dominance_match = if is_green_key {
                let max_other = r.max(b);
                let diff = g - max_other;
                let threshold = (1.0 - tol) * 75.0;
                diff > threshold
            } else if is_blue_key {
                let max_other = r.max(g);
                let diff = b - max_other;
                let threshold = (1.0 - tol) * 75.0;
                diff > threshold
            } else {
                false
            };

            if dist_sq < tol_sq || dominance_match {
                pixel[3] = 0; // Fully transparent
            } else if dist_sq < tol_sq + feather_range {
                let alpha_ratio = (dist_sq - tol_sq) / feather_range;
                let orig_a = pixel[3] as f32;
                pixel[3] = (orig_a * alpha_ratio.clamp(0.0, 1.0)) as u8;

                // Despill green edges slightly so subject doesn't have a green outline
                if is_green_key && g > r.max(b) {
                    pixel[1] = (r.max(b) * 0.85 + g * 0.15) as u8;
                }
            }
        }
    }

    /// Renders the foreground into the destination canvas mapped to the 4 corner pins via bilinear quad interpolation
    pub fn composite_perspective_quad(
        foreground: &RgbaImage,
        destination: &mut RgbaImage,
        pins: &[Point2D; 4],
        opacity: f32,
    ) {
        let (fg_w, fg_h) = foreground.dimensions();
        let (dest_w, dest_h) = destination.dimensions();
        if fg_w == 0 || fg_h == 0 || dest_w == 0 || dest_h == 0 {
            return;
        }

        let p0 = pins[0]; // TL
        let p1 = pins[1]; // TR
        let p2 = pins[2]; // BR
        let p3 = pins[3]; // BL

        // Map foreground pixels to destination quadrilateral using bilinear forward projection
        for fg_y in 0..fg_h {
            let v = fg_y as f32 / fg_h as f32;
            for fg_x in 0..fg_w {
                let u = fg_x as f32 / fg_w as f32;

                // Bilinear interpolation between the 4 corner pins
                let dest_xf = (1.0 - u) * (1.0 - v) * p0.x
                    + u * (1.0 - v) * p1.x
                    + u * v * p2.x
                    + (1.0 - u) * v * p3.x;

                let dest_yf = (1.0 - u) * (1.0 - v) * p0.y
                    + u * (1.0 - v) * p1.y
                    + u * v * p2.y
                    + (1.0 - u) * v * p3.y;

                let dx = (dest_xf * dest_w as f32).round() as i32;
                let dy = (dest_yf * dest_h as f32).round() as i32;

                if dx >= 0 && dx < dest_w as i32 && dy >= 0 && dy < dest_h as i32 {
                    let fg_pixel = foreground.get_pixel(fg_x, fg_y);
                    let fg_alpha = (fg_pixel[3] as f32 / 255.0) * opacity;

                    if fg_alpha > 0.001 {
                        let bg_pixel = destination.get_pixel_mut(dx as u32, dy as u32);
                        let bg_alpha = bg_pixel[3] as f32 / 255.0;

                        let out_r = fg_pixel[0] as f32 * fg_alpha + bg_pixel[0] as f32 * (1.0 - fg_alpha);
                        let out_g = fg_pixel[1] as f32 * fg_alpha + bg_pixel[1] as f32 * (1.0 - fg_alpha);
                        let out_b = fg_pixel[2] as f32 * fg_alpha + bg_pixel[2] as f32 * (1.0 - fg_alpha);
                        let out_a = (fg_alpha + bg_alpha * (1.0 - fg_alpha)).clamp(0.0, 1.0) * 255.0;

                        *bg_pixel = Rgba([out_r as u8, out_g as u8, out_b as u8, out_a as u8]);
                    }
                }
            }
        }
    }
}

fn parse_hex_color(hex: &str) -> [u8; 3] {
    let clean = hex.trim_start_matches('#');
    if clean.len() == 6 {
        let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0);
        let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(255);
        let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0);
        [r, g, b]
    } else {
        [0, 255, 0] // Default green
    }
}
