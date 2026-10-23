use image::{imageops, Rgba, RgbaImage};
use parking_lot::RwLock;
use std::collections::HashMap;
use std::io::Write;
use std::process::Command;
use std::sync::OnceLock;
use crate::graphics::model::{
    GraphicAnimationType, GraphicItem, GraphicTemplateType,
};

static RENDER_CACHE: OnceLock<RwLock<HashMap<(String, u32, u32), RgbaImage>>> = OnceLock::new();

fn render_cache() -> &'static RwLock<HashMap<(String, u32, u32), RgbaImage>> {
    RENDER_CACHE.get_or_init(|| RwLock::new(HashMap::new()))
}

pub struct GraphicsRenderer;

impl GraphicsRenderer {
    /// Parses a hex color like "#3b82f6" or "#ffffff" into an Rgba pixel with alpha
    pub fn parse_hex(hex: &str, alpha: u8) -> Rgba<u8> {
        let clean = hex.trim_start_matches('#');
        if clean.len() >= 6 {
            let r = u8::from_str_radix(&clean[0..2], 16).unwrap_or(0);
            let g = u8::from_str_radix(&clean[2..4], 16).unwrap_or(0);
            let b = u8::from_str_radix(&clean[4..6], 16).unwrap_or(0);
            Rgba([r, g, b, alpha])
        } else {
            Rgba([255, 255, 255, alpha])
        }
    }

