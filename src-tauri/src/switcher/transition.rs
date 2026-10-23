use image::{Rgba, RgbaImage};
use std::time::Instant;
use crate::switcher::model::TransitionType;

pub struct ActiveTransition {
    pub transition_type: TransitionType,
    pub duration_ms: u64,
    pub start_time: Instant,
    pub from_source_id: Option<String>,
    pub to_source_id: Option<String>,
}

impl ActiveTransition {
    pub fn new(
        transition_type: TransitionType,
        duration_ms: u64,
        from_source_id: Option<String>,
        to_source_id: Option<String>,
    ) -> Self {
        Self {
            transition_type,
            duration_ms: duration_ms.max(1), // prevent division by zero
            start_time: Instant::now(),
            from_source_id,
            to_source_id,
        }
    }

    pub fn progress(&self) -> f32 {
        let elapsed = self.start_time.elapsed().as_millis() as u64;
        (elapsed as f32 / self.duration_ms as f32).clamp(0.0, 1.0)
    }

    pub fn is_finished(&self) -> bool {
        self.progress() >= 1.0
    }
}

pub struct TransitionEngine;

impl TransitionEngine {
    /// Blends two RGBA images according to the transition type and progress (0.0 to 1.0)
    pub fn render_transition(
        transition_type: TransitionType,
        from_frame: &RgbaImage,
        to_frame: &RgbaImage,
        progress: f32,
    ) -> RgbaImage {
        let p = progress.clamp(0.0, 1.0);
        let (width, height) = from_frame.dimensions();

        // If dimensions don't match, resize to_frame dimensions or return to_frame
        if to_frame.dimensions() != (width, height) {
            let resized_to = image::imageops::resize(
                to_frame,
                width,
                height,
                image::imageops::FilterType::Nearest,
            );
            return Self::render_transition(transition_type, from_frame, &resized_to, p);
        }

        match transition_type {
            TransitionType::Cut => {
                if p >= 0.5 {
                    to_frame.clone()
                } else {
                    from_frame.clone()
                }
            }

            TransitionType::Crossfade => {
                let mut out = RgbaImage::new(width, height);
                let inv_p = 1.0 - p;

                for y in 0..height {
                    for x in 0..width {
                        let f_px = from_frame.get_pixel(x, y).0;
                        let t_px = to_frame.get_pixel(x, y).0;

                        let r = (f_px[0] as f32 * inv_p + t_px[0] as f32 * p) as u8;
                        let g = (f_px[1] as f32 * inv_p + t_px[1] as f32 * p) as u8;
                        let b = (f_px[2] as f32 * inv_p + t_px[2] as f32 * p) as u8;
                        let a = (f_px[3] as f32 * inv_p + t_px[3] as f32 * p) as u8;

                        out.put_pixel(x, y, Rgba([r, g, b, a]));
                    }
                }
                out
            }

            TransitionType::FadeToBlack => {
                let mut out = RgbaImage::new(width, height);
                if p < 0.5 {
                    // Fade from_frame to black
                    let fade_factor = 1.0 - (p * 2.0);
                    for y in 0..height {
                        for x in 0..width {
                            let px = from_frame.get_pixel(x, y).0;
                            let r = (px[0] as f32 * fade_factor) as u8;
                            let g = (px[1] as f32 * fade_factor) as u8;
                            let b = (px[2] as f32 * fade_factor) as u8;
                            out.put_pixel(x, y, Rgba([r, g, b, px[3]]));
                        }
                    }
                } else {
                    // Fade from black to to_frame
                    let fade_factor = (p - 0.5) * 2.0;
                    for y in 0..height {
                        for x in 0..width {
                            let px = to_frame.get_pixel(x, y).0;
                            let r = (px[0] as f32 * fade_factor) as u8;
                            let g = (px[1] as f32 * fade_factor) as u8;
                            let b = (px[2] as f32 * fade_factor) as u8;
                            out.put_pixel(x, y, Rgba([r, g, b, px[3]]));
                        }
                    }
                }
                out
            }

            TransitionType::WipeHorizontal => {
                let mut out = RgbaImage::new(width, height);
                let split_x = (p * width as f32) as u32;

                for y in 0..height {
                    for x in 0..width {
                        let px = if x < split_x {
                            to_frame.get_pixel(x, y)
                        } else {
                            from_frame.get_pixel(x, y)
                        };
                        out.put_pixel(x, y, *px);
                    }
                }
                out
            }

            TransitionType::WipeVertical => {
                let mut out = RgbaImage::new(width, height);
                let split_y = (p * height as f32) as u32;

                for y in 0..height {
                    for x in 0..width {
                        let px = if y < split_y {
                            to_frame.get_pixel(x, y)
                        } else {
                            from_frame.get_pixel(x, y)
                        };
                        out.put_pixel(x, y, *px);
                    }
                }
                out
            }

            TransitionType::SlideHorizontal => {
                let mut out = RgbaImage::new(width, height);
                let offset_x = (p * width as f32) as i32;

                for y in 0..height {
                    for x in 0..width {
                        let xi = x as i32;
                        // Region for exiting from_frame: xi < (width - offset_x)
                        let px = if xi + offset_x < width as i32 {
                            let src_x = (xi + offset_x) as u32;
                            from_frame.get_pixel(src_x, y)
                        } else {
                            // Region for entering to_frame: xi >= (width - offset_x)
                            let src_x = (xi + offset_x - width as i32) as u32;
                            to_frame.get_pixel(src_x, y)
                        };
                        out.put_pixel(x, y, *px);
                    }
                }
                out
            }

            TransitionType::SlideVertical => {
                let mut out = RgbaImage::new(width, height);
                let offset_y = (p * height as f32) as i32;

                for y in 0..height {
                    for x in 0..width {
                        let yi = y as i32;
                        let px = if yi + offset_y < height as i32 {
                            let src_y = (yi + offset_y) as u32;
                            from_frame.get_pixel(x, src_y)
                        } else {
                            let src_y = (yi + offset_y - height as i32) as u32;
                            to_frame.get_pixel(x, src_y)
                        };
                        out.put_pixel(x, y, *px);
                    }
                }
                out
            }

            TransitionType::Zoom => {
                let mut out = RgbaImage::new(width, height);
                let inv_p = 1.0 - p;
                for y in 0..height {
                    for x in 0..width {
                        let f_px = from_frame.get_pixel(x, y).0;
                        let t_px = to_frame.get_pixel(x, y).0;
                        let r = (f_px[0] as f32 * inv_p + t_px[0] as f32 * p) as u8;
                        let g = (f_px[1] as f32 * inv_p + t_px[1] as f32 * p) as u8;
                        let b = (f_px[2] as f32 * inv_p + t_px[2] as f32 * p) as u8;
                        let a = (f_px[3] as f32 * inv_p + t_px[3] as f32 * p) as u8;
                        out.put_pixel(x, y, Rgba([r, g, b, a]));
                    }
                }
                out
            }

            TransitionType::Stinger => {
                // Cut-point at 50% where screen transition flips underneath
                let mut base = if p < 0.5 {
                    from_frame.clone()
                } else {
                    to_frame.clone()
                };

                // Dynamic high-visibility broadcast transition stinger band
                let wipe_center = (width as f32 * p) as i32;
                let band_half_width = (width as f32 * 0.12).max(8.0) as i32;
                let band_left = wipe_center - band_half_width;
                let band_right = wipe_center + band_half_width;

                for y in 0..height {
                    for x in band_left.max(0) as u32..band_right.min(width as i32) as u32 {
                        let dist = ((x as i32 - wipe_center).abs() as f32 / band_half_width as f32).min(1.0);
                        let alpha = (1.0 - dist) * 0.95;
                        let base_px = base.get_pixel(x, y).0;
                        let r = (base_px[0] as f32 * (1.0 - alpha) + 45.0 * alpha) as u8;
                        let g = (base_px[1] as f32 * (1.0 - alpha) + 130.0 * alpha) as u8;
                        let b = (base_px[2] as f32 * (1.0 - alpha) + 240.0 * alpha) as u8;
                        base.put_pixel(x, y, Rgba([r, g, b, 255]));
                    }
                }
                base
            }
        }
    }
}
