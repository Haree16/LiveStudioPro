use image::RgbaImage;
use parking_lot::RwLock;
use std::sync::Arc;
use std::time::Instant;
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::graphics::model::{
    DataSourceRecord, FieldBinding, GraphicItem, GraphicsProjectConfig, TransitionDirection,
};
use crate::graphics::renderer::GraphicsRenderer;

struct ActiveOverlayTransition {
    start_time: Instant,
    duration_ms: u32,
    direction: TransitionDirection,
    on_air_since: Option<Instant>,
    auto_out_ms: Option<u32>,
}

pub struct NativeGraphicsEngine {
    config: Arc<RwLock<GraphicsProjectConfig>>,
    channel_transitions: Arc<RwLock<Vec<Option<ActiveOverlayTransition>>>>,
}

impl NativeGraphicsEngine {
    pub fn new() -> Result<Self, LiveStudioError> {
        let config = GraphicsProjectConfig::default();
        let transitions = vec![None, None, None, None]; // 4 overlay channels

        Ok(Self {
            config: Arc::new(RwLock::new(config)),
            channel_transitions: Arc::new(RwLock::new(transitions)),
        })
    }

    pub fn get_config(&self) -> GraphicsProjectConfig {
        let mut cfg = self.config.read().clone();
        // Update live transition progress into states
        let trans = self.channel_transitions.read();
        for ch in &mut cfg.overlay_channels {
            let idx = ch.channel_index.saturating_sub(1);
            if let Some(Some(t)) = trans.get(idx) {
                let elapsed = t.start_time.elapsed().as_millis() as f32;
                let dur = t.duration_ms.max(1) as f32;
                let raw_p = (elapsed / dur).clamp(0.0, 1.0);
                ch.is_transitioning = raw_p < 1.0;
                ch.transition_progress = if t.direction == TransitionDirection::In {
                    raw_p
                } else {
                    1.0 - raw_p
                };
                ch.transition_direction = t.direction.clone();
                if t.direction == TransitionDirection::Out && raw_p >= 1.0 {
                    ch.is_on_air = false;
                }
            }
        }
        cfg
    }

    pub fn load_config(&self, new_config: GraphicsProjectConfig) {
        *self.config.write() = new_config;
        *self.channel_transitions.write() = vec![None, None, None, None];
    }

    pub fn save_item(&self, item: GraphicItem) {
        let mut cfg = self.config.write();
        if let Some(pos) = cfg.items.iter().position(|i| i.id == item.id) {
            cfg.items[pos] = item;
        } else {
            cfg.items.push(item);
        }
    }

    pub fn delete_item(&self, id: &str) -> bool {
        let mut cfg = self.config.write();
        let len_before = cfg.items.len();
        cfg.items.retain(|i| i.id != id);

        // Remove from any overlay channel referencing it
        for ch in &mut cfg.overlay_channels {
            if ch.graphic_id.as_deref() == Some(id) {
                ch.graphic_id = None;
                ch.is_on_air = false;
            }
        }

        cfg.items.len() < len_before
    }

    pub fn assign_to_overlay(&self, overlay_idx: usize, graphic_id: &str) -> Result<(), LiveStudioError> {
        if !(1..=4).contains(&overlay_idx) {
            return Err(LiveStudioError::validation("Overlay channel must be 1 to 4", None));
        }

        let mut cfg = self.config.write();
        let exists = cfg.items.iter().any(|i| i.id == graphic_id);
        if !exists {
            return Err(LiveStudioError::validation("Graphic item not found", Some("graphicId")));
        }

        if let Some(ch) = cfg.overlay_channels.iter_mut().find(|c| c.channel_index == overlay_idx) {
            ch.graphic_id = Some(graphic_id.to_string());
            info!("Assigned graphic '{graphic_id}' to Overlay Channel {overlay_idx}");
            Ok(())
        } else {
            Err(LiveStudioError::validation("Overlay channel not found", None))
        }
    }

