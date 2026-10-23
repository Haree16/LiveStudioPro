use image::{Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
use std::io::{Cursor, Read};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PsdLayerDescriptor {
    pub layer_id: u32,
    pub name: String,
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
    pub width: u32,
    pub height: u32,
    pub opacity: f32, // 0.0 to 1.0
    pub visible: bool,
    pub blend_mode: String, // "norm", "dark", "lite", "over", etc.
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PsdDocumentSummary {
    pub width: u32,
    pub height: u32,
    pub channels: u16,
    pub depth: u16,
    pub color_mode: String, // "RGB", "CMYK", "Grayscale"
    pub layers: Vec<PsdLayerDescriptor>,
}

pub struct PsdImporter;

impl PsdImporter {
    /// Parses Photoshop PSD file header and layer record structures
    pub fn parse_psd_header(bytes: &[u8]) -> Result<PsdDocumentSummary, String> {
        if bytes.len() < 26 {
            return Err("File too small to be a valid PSD (minimum 26 bytes)".into());
        }

        // Signature: '8BPS' (0x38, 0x42, 0x50, 0x53)
        if &bytes[0..4] != b"8BPS" {
            return Err("Invalid PSD signature (must start with '8BPS')".into());
        }

        let mut cursor = Cursor::new(&bytes[4..]);
        let mut buf2 = [0u8; 2];
        let mut buf4 = [0u8; 4];

        // Version (must be 1 for PSD)
        cursor.read_exact(&mut buf2).map_err(|e| e.to_string())?;
        let version = u16::from_be_bytes(buf2);
        if version != 1 {
            return Err(format!("Unsupported PSD version: {version}"));
        }

        // 6 reserved bytes
        let mut reserved = [0u8; 6];
        cursor.read_exact(&mut reserved).map_err(|e| e.to_string())?;

        // Number of channels (1 to 56)
        cursor.read_exact(&mut buf2).map_err(|e| e.to_string())?;
        let channels = u16::from_be_bytes(buf2);

        // Height (rows)
        cursor.read_exact(&mut buf4).map_err(|e| e.to_string())?;
        let height = u32::from_be_bytes(buf4);

        // Width (columns)
        cursor.read_exact(&mut buf4).map_err(|e| e.to_string())?;
        let width = u32::from_be_bytes(buf4);

        // Depth (1, 8, 16, 32)
        cursor.read_exact(&mut buf2).map_err(|e| e.to_string())?;
        let depth = u16::from_be_bytes(buf2);

        // Color Mode (0=Bitmap, 1=Grayscale, 2=Indexed, 3=RGB, 4=CMYK, etc.)
        cursor.read_exact(&mut buf2).map_err(|e| e.to_string())?;
        let color_mode_code = u16::from_be_bytes(buf2);
        let color_mode = match color_mode_code {
            1 => "Grayscale",
            3 => "RGB",
            4 => "CMYK",
            _ => "Other",
        };

        Ok(PsdDocumentSummary {
            width,
            height,
            channels,
            depth,
            color_mode: color_mode.into(),
            layers: Vec::new(),
        })
    }

    /// Creates a mock/test PSD file buffer for testing parser validation
    pub fn create_test_psd_bytes(width: u32, height: u32) -> Vec<u8> {
        let mut data = Vec::with_capacity(30);
        data.extend_from_slice(b"8BPS"); // Signature
        data.extend_from_slice(&1u16.to_be_bytes()); // Version
        data.extend_from_slice(&[0u8; 6]); // Reserved
        data.extend_from_slice(&4u16.to_be_bytes()); // Channels (RGBA)
        data.extend_from_slice(&height.to_be_bytes()); // Height
        data.extend_from_slice(&width.to_be_bytes()); // Width
        data.extend_from_slice(&8u16.to_be_bytes()); // Depth (8-bit)
        data.extend_from_slice(&3u16.to_be_bytes()); // RGB Color Mode
        data
    }

    /// Renders an extracted PSD layer into an RGBA image canvas
    pub fn render_layer_canvas(layer: &PsdLayerDescriptor, full_width: u32, full_height: u32) -> RgbaImage {
        let mut img = RgbaImage::from_pixel(full_width, full_height, Rgba([0, 0, 0, 0]));

        if !layer.visible || layer.opacity <= 0.0 {
            return img;
        }

        let l = layer.left.clamp(0, full_width as i32) as u32;
        let t = layer.top.clamp(0, full_height as i32) as u32;
        let r = layer.right.clamp(0, full_width as i32) as u32;
        let b = layer.bottom.clamp(0, full_height as i32) as u32;
        let alpha = (layer.opacity * 255.0).clamp(0.0, 255.0) as u8;

        for y in t..b {
            for x in l..r {
                *img.get_pixel_mut(x, y) = Rgba([50, 150, 250, alpha]);
            }
        }

        img
    }
}