    /// Generates a vector SVG document for any GraphicItem
    pub fn generate_template_svg(item: &GraphicItem, width: u32, height: u32) -> String {
        let fields = &item.fields;
        let accent = fields.get("accentColor").map(|s| s.as_str()).unwrap_or("#3b82f6");
        let bg = fields.get("bgColor").map(|s| s.as_str()).unwrap_or("#0f172a");
        let text_color = fields.get("textColor").map(|s| s.as_str()).unwrap_or("#ffffff");

        match item.template_type {
            GraphicTemplateType::LowerThird => {
                let title = fields.get("title").map(|s| s.as_str()).unwrap_or("Title");
                let subtitle = fields.get("subtitle").map(|s| s.as_str()).unwrap_or("Subtitle");
                let category = fields.get("category").map(|s| s.as_str()).unwrap_or("LIVE");

                format!(
                    r##"<svg width="{width}" height="{height}" viewBox="0 0 800 160" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stop-color="{bg}" stop-opacity="0.96"/>
                          <stop offset="70%" stop-color="{bg}" stop-opacity="0.90"/>
                          <stop offset="100%" stop-color="{bg}" stop-opacity="0.0"/>
                        </linearGradient>
                        <filter id="shadow" x="-5%" y="-10%" width="110%" height="130%">
                          <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.6"/>
                        </filter>
                      </defs>
                      <g filter="url(#shadow)">
                        <!-- Accent bar -->
                        <rect x="0" y="5" width="10" height="150" rx="4" fill="{accent}"/>
                        <!-- Main plate -->
                        <path d="M 10 5 L 800 5 L 750 155 L 10 155 Z" fill="url(#bgGrad)"/>
                        <!-- Category tag -->
                        <rect x="24" y="15" width="{cat_w}" height="24" rx="3" fill="{accent}"/>
                        <text x="32" y="32" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="900" fill="#ffffff" letter-spacing="1.5">{category}</text>
                        <!-- Main Title -->
                        <text x="24" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="32" font-weight="bold" fill="{text_color}">{title}</text>
                        <!-- Subtitle -->
                        <text x="24" y="125" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="500" fill="#94a3b8">{subtitle}</text>
                      </g>
                    </svg>"##,
                    width = width,
                    height = height,
                    cat_w = (category.len() * 10 + 20).max(80),
                    category = category.to_uppercase(),
                    accent = accent,
                    bg = bg,
                    text_color = text_color,
                    title = title,
                    subtitle = subtitle,
                )
            }
            GraphicTemplateType::Scoreboard => {
                let team_a = fields.get("teamA").map(|s| s.as_str()).unwrap_or("HOME");
                let score_a = fields.get("scoreA").map(|s| s.as_str()).unwrap_or("0");
                let team_b = fields.get("teamB").map(|s| s.as_str()).unwrap_or("AWAY");
                let score_b = fields.get("scoreB").map(|s| s.as_str()).unwrap_or("0");
                let period = fields.get("period").map(|s| s.as_str()).unwrap_or("1ST");
                let match_time = fields.get("matchTime").map(|s| s.as_str()).unwrap_or("00:00");

                format!(
                    r##"<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <filter id="sbShadow">
                          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.7"/>
                        </filter>
                      </defs>
                      <g filter="url(#sbShadow)">
                        <!-- Main Frame -->
                        <rect x="0" y="0" width="{width}" height="{height}" rx="6" fill="#0f172a" fill-opacity="0.95" stroke="#334155" stroke-width="1.5"/>
                        <!-- Team A chip -->
                        <rect x="0" y="0" width="8" height="{height}" rx="3" fill="#3b82f6"/>
                        <text x="20" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" font-weight="900" fill="#f8fafc">{team_a}</text>
                        <!-- Score A Box -->
                        <rect x="{score_a_x}" y="4" width="45" height="{box_h}" rx="4" fill="#1e293b"/>
                        <text x="{score_a_text_x}" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#38bdf8">{score_a}</text>
                        <!-- Period & Time Center Separator -->
                        <rect x="{period_x}" y="8" width="85" height="{period_h}" rx="4" fill="#0284c7"/>
                        <text x="{period_text_x}" y="{period_text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">{period} • {match_time}</text>
                        <!-- Score B Box -->
                        <rect x="{score_b_x}" y="4" width="45" height="{box_h}" rx="4" fill="#1e293b"/>
                        <text x="{score_b_text_x}" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#f43f5e">{score_b}</text>
                        <!-- Team B -->
                        <text x="{team_b_x}" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" font-weight="900" fill="#f8fafc">{team_b}</text>
                        <!-- Team B chip -->
                        <rect x="{w_sub_8}" y="0" width="8" height="{height}" rx="3" fill="#ef4444"/>
                      </g>
                    </svg>"##,
                    width = width,
                    height = height,
                    text_y = height / 2 + 7,
                    box_h = height.saturating_sub(8),
                    period_h = height.saturating_sub(16),
                    period_text_y = height / 2 + 4,
                    score_a_x = width * 32 / 100,
                    score_a_text_x = width * 32 / 100 + 16,
                    period_x = width * 42 / 100,
                    period_text_x = width * 42 / 100 + 8,
                    score_b_x = width * 62 / 100,
                    score_b_text_x = width * 62 / 100 + 16,
                    team_b_x = width * 74 / 100,
                    w_sub_8 = width.saturating_sub(8),
                    team_a = team_a.to_uppercase(),
                    score_a = score_a,
                    team_b = team_b.to_uppercase(),
                    score_b = score_b,
                    period = period,
                    match_time = match_time,
                )
            }
            GraphicTemplateType::Ticker => {
                let category = fields.get("category").map(|s| s.as_str()).unwrap_or("BREAKING NEWS");
                let headline = fields.get("headline").map(|s| s.as_str()).unwrap_or("Live broadcast feed active");

                format!(
                    r##"<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
                      <!-- Bottom full-width bar -->
                      <rect x="0" y="0" width="{width}" height="{height}" fill="#0f172a" fill-opacity="0.96"/>
                      <!-- Top accent stripe -->
                      <rect x="0" y="0" width="{width}" height="3" fill="{accent}"/>
                      <!-- Category badge box -->
                      <rect x="0" y="3" width="{cat_w}" height="{h_sub_3}" fill="{accent}"/>
                      <text x="24" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="900" fill="#ffffff" letter-spacing="1.5">{category}</text>
                      <!-- Headline ticker text -->
                      <text x="{head_x}" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" font-weight="600" fill="#f8fafc">{headline}</text>
                    </svg>"##,
                    width = width,
                    height = height,
                    h_sub_3 = height.saturating_sub(3),
                    text_y = height / 2 + 6,
                    cat_w = (category.len() * 12 + 40).max(180),
                    head_x = (category.len() * 12 + 65).max(205),
                    accent = accent,
                    category = category.to_uppercase(),
                    headline = headline,
                )
            }
            GraphicTemplateType::StationBug => {
                let badge = fields.get("badgeText").map(|s| s.as_str()).unwrap_or("LIVE");
                let show_clock = fields.get("showClock").map(|s| s == "true").unwrap_or(true);
                let time_str = chrono::Local::now().format("%H:%M:%S").to_string();

                format!(
                    r##"<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0" y="0" width="{width}" height="{height}" rx="5" fill="#0f172a" fill-opacity="0.80" stroke="#334155" stroke-width="1"/>
                      <circle cx="16" cy="{mid_y}" r="5" fill="{accent}"/>
                      <text x="28" y="{text_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" font-weight="900" fill="#f8fafc">{badge}</text>
                      {clock_tag}
                    </svg>"##,
                    width = width,
                    height = height,
                    mid_y = height / 2,
                    text_y = height / 2 + 5,
                    accent = accent,
                    badge = badge,
                    clock_tag = if show_clock {
                        format!(r##"<text x="{}" y="{}" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="600" fill="#94a3b8">{}</text>"##, width.saturating_sub(70), height / 2 + 4, time_str)
                    } else {
                        "".to_string()
                    }
                )
            }
            GraphicTemplateType::Countdown => {
                let title = fields.get("title").map(|s| s.as_str()).unwrap_or("EVENT STARTING IN");
                let secs: u32 = fields.get("secondsRemaining").and_then(|s| s.parse().ok()).unwrap_or(300);
                let mm = secs / 60;
                let ss = secs % 60;
                let formatted_time = format!("{:02}:{:02}", mm, ss);

                format!(
                    r##"<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
                      <rect x="0" y="0" width="{width}" height="{height}" rx="8" fill="#0f172a" fill-opacity="0.95" stroke="{accent}" stroke-width="2"/>
                      <text x="20" y="{mid_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="bold" fill="#94a3b8" letter-spacing="1">{title}</text>
                      <text x="{time_x}" y="{time_y}" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="900" fill="{accent}" letter-spacing="2">{formatted_time}</text>
                    </svg>"##,
                    width = width,
                    height = height,
                    mid_y = height / 2 + 4,
                    time_x = width.saturating_sub(120),
                    time_y = height / 2 + 9,
                    title = title.to_uppercase(),
                    accent = accent,
                    formatted_time = formatted_time,
                )
            }
            GraphicTemplateType::TitleSlate | GraphicTemplateType::Custom => {
                if let Some(ref svg) = item.custom_svg {
                    svg.clone()
                } else {
                    let title = fields.get("title").map(|s| s.as_str()).unwrap_or("LiveStudio Pro");
                    let subtitle = fields.get("subtitle").map(|s| s.as_str()).unwrap_or("Broadcast Presentation");

                    format!(
                        r##"<svg width="{width}" height="{height}" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="0" width="{width}" height="{height}" fill="{bg}" fill-opacity="0.95"/>
                          <rect x="0" y="0" width="12" height="{height}" fill="{accent}"/>
                          <text x="40" y="{mid_y_sub_15}" font-family="DejaVu Sans, Arial, sans-serif" font-size="36" font-weight="bold" fill="{text_color}">{title}</text>
                          <text x="40" y="{mid_y_add_25}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="normal" fill="#94a3b8">{subtitle}</text>
                        </svg>"##,
                        width = width,
                        height = height,
                        mid_y_sub_15 = height / 2 - 10,
                        mid_y_add_25 = height / 2 + 30,
                        bg = bg,
                        accent = accent,
                        text_color = text_color,
                        title = title,
                        subtitle = subtitle,
                    )
                }
            }
        }
    }

    /// Renders an SVG string into an RgbaImage using rsvg-convert (fast vector rasterizer)
    /// If rsvg-convert is unavailable or fails, gracefully falls back to a clean procedural frame
    pub fn render_svg_to_image(svg_content: &str, width: u32, height: u32) -> RgbaImage {
        let child = Command::new("rsvg-convert")
            .arg("-w")
            .arg(width.to_string())
            .arg("-h")
            .arg(height.to_string())
            .arg("-f")
            .arg("png")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn();

        if let Ok(mut proc) = child {
            if let Some(ref mut stdin) = proc.stdin {
                let _ = stdin.write_all(svg_content.as_bytes());
            }
            if let Ok(output) = proc.wait_with_output() {
                if output.status.success() && !output.stdout.is_empty() {
                    if let Ok(img) = image::load_from_memory_with_format(&output.stdout, image::ImageFormat::Png) {
                        return img.to_rgba8();
                    }
                }
            }
        }

        // Fallback: procedural rendering if rsvg-convert is absent
        Self::procedural_fallback_image(width, height)
    }

    fn procedural_fallback_image(width: u32, height: u32) -> RgbaImage {
        let mut img = RgbaImage::from_pixel(width, height, Rgba([15, 23, 42, 235]));
        // Add accent line on left
        for y in 0..height {
            for x in 0..8.min(width) {
                img.put_pixel(x, y, Rgba([59, 130, 246, 255]));
            }
        }
        img
    }

    /// Fits an RGBA source frame onto a transparent target_w x target_h canvas preserving aspect ratio
    pub fn fit_rgba_onto_canvas(src_rgba: &RgbaImage, target_w: u32, target_h: u32) -> RgbaImage {
        let (sw, sh) = src_rgba.dimensions();
        if sw == 0 || sh == 0 {
            return RgbaImage::from_pixel(target_w, target_h, Rgba([0, 0, 0, 0]));
        }
        let scale = (target_w as f32 / sw as f32).min(target_h as f32 / sh as f32);
        let rw = ((sw as f32 * scale) as u32).max(1).min(target_w);
        let rh = ((sh as f32 * scale) as u32).max(1).min(target_h);
        let resized = imageops::resize(src_rgba, rw, rh, imageops::FilterType::Nearest);
        let mut canvas = RgbaImage::from_pixel(target_w, target_h, Rgba([0, 0, 0, 0]));
        // Overlay flush to top-left (0, 0) of target box so absolute positioning (x=0, y=0) goes directly to edge
        imageops::overlay(&mut canvas, &resized, 0, 0);
        canvas
    }

    /// Fast scanner to find the bounding box of non-key content in an image (e.g. green screen video badge/title)
    pub fn find_chroma_content_bbox(
        img: &RgbaImage,
        key_color_hex: &str,
        tolerance: f32,
    ) -> Option<(u32, u32, u32, u32)> {
        let key_rgba = Self::parse_hex(key_color_hex, 255);
        let (kr, kg, kb) = (key_rgba[0] as f32, key_rgba[1] as f32, key_rgba[2] as f32);
        let dist_thresh = (tolerance.max(0.15)) * 441.67;
        let is_green_screen = kg > kr + 20.0 && kg > kb + 20.0;
        let (w, h) = img.dimensions();

        let mut min_x = w;
        let mut min_y = h;
        let mut max_x = 0;
        let mut max_y = 0;
        let mut found = false;

        let step_x = (w / 40).max(8);
        let step_y = (h / 40).max(8);

        for y in (0..h).step_by(step_y as usize) {
            for x in (0..w).step_by(step_x as usize) {
                let px = img.get_pixel(x, y);
                if px[3] < 20 {
                    continue;
                }
                let (r, g, b) = (px[0] as f32, px[1] as f32, px[2] as f32);
                let dr = r - kr;
                let dg = g - kg;
                let db = b - kb;
                let dist = (dr * dr + dg * dg + db * db).sqrt();

                let is_key_color = if is_green_screen {
                    let g_dom = g - r.max(b);
                    dist < dist_thresh || g_dom > (30.0 * (1.0 - tolerance.min(0.8)))
                } else {
                    dist < dist_thresh
                };

                if !is_key_color {
                    found = true;
                    if x < min_x { min_x = x; }
                    if y < min_y { min_y = y; }
                    if x > max_x { max_x = x; }
                    if y > max_y { max_y = y; }
                }
            }
        }

        if found && max_x >= min_x && max_y >= min_y {
            let pad = 16;
            let x0 = min_x.saturating_sub(pad);
            let y0 = min_y.saturating_sub(pad);
            let x1 = (max_x + pad).min(w.saturating_sub(1));
            let y1 = (max_y + pad).min(h.saturating_sub(1));
            Some((x0, y0, (x1 - x0 + 1).max(1), (y1 - y0 + 1).max(1)))
        } else {
            None
        }
    }

    pub fn process_source_frame_with_crop(src_rgba: &RgbaImage, item: &GraphicItem) -> RgbaImage {
        let (sw, sh) = src_rgba.dimensions();
        if sw == 0 || sh == 0 {
            return src_rgba.clone();
        }

        let auto_trim = item.fields.get("autoTrimChroma").map(|s| s == "true").unwrap_or(false);

        if auto_trim {
            let key_hex = item.fields.get("keyColorHex").map(|s| s.as_str()).unwrap_or("#00FF00");
            let tol: f32 = item.fields.get("chromaTolerance").and_then(|s| s.parse().ok()).unwrap_or(0.35);
            if let Some((x0, y0, cw, ch)) = Self::find_chroma_content_bbox(src_rgba, key_hex, tol) {
                if cw > 16 && ch > 16 && (cw < sw || ch < sh) {
                    return imageops::crop_imm(src_rgba, x0, y0, cw, ch).to_image();
                }
            }
        }

        let crop_left: f32 = item.fields.get("cropLeft").and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0f32).clamp(0.0f32, 0.49f32);
        let crop_top: f32 = item.fields.get("cropTop").and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0f32).clamp(0.0f32, 0.49f32);
        let crop_right: f32 = item.fields.get("cropRight").and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0f32).clamp(0.0f32, 0.49f32);
        let crop_bottom: f32 = item.fields.get("cropBottom").and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0f32).clamp(0.0f32, 0.49f32);

        if crop_left > 0.0 || crop_top > 0.0 || crop_right > 0.0 || crop_bottom > 0.0 {
            let x0 = (sw as f32 * crop_left) as u32;
            let y0 = (sh as f32 * crop_top) as u32;
            let cw = ((sw as f32 * (1.0 - crop_left - crop_right)) as u32).max(1).min(sw.saturating_sub(x0));
            let ch = ((sh as f32 * (1.0 - crop_top - crop_bottom)) as u32).max(1).min(sh.saturating_sub(y0));
            return imageops::crop_imm(src_rgba, x0, y0, cw, ch).to_image();
        }

        src_rgba.clone()
    }

    /// Renders a GraphicItem at its designated scale on a transparent canvas
    pub fn render_graphic_item(item: &GraphicItem, canvas_width: u32, canvas_height: u32) -> RgbaImage {
        Self::render_graphic_item_with_source(item, canvas_width, canvas_height, None)
    }

    pub fn render_graphic_item_with_source(
        item: &GraphicItem,
        canvas_width: u32,
        canvas_height: u32,
        live_source_frame: Option<&RgbaImage>,
    ) -> RgbaImage {
        let target_w = ((item.width * canvas_width as f32) as u32).max(24);
        let target_h = ((item.height * canvas_height as f32) as u32).max(24);

        // 1. If a live video/input frame is provided for this overlay, crop if needed and scale/fit it directly
        if let Some(src_rgba) = live_source_frame {
            let processed = Self::process_source_frame_with_crop(src_rgba, item);
            return Self::fit_rgba_onto_canvas(&processed, target_w, target_h);
        }

        // 2. If an imagePath is specified on the GraphicItem, load and fit the image preserving aspect ratio & alpha
        if let Some(img_path) = item.fields.get("imagePath") {
            let trimmed = img_path.trim();
            if !trimmed.is_empty() {
                let cache_key = (format!("img:{trimmed}"), target_w, target_h);
                if let Some(cached) = render_cache().read().get(&cache_key) {
                    return cached.clone();
                }
                if let Ok(dyn_img) = image::open(trimmed) {
                    let src_rgba = dyn_img.to_rgba8();
                    let processed = Self::process_source_frame_with_crop(&src_rgba, item);
                    let canvas = Self::fit_rgba_onto_canvas(&processed, target_w, target_h);
                    let mut guard = render_cache().write();
                    if guard.len() > 64 {
                        guard.clear();
                    }
                    guard.insert(cache_key, canvas.clone());
                    return canvas;
                }
            }
        }

        let svg_str = Self::generate_template_svg(item, target_w, target_h);
        let cache_key = (svg_str.clone(), target_w, target_h);
        if let Some(cached) = render_cache().read().get(&cache_key) {
            return cached.clone();
        }
        let rendered = Self::render_svg_to_image(&svg_str, target_w, target_h);
        let mut guard = render_cache().write();
        if guard.len() > 64 {
            guard.clear();
        }
        guard.insert(cache_key, rendered.clone());
        rendered
    }

    /// Composites a GraphicItem with transition animation directly onto an existing RGBA frame
    pub fn composite_graphic_on_canvas(
        canvas: &mut RgbaImage,
        item: &GraphicItem,
        progress: f32, // 0.0 (off) to 1.0 (fully on)
        is_transitioning_out: bool,
    ) {
        Self::composite_graphic_on_canvas_with_source(canvas, item, progress, is_transitioning_out, None);
    }

    pub fn composite_graphic_on_canvas_with_source(
        canvas: &mut RgbaImage,
        item: &GraphicItem,
        progress: f32, // 0.0 (off) to 1.0 (fully on)
        is_transitioning_out: bool,
        live_source_frame: Option<&RgbaImage>,
    ) {
        if progress <= 0.001 {
            return;
        }

        let (c_w, c_h) = canvas.dimensions();
        let mut rendered = Self::render_graphic_item_with_source(item, c_w, c_h, live_source_frame);

        // Check if chroma key (green screen) is enabled on this graphic overlay item
        let chroma_enabled = item.fields.get("chromaKeyEnabled").map(|s| s == "true").unwrap_or(false);
        if chroma_enabled && live_source_frame.is_none() {
            let key_hex = item.fields.get("keyColorHex").map(|s| s.as_str()).unwrap_or("#00FF00");
            let tol: f32 = item.fields.get("chromaTolerance").and_then(|s| s.parse().ok()).unwrap_or(0.35);
            let feather: f32 = item.fields.get("chromaFeather").and_then(|s| s.parse().ok()).unwrap_or(0.15);
            crate::broadcast::virtual_studio::VirtualStudioEngine::apply_chroma_key(&mut rendered, key_hex, tol, feather);
        }

        let (g_w, g_h) = rendered.dimensions();

        // Calculate target on-screen coordinates
        let base_x = (item.x * c_w as f32) as i32;
        let base_y = (item.y * c_h as f32) as i32;

        let anim_type = if is_transitioning_out {
            item.animation.out_type.clone()
        } else {
            item.animation.in_type.clone()
        };

        // Smooth cubic ease-out
        let t = progress.clamp(0.0, 1.0);
        let ease = 1.0 - (1.0 - t).powi(3);

        let (mut cur_x, mut cur_y, mut opacity) = (base_x, base_y, item.opacity);

        match anim_type {
            GraphicAnimationType::Cut => {
                if progress < 0.5 {
                    return;
                }
            }
            GraphicAnimationType::Fade => {
                opacity *= ease;
            }
            GraphicAnimationType::FlyLeft => {
                let offset = ((1.0 - ease) * (g_w as f32 + base_x as f32)) as i32;
                cur_x -= offset;
            }
            GraphicAnimationType::FlyRight => {
                let offset = ((1.0 - ease) * (c_w as f32 - base_x as f32)) as i32;
                cur_x += offset;
            }
            GraphicAnimationType::FlyBottom => {
                let offset = ((1.0 - ease) * (c_h as f32 - base_y as f32)) as i32;
                cur_y += offset;
            }
            GraphicAnimationType::FlyTop => {
                let offset = ((1.0 - ease) * (g_h as f32 + base_y as f32)) as i32;
                cur_y -= offset;
            }
            GraphicAnimationType::Zoom => {
                opacity *= ease;
            }
        }

        if opacity <= 0.001 {
            return;
        }

        // Alpha blend graphic onto canvas
        for gy in 0..g_h {
            let cy = cur_y + gy as i32;
            if cy < 0 || cy >= c_h as i32 {
                continue;
            }

            for gx in 0..g_w {
                let cx = cur_x + gx as i32;
                if cx < 0 || cx >= c_w as i32 {
                    continue;
                }

                let src_px = rendered.get_pixel(gx, gy).0;
                let src_alpha = (src_px[3] as f32 / 255.0) * opacity;
                if src_alpha <= 0.001 {
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
}