    pub fn take_overlay_on_air(&self, overlay_idx: usize) -> Result<(), LiveStudioError> {
        if !(1..=4).contains(&overlay_idx) {
            return Err(LiveStudioError::validation("Overlay channel must be 1 to 4", None));
        }

        let mut cfg = self.config.write();
        let (graphic_id, duration, auto_out) = {
            let ch = cfg
                .overlay_channels
                .iter()
                .find(|c| c.channel_index == overlay_idx)
                .ok_or_else(|| LiveStudioError::validation("Overlay channel not found", None))?;

            let gid = ch.graphic_id.clone().ok_or_else(|| {
                LiveStudioError::validation(format!("No graphic assigned to Overlay {overlay_idx}"), None)
            })?;

            let item = cfg
                .items
                .iter()
                .find(|i| i.id == gid)
                .ok_or_else(|| LiveStudioError::validation("Assigned graphic not found", None))?;

            (gid, item.animation.duration_ms, item.animation.auto_out_ms)
        };

        if let Some(ch) = cfg.overlay_channels.iter_mut().find(|c| c.channel_index == overlay_idx) {
            ch.is_on_air = true;
            ch.is_transitioning = true;
            ch.transition_progress = 0.0;
            ch.transition_direction = TransitionDirection::In;
        }

        let slot = overlay_idx - 1;
        self.channel_transitions.write()[slot] = Some(ActiveOverlayTransition {
            start_time: Instant::now(),
            duration_ms: duration,
            direction: TransitionDirection::In,
            on_air_since: None,
            auto_out_ms: auto_out,
        });

        info!("TAKE ON AIR: Overlay {overlay_idx} with graphic '{graphic_id}'");
        Ok(())
    }

    pub fn take_overlay_off_air(&self, overlay_idx: usize) -> Result<(), LiveStudioError> {
        if !(1..=4).contains(&overlay_idx) {
            return Err(LiveStudioError::validation("Overlay channel must be 1 to 4", None));
        }

        let mut cfg = self.config.write();
        let (is_on_air, duration) = {
            let ch = cfg
                .overlay_channels
                .iter()
                .find(|c| c.channel_index == overlay_idx)
                .ok_or_else(|| LiveStudioError::validation("Overlay channel not found", None))?;

            let dur = if let Some(ref gid) = ch.graphic_id {
                cfg.items
                    .iter()
                    .find(|i| i.id == *gid)
                    .map(|i| i.animation.duration_ms)
                    .unwrap_or(300)
            } else {
                300
            };

            (ch.is_on_air, dur)
        };

        if !is_on_air {
            return Ok(());
        }

        if let Some(ch) = cfg.overlay_channels.iter_mut().find(|c| c.channel_index == overlay_idx) {
            ch.is_on_air = false;
            ch.is_transitioning = true;
            ch.transition_progress = 1.0;
            ch.transition_direction = TransitionDirection::Out;
        }

        let slot = overlay_idx - 1;
        self.channel_transitions.write()[slot] = Some(ActiveOverlayTransition {
            start_time: Instant::now(),
            duration_ms: duration,
            direction: TransitionDirection::Out,
            on_air_since: None,
            auto_out_ms: None,
        });

        info!("TAKE OFF AIR: Overlay {overlay_idx}");
        Ok(())
    }

    pub fn toggle_overlay(&self, overlay_idx: usize) -> Result<(), LiveStudioError> {
        let is_on = {
            let cfg = self.config.read();
            cfg.overlay_channels
                .iter()
                .find(|c| c.channel_index == overlay_idx)
                .map(|c| c.is_on_air)
                .unwrap_or(false)
        };

        if is_on {
            self.take_overlay_off_air(overlay_idx)
        } else {
            self.take_overlay_on_air(overlay_idx)
        }
    }

