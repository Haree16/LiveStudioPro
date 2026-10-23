use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GraphicTemplateType {
    LowerThird,
    Scoreboard,
    Ticker,
    StationBug,
    Countdown,
    TitleSlate,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GraphicAnimationType {
    Cut,
    Fade,
    FlyLeft,
    FlyRight,
    FlyBottom,
    FlyTop,
    Zoom,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicAnimation {
    pub in_type: GraphicAnimationType,
    pub out_type: GraphicAnimationType,
    pub duration_ms: u32,
    pub auto_out_ms: Option<u32>,
}

impl Default for GraphicAnimation {
    fn default() -> Self {
        Self {
            in_type: GraphicAnimationType::FlyLeft,
            out_type: GraphicAnimationType::FlyLeft,
            duration_ms: 350,
            auto_out_ms: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicItem {
    pub id: String,
    pub name: String,
    pub template_type: GraphicTemplateType,
    pub x: f32, // Normalized 0.0 to 1.0 (relative to 1920x1080)
    pub y: f32,
    pub width: f32,
    pub height: f32,
    pub opacity: f32,
    pub z_index: i32,
    pub fields: HashMap<String, String>,
    pub animation: GraphicAnimation,
    pub custom_svg: Option<String>,
    pub is_active: bool,
}

impl GraphicItem {
    pub fn new_lower_third(name: &str, title: &str, subtitle: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("title".into(), title.into());
        fields.insert("subtitle".into(), subtitle.into());
        fields.insert("category".into(), "LIVE BROADCAST".into());
        fields.insert("accentColor".into(), "#3b82f6".into()); // Blue accent
        fields.insert("bgColor".into(), "#0f172a".into());     // Dark slate
        fields.insert("textColor".into(), "#ffffff".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::LowerThird,
            x: 0.05,
            y: 0.80,
            width: 0.55,
            height: 0.14,
            opacity: 1.0,
            z_index: 10,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::FlyLeft,
                out_type: GraphicAnimationType::FlyLeft,
                duration_ms: 350,
                auto_out_ms: Some(6000), // 6 sec auto-out for lower thirds
            },
            custom_svg: None,
            is_active: false,
        }
    }

    pub fn new_scoreboard(name: &str, team_a: &str, team_b: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("teamA".into(), team_a.into());
        fields.insert("scoreA".into(), "0".into());
        fields.insert("teamB".into(), team_b.into());
        fields.insert("scoreB".into(), "0".into());
        fields.insert("period".into(), "1ST".into());
        fields.insert("matchTime".into(), "12:00".into());
        fields.insert("accentColor".into(), "#ef4444".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::Scoreboard,
            x: 0.05,
            y: 0.05,
            width: 0.40,
            height: 0.08,
            opacity: 1.0,
            z_index: 20,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::FlyTop,
                out_type: GraphicAnimationType::FlyTop,
                duration_ms: 400,
                auto_out_ms: None,
            },
            custom_svg: None,
            is_active: false,
        }
    }

    pub fn new_ticker(name: &str, category: &str, headline: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("category".into(), category.into());
        fields.insert("headline".into(), headline.into());
        fields.insert("accentColor".into(), "#dc2626".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::Ticker,
            x: 0.0,
            y: 0.94,
            width: 1.0,
            height: 0.06,
            opacity: 1.0,
            z_index: 30,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::FlyBottom,
                out_type: GraphicAnimationType::FlyBottom,
                duration_ms: 300,
                auto_out_ms: None,
            },
            custom_svg: None,
            is_active: false,
        }
    }

    pub fn new_station_bug(name: &str, badge_text: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("badgeText".into(), badge_text.into());
        fields.insert("showClock".into(), "true".into());
        fields.insert("accentColor".into(), "#10b981".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::StationBug,
            x: 0.85,
            y: 0.04,
            width: 0.12,
            height: 0.06,
            opacity: 0.9,
            z_index: 40,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::Fade,
                out_type: GraphicAnimationType::Fade,
                duration_ms: 500,
                auto_out_ms: None,
            },
            custom_svg: None,
            is_active: false,
        }
    }

    pub fn new_countdown(name: &str, target_seconds: u32, title: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("title".into(), title.into());
        fields.insert("secondsRemaining".into(), target_seconds.to_string());
        fields.insert("accentColor".into(), "#8b5cf6".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::Countdown,
            x: 0.35,
            y: 0.05,
            width: 0.30,
            height: 0.08,
            opacity: 1.0,
            z_index: 25,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::FlyTop,
                out_type: GraphicAnimationType::Fade,
                duration_ms: 350,
                auto_out_ms: None,
            },
            custom_svg: None,
            is_active: false,
        }
    }

    pub fn new_title_slate(name: &str, title: &str, subtitle: &str) -> Self {
        let mut fields = HashMap::new();
        fields.insert("title".into(), title.into());
        fields.insert("subtitle".into(), subtitle.into());
        fields.insert("accentColor".into(), "#3b82f6".into());
        fields.insert("bgColor".into(), "#0f172a".into());
        fields.insert("textColor".into(), "#ffffff".into());

        Self {
            id: format!("gfx-{}", Uuid::new_v4()),
            name: name.into(),
            template_type: GraphicTemplateType::TitleSlate,
            x: 0.15,
            y: 0.25,
            width: 0.70,
            height: 0.50,
            opacity: 1.0,
            z_index: 30,
            fields,
            animation: GraphicAnimation {
                in_type: GraphicAnimationType::Fade,
                out_type: GraphicAnimationType::Fade,
                duration_ms: 500,
                auto_out_ms: None,
            },
            custom_svg: None,
            is_active: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TransitionDirection {
    In,
    Out,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OverlayChannelState {
    pub channel_index: usize, // 1, 2, 3, or 4
    pub graphic_id: Option<String>,
    pub is_on_air: bool,
    pub is_transitioning: bool,
    pub transition_progress: f32, // 0.0 to 1.0
    pub transition_direction: TransitionDirection,
    #[serde(skip)]
    pub start_timestamp_ms: Option<u64>,
}

impl OverlayChannelState {
    pub fn new(index: usize) -> Self {
        Self {
            channel_index: index,
            graphic_id: None,
            is_on_air: false,
            is_transitioning: false,
            transition_progress: 0.0,
            transition_direction: TransitionDirection::In,
            start_timestamp_ms: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DataSourceType {
    Csv,
    Json,
    RestApi,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DataSourceRecord {
    pub id: String,
    pub name: String,
    pub source_type: DataSourceType,
    pub path_or_url: String,
    pub poll_interval_secs: u32,
    pub selected_row: usize,
    pub headers: Vec<String>,
    pub rows: Vec<HashMap<String, String>>,
    pub last_updated_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FieldBinding {
    pub graphic_id: String,
    pub field_key: String,
    pub data_source_id: String,
    pub column_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicsProjectConfig {
    pub items: Vec<GraphicItem>,
    pub overlay_channels: Vec<OverlayChannelState>,
    pub selected_graphic_id: Option<String>,
    #[serde(default)]
    pub data_sources: Vec<DataSourceRecord>,
    #[serde(default)]
    pub bindings: Vec<FieldBinding>,
}

impl Default for GraphicsProjectConfig {
    fn default() -> Self {
        Self {
            items: vec![
                GraphicItem::new_lower_third("Presenter Title", "Dr. Jane Reynolds", "Lead Video Production Architect"),
                GraphicItem::new_scoreboard("Main Scoreboard", "EAGLES", "PATRIOTS"),
                GraphicItem::new_ticker("News Ticker", "BREAKING NEWS", "LiveStudio Pro Phase 5 Graphics & Overlay Engine Launched"),
                GraphicItem::new_station_bug("Channel Bug", "LIVE PRO"),
            ],
            overlay_channels: vec![
                OverlayChannelState::new(1),
                OverlayChannelState::new(2),
                OverlayChannelState::new(3),
                OverlayChannelState::new(4),
            ],
            selected_graphic_id: None,
            data_sources: Vec::new(),
            bindings: Vec::new(),
        }
    }
}
