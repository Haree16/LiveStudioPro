use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransitionType {
    Cut,
    Crossfade,
    FadeToBlack,
    WipeHorizontal,
    WipeVertical,
    SlideHorizontal,
    SlideVertical,
    Zoom,
    Stinger,
}

impl Default for TransitionType {
    fn default() -> Self {
        Self::Crossfade
    }
}

impl TransitionType {
    pub fn from_str_name(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "cut" => Self::Cut,
            "crossfade" => Self::Crossfade,
            "fadetoblack" | "fade_to_black" => Self::FadeToBlack,
            "wipehorizontal" | "wipe_horizontal" => Self::WipeHorizontal,
            "wipevertical" | "wipe_vertical" => Self::WipeVertical,
            "slidehorizontal" | "slide_horizontal" => Self::SlideHorizontal,
            "slidevertical" | "slide_vertical" => Self::SlideVertical,
            "zoom" => Self::Zoom,
            "stinger" => Self::Stinger,
            _ => Self::Crossfade,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SubMixBus {
    pub mix_index: u32, // Mix 2 to 16
    pub preview_source_id: Option<String>,
    pub program_source_id: Option<String>,
    pub transition_type: TransitionType,
    pub transition_duration_ms: u32,
    pub in_transition: bool,
    pub transition_progress: f32,
}

impl SubMixBus {
    pub fn new(mix_index: u32) -> Self {
        Self {
            mix_index,
            preview_source_id: None,
            program_source_id: None,
            transition_type: TransitionType::Crossfade,
            transition_duration_ms: 500,
            in_transition: false,
            transition_progress: 0.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FitMode {
    Fit,
    Fill,
    Stretch,
}

impl Default for FitMode {
    fn default() -> Self {
        Self::Fit
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SceneLayer {
    pub id: String,
    pub name: String,
    pub source_id: String, // References an InputItem ID
    pub visible: bool,
    pub z_index: i32,
    pub opacity: f32, // 0.0 to 1.0
    // Normalized transform coordinates (0.0 to 1.0)
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub fit_mode: FitMode,
    // Normalized crop percentages (0.0 to 1.0)
    pub crop_left: f32,
    pub crop_right: f32,
    pub crop_top: f32,
    pub crop_bottom: f32,
}

impl Default for SceneLayer {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Layer".into(),
            source_id: "".into(),
            visible: true,
            z_index: 0,
            opacity: 1.0,
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            fit_mode: FitMode::Fit,
            crop_left: 0.0,
            crop_right: 0.0,
            crop_top: 0.0,
            crop_bottom: 0.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub background_color: String, // Hex string e.g. "#000000"
    pub layers: Vec<SceneLayer>,
}

impl Scene {
    pub fn new(name: impl Into<String>, width: u32, height: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.into(),
            canvas_width: width,
            canvas_height: height,
            background_color: "#000000".into(),
            layers: Vec::new(),
        }
    }

    pub fn with_source(id: impl Into<String>, name: impl Into<String>, source_id: impl Into<String>, width: u32, height: u32) -> Self {
        let s_id = source_id.into();
        let mut scene = Self::new(name, width, height);
        scene.id = id.into();
        scene.layers.push(SceneLayer {
            id: uuid::Uuid::new_v4().to_string(),
            name: "Main Source".into(),
            source_id: s_id,
            visible: true,
            z_index: 0,
            opacity: 1.0,
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
            fit_mode: FitMode::Fit,
            crop_left: 0.0,
            crop_right: 0.0,
            crop_top: 0.0,
            crop_bottom: 0.0,
        });
        scene
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MultiviewLayout {
    Grid2,  // PVW + PGM
    Grid4,  // PVW, PGM + 2 Inputs
    Grid8,  // PVW, PGM + 6 Inputs
    Grid16, // PVW, PGM + 14 Inputs
}

impl Default for MultiviewLayout {
    fn default() -> Self {
        Self::Grid4
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub is_primary: bool,
    pub is_fullscreen_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SwitcherStatus {
    pub preview_source_id: Option<String>,
    pub program_source_id: Option<String>,
    pub preview_scene_id: Option<String>,
    pub program_scene_id: Option<String>,
    pub transition_type: TransitionType,
    pub transition_duration_ms: u32,
    pub is_transitioning: bool,
    pub transition_progress: f32, // 0.0 to 1.0
    pub multiview_layout: MultiviewLayout,
    pub active_display_output: Option<String>,
    pub fallback_policy: String, // "freeze" | "black"
}

impl Default for SwitcherStatus {
    fn default() -> Self {
        Self {
            preview_source_id: None,
            program_source_id: None,
            preview_scene_id: None,
            program_scene_id: None,
            transition_type: TransitionType::Crossfade,
            transition_duration_ms: 500,
            is_transitioning: false,
            transition_progress: 0.0,
            multiview_layout: MultiviewLayout::Grid4,
            active_display_output: None,
            fallback_policy: "freeze".into(),
        }
    }
}