    pub fn adjust_scoreboard_score(&self, graphic_id: &str, team: &str, delta: i32) -> Result<(), LiveStudioError> {
        let mut cfg = self.config.write();
        let item = cfg
            .items
            .iter_mut()
            .find(|i| i.id == graphic_id)
            .ok_or_else(|| LiveStudioError::validation("Graphic item not found", None))?;

        let key = if team.eq_ignore_ascii_case("b") || team.eq_ignore_ascii_case("away") {
            "scoreB"
        } else {
            "scoreA"
        };

        let current: i32 = item.fields.get(key).and_then(|s| s.parse().ok()).unwrap_or(0);
        let updated = (current + delta).max(0);
        item.fields.insert(key.to_string(), updated.to_string());
        info!("Updated scoreboard '{graphic_id}' team {team} score to {updated}");
        Ok(())
    }

    pub fn render_graphic_preview(&self, graphic_id: &str, width: u32, height: u32) -> Option<RgbaImage> {
        self.render_graphic_preview_with_source(graphic_id, width, height, |_| None)
    }

    pub fn render_graphic_preview_with_source<F>(
        &self,
        graphic_id: &str,
        width: u32,
        height: u32,
        mut resolve_source: F,
    ) -> Option<RgbaImage>
    where
        F: FnMut(&str) -> Option<RgbaImage>,
    {
        let (item, src_id_opt) = {
            let cfg = self.config.read();
            let item = cfg.items.iter().find(|i| i.id == graphic_id)?.clone();
            let src_id = item
                .fields
                .get("sourceInputId")
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string());
            (item, src_id)
        };
        let src_frame = src_id_opt.as_deref().and_then(|src_id| resolve_source(src_id));
        Some(GraphicsRenderer::render_graphic_item_with_source(
            &item,
            width,
            height,
            src_frame.as_ref(),
        ))
    }

    /// Checks if any overlay channel is currently on-air or animating with a graphic assigned
    pub fn has_active_overlays(&self) -> bool {
        let cfg = self.config.read();
        let trans = self.channel_transitions.read();
        cfg.overlay_channels.iter().any(|ch| {
            let slot = ch.channel_index.saturating_sub(1);
            let in_trans = trans.get(slot).and_then(|t| t.as_ref()).is_some();
            ch.graphic_id.is_some() && (ch.is_on_air || in_trans)
        })
    }

    /// Composites all active overlays directly onto an existing video canvas
    pub fn composite_active_overlays(&self, canvas: &mut RgbaImage) {
        self.composite_active_overlays_with_sources(canvas, |_| None);
    }

    pub fn composite_active_overlays_with_sources<F>(&self, canvas: &mut RgbaImage, mut resolve_source: F)
    where
        F: FnMut(&str) -> Option<RgbaImage>,
    {
        struct RenderTask {
            item: GraphicItem,
            source_id: Option<String>,
            progress: f32,
            is_out: bool,
        }

        let tasks: Vec<RenderTask> = {
            let mut cfg = self.config.write();
            let mut transitions = self.channel_transitions.write();
            let items = cfg.items.clone();
            let mut task_list = Vec::new();

            for ch in &mut cfg.overlay_channels {
                let slot = ch.channel_index.saturating_sub(1);
                if slot >= transitions.len() {
                    continue;
                }

                let graphic_id = match ch.graphic_id {
                    Some(ref id) => id,
                    None => continue,
                };

                let item = match items.iter().find(|i| i.id == *graphic_id) {
                    Some(it) => it.clone(),
                    None => continue,
                };

                let src_id = if ch.is_on_air || transitions[slot].is_some() {
                    item.fields
                        .get("sourceInputId")
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| s.to_string())
                } else {
                    None
                };

                let mut should_remove_trans = false;
                let mut auto_trigger_out = false;

                if let Some(ref mut t) = transitions[slot] {
                    let elapsed_ms = t.start_time.elapsed().as_millis() as f32;
                    let dur_ms = t.duration_ms.max(1) as f32;
                    let progress = (elapsed_ms / dur_ms).clamp(0.0, 1.0);

                    if t.direction == TransitionDirection::In {
                        task_list.push(RenderTask {
                            item: item.clone(),
                            source_id: src_id,
                            progress,
                            is_out: false,
                        });
                        if progress >= 1.0 {
                            // Finished In-transition
                            ch.is_transitioning = false;
                            if t.on_air_since.is_none() {
                                t.on_air_since = Some(Instant::now());
                            }
                            // Check Auto-Out timer
                            if let (Some(since), Some(auto_ms)) = (t.on_air_since, t.auto_out_ms) {
                                if since.elapsed().as_millis() >= auto_ms as u128 {
                                    auto_trigger_out = true;
                                } else if auto_ms == 0 {
                                    should_remove_trans = true;
                                }
                            } else {
                                should_remove_trans = true;
                            }
                        }
                    } else {
                        // Out-transition
                        let out_progress = 1.0 - progress;
                        task_list.push(RenderTask {
                            item: item.clone(),
                            source_id: src_id,
                            progress: out_progress,
                            is_out: true,
                        });
                        if progress >= 1.0 {
                            should_remove_trans = true;
                            ch.is_on_air = false;
                            ch.is_transitioning = false;
                        }
                    }
                } else if ch.is_on_air {
                    // Steady on-air state
                    task_list.push(RenderTask {
                        item: item.clone(),
                        source_id: src_id,
                        progress: 1.0,
                        is_out: false,
                    });
                }

                if should_remove_trans {
                    transitions[slot] = None;
                } else if auto_trigger_out {
                    ch.is_on_air = false;
                    ch.is_transitioning = true;
                    ch.transition_direction = TransitionDirection::Out;
                    transitions[slot] = Some(ActiveOverlayTransition {
                        start_time: Instant::now(),
                        duration_ms: item.animation.duration_ms,
                        direction: TransitionDirection::Out,
                        on_air_since: None,
                        auto_out_ms: None,
                    });
                }
            }

            task_list
        }; // Locks dropped before source resolution and frame compositing

        // Phase 2: Resolve live sources and composite onto canvas without holding graphics locks
        for task in tasks {
            let live_src = task
                .source_id
                .as_deref()
                .and_then(&mut resolve_source);

            GraphicsRenderer::composite_graphic_on_canvas_with_source(
                canvas,
                &task.item,
                task.progress,
                task.is_out,
                live_src.as_ref(),
            );
        }
    }

    pub fn add_data_source(&self, ds: DataSourceRecord) {
        let mut cfg = self.config.write();
        if let Some(pos) = cfg.data_sources.iter().position(|d| d.id == ds.id) {
            cfg.data_sources[pos] = ds;
        } else {
            cfg.data_sources.push(ds);
        }
    }

    pub fn remove_data_source(&self, id: &str) -> bool {
        let mut cfg = self.config.write();
        let len_before = cfg.data_sources.len();
        cfg.data_sources.retain(|d| d.id != id);
        cfg.bindings.retain(|b| b.data_source_id != id);
        cfg.data_sources.len() < len_before
    }

    pub fn set_field_binding(&self, binding: FieldBinding) {
        let mut cfg = self.config.write();
        cfg.bindings.retain(|b| !(b.graphic_id == binding.graphic_id && b.field_key == binding.field_key));
        cfg.bindings.push(binding);
        Self::apply_bindings_locked(&mut cfg);
    }

    pub fn remove_field_binding(&self, graphic_id: &str, field_key: &str) {
        let mut cfg = self.config.write();
        cfg.bindings.retain(|b| !(b.graphic_id == graphic_id && b.field_key == field_key));
    }

    pub fn select_data_source_row(&self, id: &str, row_idx: usize) -> bool {
        let mut cfg = self.config.write();
        let mut ok = false;
        if let Some(ds) = cfg.data_sources.iter_mut().find(|d| d.id == id) {
            if row_idx < ds.rows.len() {
                ds.selected_row = row_idx;
                ok = true;
            }
        }
        if ok {
            Self::apply_bindings_locked(&mut cfg);
        }
        ok
    }

    pub fn next_data_source_row(&self, id: &str) -> bool {
        let mut cfg = self.config.write();
        let mut ok = false;
        if let Some(ds) = cfg.data_sources.iter_mut().find(|d| d.id == id) {
            if !ds.rows.is_empty() {
                ds.selected_row = (ds.selected_row + 1) % ds.rows.len();
                ok = true;
            }
        }
        if ok {
            Self::apply_bindings_locked(&mut cfg);
        }
        ok
    }

    pub fn prev_data_source_row(&self, id: &str) -> bool {
        let mut cfg = self.config.write();
        let mut ok = false;
        if let Some(ds) = cfg.data_sources.iter_mut().find(|d| d.id == id) {
            if !ds.rows.is_empty() {
                if ds.selected_row == 0 {
                    ds.selected_row = ds.rows.len() - 1;
                } else {
                    ds.selected_row -= 1;
                }
                ok = true;
            }
        }
        if ok {
            Self::apply_bindings_locked(&mut cfg);
        }
        ok
    }

    pub fn update_data_source_content(&self, id: &str, raw_content: &str) -> Result<(), LiveStudioError> {
        let mut cfg = self.config.write();
        let source_type = {
            let ds = cfg.data_sources.iter().find(|d| d.id == id)
                .ok_or_else(|| LiveStudioError::validation(format!("Data source not found: {}", id), None))?;
            ds.source_type.clone()
        };

        let (headers, rows) = match source_type {
            crate::graphics::model::DataSourceType::Csv => {
                let lines: Vec<&str> = raw_content.lines().filter(|l| !l.trim().is_empty()).collect();
                if lines.is_empty() {
                    (vec![], vec![])
                } else {
                    let hdrs: Vec<String> = lines[0].split(',').map(|s| s.trim().to_string()).collect();
                    let mut rws = Vec::new();
                    for line in &lines[1..] {
                        let parts: Vec<&str> = line.split(',').collect();
                        let mut map = std::collections::HashMap::new();
                        for (i, h) in hdrs.iter().enumerate() {
                            if let Some(val) = parts.get(i) {
                                map.insert(h.clone(), val.trim().to_string());
                            }
                        }
                        rws.push(map);
                    }
                    (hdrs, rws)
                }
            }
            crate::graphics::model::DataSourceType::Json | crate::graphics::model::DataSourceType::RestApi => {
                let parsed: Result<serde_json::Value, _> = serde_json::from_str(raw_content);
                match parsed {
                    Ok(serde_json::Value::Array(arr)) => {
                        let mut hdrs = std::collections::BTreeSet::new();
                        let mut rws = Vec::new();
                        for item in &arr {
                            if let serde_json::Value::Object(map) = item {
                                let mut row_map = std::collections::HashMap::new();
                                for (k, v) in map {
                                    hdrs.insert(k.clone());
                                    let str_val = match v {
                                        serde_json::Value::String(s) => s.clone(),
                                        _ => v.to_string(),
                                    };
                                    row_map.insert(k.clone(), str_val);
                                }
                                rws.push(row_map);
                            }
                        }
                        (hdrs.into_iter().collect(), rws)
                    }
                    _ => (vec![], vec![]),
                }
            }
        };

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        if let Some(ds) = cfg.data_sources.iter_mut().find(|d| d.id == id) {
            ds.headers = headers;
            ds.rows = rows;
            if ds.selected_row >= ds.rows.len() {
                ds.selected_row = 0;
            }
            ds.last_updated_ms = now_ms;
        }

        Self::apply_bindings_locked(&mut cfg);
        Ok(())
    }

    fn apply_bindings_locked(cfg: &mut GraphicsProjectConfig) {
        let bindings = cfg.bindings.clone();
        for binding in bindings {
            if let Some(ds) = cfg.data_sources.iter().find(|d| d.id == binding.data_source_id) {
                if let Some(row) = ds.rows.get(ds.selected_row) {
                    if let Some(val) = row.get(&binding.column_key) {
                        if let Some(item) = cfg.items.iter_mut().find(|i| i.id == binding.graphic_id) {
                            item.fields.insert(binding.field_key.clone(), val.clone());
                        }
                    }
                }
            }
        }
    }
}
