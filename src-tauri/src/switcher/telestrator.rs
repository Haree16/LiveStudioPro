use image::{Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TelestratorTool {
    Pen,
    Arrow,
    Circle,
    Rectangle,
    Clear,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelestratorPoint {
    pub x: f32, // Normalized 0.0 to 1.0
    pub y: f32, // Normalized 0.0 to 1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TelestratorStroke {
    pub id: String,
    pub tool: TelestratorTool,
    pub color_rgba: [u8; 4], // e.g. [255, 255, 0, 255] for yellow pen
    pub line_width: f32,
    pub points: Vec<TelestratorPoint>,
}

#[derive(Debug, Clone, Default)]
pub struct TelestratorCanvas {
    pub strokes: Vec<TelestratorStroke>,
    pub redo_stack: Vec<TelestratorStroke>,
}

impl TelestratorCanvas {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_stroke(&mut self, stroke: TelestratorStroke) {
        self.strokes.push(stroke);
        self.redo_stack.clear();
    }

    pub fn undo(&mut self) -> bool {
        if let Some(last) = self.strokes.pop() {
            self.redo_stack.push(last);
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self) -> bool {
        if let Some(next) = self.redo_stack.pop() {
            self.strokes.push(next);
            true
        } else {
            false
        }
    }

    pub fn clear(&mut self) {
        self.strokes.clear();
        self.redo_stack.clear();
    }

    /// Renders all strokes onto a transparent RGBA overlay image buffer
    pub fn render_to_overlay(&self, width: u32, height: u32) -> RgbaImage {
        let mut overlay = RgbaImage::from_pixel(width, height, Rgba([0, 0, 0, 0]));

        for stroke in &self.strokes {
            let color = Rgba(stroke.color_rgba);
            let radius = (stroke.line_width * 0.5).max(1.0) as i32;

            for pt in &stroke.points {
                let px = (pt.x * width as f32).round() as i32;
                let py = (pt.y * height as f32).round() as i32;

                for dy in -radius..=radius {
                    for dx in -radius..=radius {
                        if dx * dx + dy * dy <= radius * radius {
                            let x = px + dx;
                            let y = py + dy;
                            if x >= 0 && x < width as i32 && y >= 0 && y < height as i32 {
                                *overlay.get_pixel_mut(x as u32, y as u32) = color;
                            }
                        }
                    }
                }
            }
        }

        overlay
    }
}
