use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use image::{imageops, Rgba, RgbaImage};
use std::io::Cursor;
use crate::switcher::model::{FitMode, Scene, SceneLayer};

pub struct SceneCompositor;

impl SceneCompositor {
    /// Parses a hex color string like "#1a202c" or "#000000" into an RGBA pixel
    pub fn parse_hex_color(hex: &str) -> Rgba<u8> {
        let clean = hex.trim_start_matches('#');
        if clean.len() >= 6 {
            let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0);
            Rgba([r, g, b, 255])
        } else {
            Rgba([0, 0, 0, 255])
        }
    }

    /// Renders a Scene onto an RGBA canvas of size canvas_width x canvas_height
    pub fn render_scene<F>(scene: &Scene, mut get_source_frame: F) -> RgbaImage
    where
        F: FnMut(&str) -> Option<RgbaImage>,
    {
        let width = scene.canvas_width.clamp(320, 1920);
        let height = scene.canvas_height.clamp(180, 1080);

        // 1. Initialize canvas with background color
        let bg_color = Self::parse_hex_color(&scene.background_color);
        let mut canvas = RgbaImage::from_pixel(width, height, bg_color);

        // 2. Sort layers by z_index ascending (lower z_index renders first, higher on top)
        let mut sorted_layers: Vec<&SceneLayer> = scene.layers.iter().filter(|l| l.visible).collect();
        sorted_layers.sort_by_key(|l| l.z_index);

        // 3. Composite each layer
        for layer in sorted_layers {
            if layer.opacity <= 0.0 {
                continue;
            }

            let source_img = match get_source_frame(&layer.source_id) {
                Some(img) => img,
                None => {
                    // Fallback neutral dark gray frame for unavailable source
                    RgbaImage::from_pixel(320, 180, Rgba([30, 35, 45, 255]))
                }
            };

            Self::composite_layer(&mut canvas, layer, &source_img);
        }

        canvas
    }

    fn composite_layer(canvas: &mut RgbaImage, layer: &SceneLayer, source: &RgbaImage) {
        let (c_w, c_h) = canvas.dimensions();
        let (s_w, s_h) = source.dimensions();

        if s_w == 0 || s_h == 0 {
            return;
        }

        // Apply normalized crop
        let crop_x = (layer.crop_left.clamp(0.0, 1.0) * s_w as f32) as u32;
        let crop_y = (layer.crop_top.clamp(0.0, 1.0) * s_h as f32) as u32;
        let crop_w = ((1.0 - layer.crop_left - layer.crop_right).clamp(0.01, 1.0) * s_w as f32) as u32;
        let crop_h = ((1.0 - layer.crop_top - layer.crop_bottom).clamp(0.01, 1.0) * s_h as f32) as u32;

        let safe_w = crop_w.min(s_w.saturating_sub(crop_x)).max(1);
        let safe_h = crop_h.min(s_h.saturating_sub(crop_y)).max(1);

        let cropped = imageops::crop_imm(source, crop_x, crop_y, safe_w, safe_h).to_image();

        // Destination dimensions on canvas
        let dst_w = (layer.width.clamp(0.01, 2.0) * c_w as f32) as u32;
        let dst_h = (layer.height.clamp(0.01, 2.0) * c_h as f32) as u32;

        if dst_w == 0 || dst_h == 0 {
            return;
        }

        // Scale cropped image according to fit_mode
        let scaled = match layer.fit_mode {
            FitMode::Stretch => imageops::resize(&cropped, dst_w, dst_h, imageops::FilterType::Nearest),
            FitMode::Fit => {
                let scale = (dst_w as f32 / safe_w as f32).min(dst_h as f32 / safe_h as f32);
                let actual_w = ((safe_w as f32 * scale) as u32).max(1).min(dst_w);
                let actual_h = ((safe_h as f32 * scale) as u32).max(1).min(dst_h);
                let resized = imageops::resize(&cropped, actual_w, actual_h, imageops::FilterType::Nearest);
                let mut fitted = RgbaImage::from_pixel(dst_w, dst_h, Rgba([0, 0, 0, 0]));
                let ox = ((dst_w - actual_w) / 2) as i64;
                let oy = ((dst_h - actual_h) / 2) as i64;
                imageops::overlay(&mut fitted, &resized, ox, oy);
                fitted
            }
            FitMode::Fill => {
                let scale = (dst_w as f32 / safe_w as f32).max(dst_h as f32 / safe_h as f32);
                let actual_w = ((safe_w as f32 * scale) as u32).max(1);
                let actual_h = ((safe_h as f32 * scale) as u32).max(1);
                let resized = imageops::resize(&cropped, actual_w, actual_h, imageops::FilterType::Nearest);
                let cx = (actual_w.saturating_sub(dst_w)) / 2;
                let cy = (actual_h.saturating_sub(dst_h)) / 2;
                imageops::crop_imm(&resized, cx, cy, dst_w, dst_h).to_image()
            }
        };

        // Destination origin
        let dst_x = (layer.x * c_w as f32) as i32;
        let dst_y = (layer.y * c_h as f32) as i32;
        let opacity = layer.opacity.clamp(0.0, 1.0);

        // Alpha blend onto canvas
        let (scaled_w, scaled_h) = scaled.dimensions();
        for sy in 0..scaled_h {
            let cy = dst_y + sy as i32;
            if cy < 0 || cy >= c_h as i32 {
                continue;
            }

            for sx in 0..scaled_w {
                let cx = dst_x + sx as i32;
                if cx < 0 || cx >= c_w as i32 {
                    continue;
                }

                let src_px = scaled.get_pixel(sx, sy).0;
                let src_alpha = (src_px[3] as f32 / 255.0) * opacity;

                if src_alpha <= 0.0 {
                    continue;
                }

                let dst_px = canvas.get_pixel_mut(cx as u32, cy as u32);
                let dst_inv = 1.0 - src_alpha;

                let r = (src_px[0] as f32 * src_alpha + dst_px[0] as f32 * dst_inv) as u8;
                let g = (src_px[1] as f32 * src_alpha + dst_px[1] as f32 * dst_inv) as u8;
                let b = (src_px[2] as f32 * src_alpha + dst_px[2] as f32 * dst_inv) as u8;

                *dst_px = Rgba([r, g, b, 255]);
            }
        }
    }

    /// Encodes an RgbaImage to JPEG bytes safely by converting to RGB8 first
    pub fn to_jpeg_bytes(img: &RgbaImage, quality: u8) -> Vec<u8> {
        let (w, h) = img.dimensions();
        if w == 0 || h == 0 {
            return Vec::new();
        }

        // Downscale with smooth bilinear filtering if source exceeds HD resolution (1280x720)
        let (rgb_raw, enc_w, enc_h) = if w > 1280 || h > 720 {
            let resized = imageops::resize(img, 1280, 720, imageops::FilterType::Triangle);
            let raw = resized.as_raw();
            let total_pixels = 1280 * 720;
            let mut rgb = vec![0u8; total_pixels * 3];
            for (src, dst) in raw.chunks_exact(4).zip(rgb.chunks_exact_mut(3)) {
                dst[0] = src[0];
                dst[1] = src[1];
                dst[2] = src[2];
            }
            (rgb, 1280, 720)
        } else {
            let raw = img.as_raw();
            let total_pixels = (w * h) as usize;
            let mut rgb = vec![0u8; total_pixels * 3];
            for (src, dst) in raw.chunks_exact(4).zip(rgb.chunks_exact_mut(3)) {
                dst[0] = src[0];
                dst[1] = src[1];
                dst[2] = src[2];
            }
            (rgb, w, h)
        };

        let mut buf = Vec::new();
        let mut cursor = Cursor::new(&mut buf);
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality.clamp(20, 85));
        if encoder.encode(&rgb_raw, enc_w, enc_h, image::ExtendedColorType::Rgb8).is_ok() {
            buf
        } else {
            Vec::new()
        }
    }

    /// Encodes an RgbaImage to a data:image/jpeg;base64 string
    pub fn to_data_url(img: &RgbaImage, quality: u8) -> String {
        let bytes = Self::to_jpeg_bytes(img, quality);
        format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encoding() {
        for (w, h) in [(640, 360), (1280, 720), (1920, 1080), (2592, 1944), (320, 240), (100, 100), (641, 359)] {
            let img = RgbaImage::new(w, h);
            let bytes = SceneCompositor::to_jpeg_bytes(&img, 80);
            assert!(!bytes.is_empty(), "Failed to encode {}x{}", w, h);
            let url = SceneCompositor::to_data_url(&img, 80);
            assert!(url.starts_with("data:image/jpeg;base64,"));
        }
    }
}
