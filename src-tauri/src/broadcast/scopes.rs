use image::RgbaImage;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WaveformHistogram {
    pub columns: usize,
    pub bins: usize,       // Typically 256 (0 to 100 IRE or 0 to 255 Y)
    pub data: Vec<u16>,    // 2D grid flattened: columns * bins
    pub max_intensity: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VectorscopeGrid {
    pub resolution: usize, // Typically 256x256
    pub grid: Vec<u16>,    // 256 * 256 UV chrominance intensity map
    pub max_intensity: u16,
}

pub struct BroadcastScopesAnalyzer;

impl BroadcastScopesAnalyzer {
    /// Computes a real-time luminance (IRE) waveform from an RGBA video frame
    pub fn compute_waveform(frame: &RgbaImage, target_columns: usize) -> WaveformHistogram {
        let (width, height) = frame.dimensions();
        let cols = target_columns.clamp(64, 1920).min(width as usize);
        let bins = 256;
        let mut data = vec![0u16; cols * bins];
        let mut max_val = 0u16;

        if width == 0 || height == 0 {
            return WaveformHistogram {
                columns: cols,
                bins,
                data,
                max_intensity: 0,
            };
        }

        let col_step = width as f32 / cols as f32;

        for x_col in 0..cols {
            let src_x = ((x_col as f32 * col_step) as u32).min(width - 1);
            for src_y in 0..height {
                let p = frame.get_pixel(src_x, src_y);
                // BT.709 Luma calculation: Y = 0.2126*R + 0.7152*G + 0.0722*B
                let y = (0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32)
                    .clamp(0.0, 255.0) as usize;

                let idx = x_col * bins + y;
                data[idx] = data[idx].saturating_add(1);
                if data[idx] > max_val {
                    max_val = data[idx];
                }
            }
        }

        WaveformHistogram {
            columns: cols,
            bins,
            data,
            max_intensity: max_val,
        }
    }

    /// Computes a chrominance vectorscope plot (UV color scatter) from an RGBA video frame
    pub fn compute_vectorscope(frame: &RgbaImage, resolution: usize) -> VectorscopeGrid {
        let (width, height) = frame.dimensions();
        let res = resolution.clamp(128, 512);
        let mut grid = vec![0u16; res * res];
        let mut max_val = 0u16;

        if width == 0 || height == 0 {
            return VectorscopeGrid {
                resolution: res,
                grid,
                max_intensity: 0,
            };
        }

        let center = (res / 2) as f32;
        let scale = (res as f32 * 0.45) / 128.0;

        for p in frame.pixels() {
            let r = p[0] as f32;
            let g = p[1] as f32;
            let b = p[2] as f32;

            // Rec.709 RGB to YUV:
            // U = -0.1145*R - 0.3854*G + 0.5000*B
            // V =  0.5000*R - 0.4542*G - 0.0458*B
            let u = -0.1145 * r - 0.3854 * g + 0.5000 * b;
            let v = 0.5000 * r - 0.4542 * g - 0.0458 * b;

            let grid_x = (center + u * scale).round() as i32;
            let grid_y = (center - v * scale).round() as i32; // Inverted Y for polar presentation

            if grid_x >= 0 && grid_x < res as i32 && grid_y >= 0 && grid_y < res as i32 {
                let idx = (grid_y as usize) * res + (grid_x as usize);
                grid[idx] = grid[idx].saturating_add(1);
                if grid[idx] > max_val {
                    max_val = grid[idx];
                }
            }
        }

        VectorscopeGrid {
            resolution: res,
            grid,
            max_intensity: max_val,
        }
    }
}
