use image::RgbaImage;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tracing::info;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RgbColorTriplet {
    pub r: f32,
    pub g: f32,
    pub b: f32,
}

impl Default for RgbColorTriplet {
    fn default() -> Self {
        Self { r: 1.0, g: 1.0, b: 1.0 }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ColorGradeConfig {
    pub target_id: String, // Input ID, Scene ID, or "master_output"
    pub lift: RgbColorTriplet,   // Shadows: range -1.0 to 1.0, default 0.0
    pub gamma: RgbColorTriplet,  // Midtones: range 0.2 to 4.0, default 1.0
    pub gain: RgbColorTriplet,   // Highlights: range 0.0 to 4.0, default 1.0
    pub temperature: f32,        // Kelvin shift: -100 (cool) to +100 (warm), default 0
    pub tint: f32,               // Magenta / Green shift: -100 to +100, default 0
    pub saturation: f32,         // 0.0 (B&W) to 2.0 (Oversaturated), default 1.0
    pub lut_path: Option<String>,
    pub bypass: bool,
}

impl Default for ColorGradeConfig {
    fn default() -> Self {
        Self {
            target_id: "master_output".into(),
            lift: RgbColorTriplet { r: 0.0, g: 0.0, b: 0.0 },
            gamma: RgbColorTriplet { r: 1.0, g: 1.0, b: 1.0 },
            gain: RgbColorTriplet { r: 1.0, g: 1.0, b: 1.0 },
            temperature: 0.0,
            tint: 0.0,
            saturation: 1.0,
            lut_path: None,
            bypass: false,
        }
    }
}

impl ColorGradeConfig {
    pub fn is_identity(&self) -> bool {
        self.bypass
            || (self.lift.r.abs() < 0.001
                && self.lift.g.abs() < 0.001
                && self.lift.b.abs() < 0.001
                && (self.gamma.r - 1.0).abs() < 0.001
                && (self.gamma.g - 1.0).abs() < 0.001
                && (self.gamma.b - 1.0).abs() < 0.001
                && (self.gain.r - 1.0).abs() < 0.001
                && (self.gain.g - 1.0).abs() < 0.001
                && (self.gain.b - 1.0).abs() < 0.001
                && self.temperature.abs() < 0.001
                && self.tint.abs() < 0.001
                && (self.saturation - 1.0).abs() < 0.001
                && self.lut_path.as_ref().map(|p| p.trim().is_empty()).unwrap_or(true))
    }
}

/// Parsed .CUBE 3D Color Lookup Table (Adobe / DaVinci Resolve standard)
#[derive(Clone)]
pub struct CubeLut3D {
    pub size: usize,
    pub table: Vec<[f32; 3]>,
}

impl CubeLut3D {
    pub fn parse_cube_content(content: &str) -> Result<Self, LiveStudioError> {
        let mut size = 0;
        let mut table = Vec::new();

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            if line.starts_with("LUT_3D_SIZE") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    size = parts[1].parse::<usize>().map_err(|e| {
                        LiveStudioError::validation(format!("Invalid LUT_3D_SIZE: {e}"), Some("lut"))
                    })?;
                }
                continue;
            }

            let nums: Vec<&str> = line.split_whitespace().collect();
            if nums.len() == 3 {
                if let (Ok(r), Ok(g), Ok(b)) = (
                    nums[0].parse::<f32>(),
                    nums[1].parse::<f32>(),
                    nums[2].parse::<f32>(),
                ) {
                    table.push([r.clamp(0.0, 1.0), g.clamp(0.0, 1.0), b.clamp(0.0, 1.0)]);
                }
            }
        }

        if size == 0 || table.len() != size * size * size {
            return Err(LiveStudioError::validation(
                format!("LUT dimensions mismatch: expected {} entries for size {}, found {}", size * size * size, size, table.len()),
                Some("lut"),
            ));
        }

        Ok(Self { size, table })
    }

    pub fn apply_to_rgb(&self, r: f32, g: f32, b: f32) -> (f32, f32, f32) {
        let n = self.size as f32;
        let r_idx = ((r.clamp(0.0, 1.0) * (n - 1.0)).round() as usize).min(self.size - 1);
        let g_idx = ((g.clamp(0.0, 1.0) * (n - 1.0)).round() as usize).min(self.size - 1);
        let b_idx = ((b.clamp(0.0, 1.0) * (n - 1.0)).round() as usize).min(self.size - 1);

        let index = r_idx + g_idx * self.size + b_idx * self.size * self.size;
        if let Some(entry) = self.table.get(index) {
            (entry[0], entry[1], entry[2])
        } else {
            (r, g, b)
        }
    }
}

