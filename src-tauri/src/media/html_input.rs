use image::{Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HtmlInputConfig {
    pub url: String,
    pub width: u32,
    pub height: u32,
    pub framerate: u32,
    pub transparent_background: bool,
    pub custom_css: Option<String>,
    pub custom_js: Option<String>,
}

impl Default for HtmlInputConfig {
    fn default() -> Self {
        Self {
            url: "https://example.com/overlay".into(),
            width: 1920,
            height: 1080,
            framerate: 60,
            transparent_background: true,
            custom_css: None,
            custom_js: None,
        }
    }
}

pub struct HtmlInputEngine;

impl HtmlInputEngine {
    /// Builds GStreamer offscreen browser rendering pipeline
    pub fn build_browser_pipeline(config: &HtmlInputConfig) -> String {
        let _bg_color = if config.transparent_background { "0x00000000" } else { "0xFFFFFFFF" };
        format!(
            "appsrc name=browser_src is-live=true format=time ! \
             videoconvert ! \
             video/x-raw,format=RGBA,width={},height={},framerate={}/1 ! \
             appsink name=sink sync=false",
            config.width, config.height, config.framerate
        )
    }

    /// Renders a synthetic transparent HTML overlay texture frame for offscreen preview
    pub fn render_html_placeholder(config: &HtmlInputConfig, _text: &str) -> RgbaImage {
        let mut img = if config.transparent_background {
            RgbaImage::from_pixel(config.width, config.height, Rgba([0, 0, 0, 0]))
        } else {
            RgbaImage::from_pixel(config.width, config.height, Rgba([255, 255, 255, 255]))
        };

        // Render a basic colored badge at top-right indicating active web URL
        let badge_w = 400.min(config.width);
        let badge_h = 60.min(config.height);
        let start_x = config.width.saturating_sub(badge_w + 20);
        let start_y = 20;

        for y in start_y..(start_y + badge_h) {
            for x in start_x..(start_x + badge_w) {
                if x < config.width && y < config.height {
                    *img.get_pixel_mut(x, y) = Rgba([30, 144, 255, 220]); // DodgerBlue with alpha
                }
            }
        }

        img
    }
}