pub struct ColorGradeEngine {
    grades: Arc<RwLock<HashMap<String, ColorGradeConfig>>>,
    luts: Arc<RwLock<HashMap<String, CubeLut3D>>>,
}

impl ColorGradeEngine {
    pub fn new() -> Self {
        Self {
            grades: Arc::new(RwLock::new(HashMap::new())),
            luts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn set_grade(&self, config: ColorGradeConfig) {
        self.grades.write().insert(config.target_id.clone(), config);
    }

    pub fn get_grade(&self, target_id: &str) -> ColorGradeConfig {
        self.grades
            .read()
            .get(target_id)
            .cloned()
            .unwrap_or_else(|| ColorGradeConfig {
                target_id: target_id.to_string(),
                ..Default::default()
            })
    }

    pub fn has_active_grade(&self, target_id: &str) -> bool {
        self.grades
            .read()
            .get(target_id)
            .map(|g| !g.is_identity())
            .unwrap_or(false)
    }

    pub fn list_grades(&self) -> Vec<ColorGradeConfig> {
        self.grades.read().values().cloned().collect()
    }

    pub fn load_lut_file(&self, path: &Path) -> Result<(), LiveStudioError> {
        let content = std::fs::read_to_string(path).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to read LUT file: {e}"), None)
        })?;

        let lut = CubeLut3D::parse_cube_content(&content)?;
        let key = path.to_string_lossy().to_string();
        self.luts.write().insert(key, lut);
        info!("Loaded 3D LUT: {:?}", path);
        Ok(())
    }

    /// Transforms an RGBA image buffer according to the color grading specification
    pub fn process_image_frame(&self, image: &mut RgbaImage, target_id: &str) {
        let grade = self.get_grade(target_id);
        if grade.is_identity() {
            return;
        }

        let lut_guard = self.luts.read();
        let active_lut = grade.lut_path.as_ref().and_then(|p| lut_guard.get(p));
        let apply_gamma_r = (grade.gamma.r - 1.0).abs() > 0.001 && grade.gamma.r > 0.001;
        let apply_gamma_g = (grade.gamma.g - 1.0).abs() > 0.001 && grade.gamma.g > 0.001;
        let apply_gamma_b = (grade.gamma.b - 1.0).abs() > 0.001 && grade.gamma.b > 0.001;
        let inv_gamma_r = if apply_gamma_r { 1.0 / grade.gamma.r } else { 1.0 };
        let inv_gamma_g = if apply_gamma_g { 1.0 / grade.gamma.g } else { 1.0 };
        let inv_gamma_b = if apply_gamma_b { 1.0 / grade.gamma.b } else { 1.0 };

        for pixel in image.pixels_mut() {
            let mut r = pixel[0] as f32 / 255.0;
            let mut g = pixel[1] as f32 / 255.0;
            let mut b = pixel[2] as f32 / 255.0;

            // 1. Lift (Shadows)
            r = (r + grade.lift.r).max(0.0);
            g = (g + grade.lift.g).max(0.0);
            b = (b + grade.lift.b).max(0.0);

            // 2. Gain (Highlights)
            r *= grade.gain.r;
            g *= grade.gain.g;
            b *= grade.gain.b;

            // 3. Gamma (Midtones power curve)
            if apply_gamma_r { r = r.powf(inv_gamma_r); }
            if apply_gamma_g { g = g.powf(inv_gamma_g); }
            if apply_gamma_b { b = b.powf(inv_gamma_b); }

            // 4. White Balance (Temperature & Tint)
            if grade.temperature != 0.0 {
                let temp_factor = grade.temperature / 100.0 * 0.15;
                r += temp_factor;
                b -= temp_factor;
            }
            if grade.tint != 0.0 {
                let tint_factor = grade.tint / 100.0 * 0.15;
                g -= tint_factor;
                r += tint_factor * 0.5;
                b += tint_factor * 0.5;
            }

            // 5. Saturation
            if (grade.saturation - 1.0).abs() > 0.001 {
                let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                r = luma + grade.saturation * (r - luma);
                g = luma + grade.saturation * (g - luma);
                b = luma + grade.saturation * (b - luma);
            }

            // 6. 3D LUT Mapping if loaded
            if let Some(lut) = active_lut {
                let (lr, lg, lb) = lut.apply_to_rgb(r, g, b);
                r = lr;
                g = lg;
                b = lb;
            }

            pixel[0] = (r.clamp(0.0, 1.0) * 255.0) as u8;
            pixel[1] = (g.clamp(0.0, 1.0) * 255.0) as u8;
            pixel[2] = (b.clamp(0.0, 1.0) * 255.0) as u8;
        }
    }
}
