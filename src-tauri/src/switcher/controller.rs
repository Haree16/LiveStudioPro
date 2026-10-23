use parking_lot::RwLock;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};
use image::{Rgba, RgbaImage};

use crate::core::error::LiveStudioError;
use crate::switcher::compositor::SceneCompositor;
use crate::switcher::model::{
    MultiviewLayout, Scene, SceneLayer, SubMixBus, SwitcherStatus, TransitionType,
};
use crate::switcher::transition::{ActiveTransition, TransitionEngine};

pub struct SwitcherController {
    preview_source_id: RwLock<Option<String>>,
    program_source_id: RwLock<Option<String>>,
    preview_scene_id: RwLock<Option<String>>,
    program_scene_id: RwLock<Option<String>>,
    scenes: RwLock<HashMap<String, Scene>>,
    transition_type: RwLock<TransitionType>,
    transition_duration_ms: RwLock<u32>,
    active_transition: RwLock<Option<ActiveTransition>>,
    last_valid_program_frame: Arc<RwLock<Option<RgbaImage>>>,
    last_from_frame: RwLock<Option<RgbaImage>>,
    multiview_layout: RwLock<MultiviewLayout>,
    active_display_output: RwLock<Option<String>>,
    fallback_policy: RwLock<String>,
    sub_mixes: RwLock<HashMap<u32, SubMixBus>>,
    tbar_position: RwLock<f32>,
}

impl SwitcherController {
    pub fn new() -> Self {
        // Initialize with a default scene
        let mut default_scenes = HashMap::new();
        let default_scene = Scene::new("Default Studio Scene", 1920, 1080);
        default_scenes.insert(default_scene.id.clone(), default_scene);

        Self {
            preview_source_id: RwLock::new(None),
            program_source_id: RwLock::new(None),
            preview_scene_id: RwLock::new(None),
            program_scene_id: RwLock::new(None),
            scenes: RwLock::new(default_scenes),
            transition_type: RwLock::new(TransitionType::Crossfade),
            transition_duration_ms: RwLock::new(500),
            active_transition: RwLock::new(None),
            last_valid_program_frame: Arc::new(RwLock::new(None)),
            last_from_frame: RwLock::new(None),
            multiview_layout: RwLock::new(MultiviewLayout::Grid4),
            active_display_output: RwLock::new(None),
            fallback_policy: RwLock::new("freeze".into()),
            sub_mixes: RwLock::new(HashMap::new()),
            tbar_position: RwLock::new(0.0),
        }
    }

    pub fn set_tbar(&self, position: f32) -> f32 {
        let clamped = position.clamp(0.0, 1.0);
        *self.tbar_position.write() = clamped;
        clamped
    }

    pub fn get_tbar(&self) -> f32 {
        *self.tbar_position.read()
    }

    // Bus selections
    pub fn set_preview_source(&self, source_id: Option<String>) {
        *self.preview_source_id.write() = source_id;
        *self.preview_scene_id.write() = None;
        info!("Preview bus switched to source: {:?}", *self.preview_source_id.read());
    }

    pub fn set_program_source(&self, source_id: Option<String>) {
        *self.program_source_id.write() = source_id;
        *self.program_scene_id.write() = None;
        info!("Program bus switched to source: {:?}", *self.program_source_id.read());
    }

    pub fn set_preview_scene(&self, scene_id: Option<String>) {
        *self.preview_scene_id.write() = scene_id;
        *self.preview_source_id.write() = None;
        info!("Preview bus switched to scene: {:?}", *self.preview_scene_id.read());
    }

    pub fn set_program_scene(&self, scene_id: Option<String>) {
        *self.program_scene_id.write() = scene_id;
        *self.program_source_id.write() = None;
        info!("Program bus switched to scene: {:?}", *self.program_scene_id.read());
    }

    pub fn get_preview_source(&self) -> Option<String> {
        self.preview_source_id.read().clone()
    }

    pub fn get_program_source(&self) -> Option<String> {
        self.program_source_id.read().clone()
    }

    pub fn get_preview_scene(&self) -> Option<String> {
        self.preview_scene_id.read().clone()
    }

    pub fn get_program_scene(&self) -> Option<String> {
        self.program_scene_id.read().clone()
    }

    // Transitions
    pub fn set_transition_type(&self, t_type: TransitionType) {
        *self.transition_type.write() = t_type;
    }

    pub fn set_transition_duration(&self, duration_ms: u32) {
        *self.transition_duration_ms.write() = duration_ms.clamp(50, 10000);
    }

    pub fn cut(&self) {
        // Cancel any active transition immediately
        *self.active_transition.write() = None;

        let prev_source = self.preview_source_id.read().clone();
        let prev_scene = self.preview_scene_id.read().clone();
        let prog_source = self.program_source_id.read().clone();
        let prog_scene = self.program_scene_id.read().clone();

        *self.program_source_id.write() = prev_source;
        *self.program_scene_id.write() = prev_scene;

        *self.preview_source_id.write() = prog_source;
        *self.preview_scene_id.write() = prog_scene;

        info!("CUT executed: Program now has source {:?} / scene {:?}", *self.program_source_id.read(), *self.program_scene_id.read());
    }

    pub fn auto(&self, custom_duration_ms: Option<u32>) -> Result<(), LiveStudioError> {
        let is_running = self.active_transition.read().as_ref().map(|t| !t.is_finished()).unwrap_or(false);
        if is_running {
            warn!("AUTO transition already in progress; conflicting command rejected per safety policy.");
            return Err(LiveStudioError::media("Transition already in progress", Some("Wait for transition to complete or press CUT to override")));
        }

        let duration = custom_duration_ms.unwrap_or(*self.transition_duration_ms.read()) as u64;
        let t_type = *self.transition_type.read();

        // If Cut is selected as transition type, execute CUT directly
        if t_type == TransitionType::Cut {
            self.cut();
            return Ok(());
        }

        let from_src = self.program_source_id.read().clone();
        let to_src = self.preview_source_id.read().clone();

        // Snapshot current Program frame into last_from_frame
        let from_snapshot = self.last_valid_program_frame.read().clone();
        *self.last_from_frame.write() = from_snapshot;

        *self.active_transition.write() = Some(ActiveTransition::new(
            t_type,
            duration,
            from_src,
            to_src,
        ));

        info!("AUTO transition started: {:?} ({}ms)", t_type, duration);
        Ok(())
    }

    pub fn get_status(&self) -> SwitcherStatus {
        let active_opt = self.active_transition.read();
        let is_trans = active_opt.as_ref().map(|t| !t.is_finished()).unwrap_or(false);
        let progress = active_opt.as_ref().map(|t| t.progress()).unwrap_or(0.0);

        SwitcherStatus {
            preview_source_id: self.preview_source_id.read().clone(),
            program_source_id: self.program_source_id.read().clone(),
            preview_scene_id: self.preview_scene_id.read().clone(),
            program_scene_id: self.program_scene_id.read().clone(),
            transition_type: *self.transition_type.read(),
            transition_duration_ms: *self.transition_duration_ms.read(),
            is_transitioning: is_trans,
            transition_progress: progress,
            multiview_layout: *self.multiview_layout.read(),
            active_display_output: self.active_display_output.read().clone(),
            fallback_policy: self.fallback_policy.read().clone(),
        }
    }

    // Frame Compositing & Rendering
    pub fn render_preview_frame<F>(&self, mut resolve_source_frame: F) -> Option<RgbaImage>
    where
        F: FnMut(&str) -> Option<RgbaImage>,
    {
        // 1. If a preview scene is active, composite it
        if let Some(ref scene_id) = *self.preview_scene_id.read() {
            if let Some(scene) = self.scenes.read().get(scene_id) {
                return Some(SceneCompositor::render_scene(scene, resolve_source_frame));
            }
        }

        // 2. Otherwise render preview source
        if let Some(ref src_id) = *self.preview_source_id.read() {
            resolve_source_frame(src_id)
        } else {
            None
        }
    }

    pub fn render_program_frame<F>(&self, mut resolve_source_frame: F) -> RgbaImage
    where
        F: FnMut(&str) -> Option<RgbaImage>,
    {
        let mut active_trans = self.active_transition.write();

        // Handle Active Transition
        if let Some(ref trans) = *active_trans {
            let progress = trans.progress();

            // Destination frame (Preview source or scene)
            let to_frame = if let Some(ref scene_id) = *self.preview_scene_id.read() {
                self.scenes
                    .read()
                    .get(scene_id)
                    .map(|s| SceneCompositor::render_scene(s, &mut resolve_source_frame))
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else if let Some(ref to_id) = trans.to_source_id {
                resolve_source_frame(to_id)
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else {
                RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255]))
            };

            // Source frame (from_frame)
            let from_frame = self
                .last_from_frame
                .read()
                .clone()
                .or_else(|| self.last_valid_program_frame.read().clone())
                .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])));

            let blended = TransitionEngine::render_transition(
                trans.transition_type,
                &from_frame,
                &to_frame,
                progress,
            );

            // If finished, commit transition
            if trans.is_finished() {
                let to_source = self.preview_source_id.read().clone();
                let to_scene = self.preview_scene_id.read().clone();
                *self.program_source_id.write() = to_source;
                *self.program_scene_id.write() = to_scene;
                *active_trans = None;
                info!("AUTO transition completed successfully");
            }

            *self.last_valid_program_frame.write() = Some(blended.clone());
            return blended;
        }

        // Handle Manual T-Bar Fader Transition
        let tbar = *self.tbar_position.read();
        if tbar > 0.0 {
            let to_frame = if let Some(ref scene_id) = *self.preview_scene_id.read() {
                self.scenes
                    .read()
                    .get(scene_id)
                    .map(|s| SceneCompositor::render_scene(s, &mut resolve_source_frame))
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else if let Some(ref to_id) = *self.preview_source_id.read() {
                resolve_source_frame(to_id)
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else {
                RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255]))
            };

            let from_frame = if let Some(ref scene_id) = *self.program_scene_id.read() {
                self.scenes
                    .read()
                    .get(scene_id)
                    .map(|s| SceneCompositor::render_scene(s, &mut resolve_source_frame))
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else if let Some(ref src_id) = *self.program_source_id.read() {
                resolve_source_frame(src_id)
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            } else {
                self.last_valid_program_frame
                    .read()
                    .clone()
                    .unwrap_or_else(|| RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255])))
            };

            let blended = TransitionEngine::render_transition(
                *self.transition_type.read(),
                &from_frame,
                &to_frame,
                tbar,
            );
            *self.last_valid_program_frame.write() = Some(blended.clone());
            return blended;
        }

        // Idle Program Rendering
        let frame_opt = if let Some(ref scene_id) = *self.program_scene_id.read() {
            self.scenes
                .read()
                .get(scene_id)
                .map(|s| SceneCompositor::render_scene(s, resolve_source_frame))
        } else if let Some(ref src_id) = *self.program_source_id.read() {
            resolve_source_frame(src_id)
        } else {
            None
        };

        match frame_opt {
            Some(frame) => {
                *self.last_valid_program_frame.write() = Some(frame.clone());
                frame
            }
            None => {
                // Fallback Policy: Return last valid frame ("freeze") or solid black
                let policy = self.fallback_policy.read().clone();
                if policy == "freeze" {
                    if let Some(ref last) = *self.last_valid_program_frame.read() {
                        return last.clone();
                    }
                }
                RgbaImage::from_pixel(1920, 1080, Rgba([0, 0, 0, 255]))
            }
        }
    }

    // Scene CRUD
    pub fn get_all_scenes(&self) -> Vec<Scene> {
        self.scenes.read().values().cloned().collect()
    }

    pub fn get_scene(&self, id: &str) -> Option<Scene> {
        self.scenes.read().get(id).cloned()
    }

    pub fn create_scene(&self, name: &str, width: u32, height: u32) -> Scene {
        let scene = Scene::new(name, width, height);
        self.scenes.write().insert(scene.id.clone(), scene.clone());
        scene
    }

    pub fn update_scene(&self, scene: Scene) -> Result<Scene, LiveStudioError> {
        let mut scenes = self.scenes.write();
        if scenes.contains_key(&scene.id) {
            scenes.insert(scene.id.clone(), scene.clone());
            Ok(scene)
        } else {
            Err(LiveStudioError::validation("Scene not found", Some("id")))
        }
    }

    pub fn delete_scene(&self, id: &str) -> Result<(), LiveStudioError> {
        let mut scenes = self.scenes.write();
        if scenes.remove(id).is_some() {
            if self.preview_scene_id.read().as_deref() == Some(id) {
                *self.preview_scene_id.write() = None;
            }
            if self.program_scene_id.read().as_deref() == Some(id) {
                *self.program_scene_id.write() = None;
            }
            Ok(())
        } else {
            Err(LiveStudioError::validation("Scene not found", Some("id")))
        }
    }

    pub fn add_layer_to_scene(&self, scene_id: &str, layer: SceneLayer) -> Result<Scene, LiveStudioError> {
        let mut scenes = self.scenes.write();
        if let Some(scene) = scenes.get_mut(scene_id) {
            scene.layers.push(layer);
            Ok(scene.clone())
        } else {
            Err(LiveStudioError::validation("Scene not found", Some("scene_id")))
        }
    }

    pub fn remove_layer_from_scene(&self, scene_id: &str, layer_id: &str) -> Result<Scene, LiveStudioError> {
        let mut scenes = self.scenes.write();
        if let Some(scene) = scenes.get_mut(scene_id) {
            scene.layers.retain(|l| l.id != layer_id);
            Ok(scene.clone())
        } else {
            Err(LiveStudioError::validation("Scene not found", Some("scene_id")))
        }
    }

    pub fn update_layer_in_scene(&self, scene_id: &str, layer: SceneLayer) -> Result<Scene, LiveStudioError> {
        let mut scenes = self.scenes.write();
        if let Some(scene) = scenes.get_mut(scene_id) {
            if let Some(pos) = scene.layers.iter().position(|l| l.id == layer.id) {
                scene.layers[pos] = layer;
                Ok(scene.clone())
            } else {
                Err(LiveStudioError::validation("Layer not found", Some("layer_id")))
            }
        } else {
            Err(LiveStudioError::validation("Scene not found", Some("scene_id")))
        }
    }

    // Multiview
    pub fn set_multiview_layout(&self, layout: MultiviewLayout) {
        *self.multiview_layout.write() = layout;
    }

    // Display Output (Second-Monitor / Projector)
    pub fn set_display_output(&self, display_id: Option<String>) {
        *self.active_display_output.write() = display_id;
    }

    // Sub-Mixes (Mix Inputs 2–16)
    pub fn ensure_sub_mix_exists(&self, mix_index: u32) {
        if !(2..=16).contains(&mix_index) {
            return;
        }
        let mut mixes = self.sub_mixes.write();
        mixes.entry(mix_index).or_insert_with(|| SubMixBus::new(mix_index));
    }

    pub fn set_sub_mix_preview(&self, mix_index: u32, source_id: Option<String>) {
        self.ensure_sub_mix_exists(mix_index);
        let mut mixes = self.sub_mixes.write();
        if let Some(bus) = mixes.get_mut(&mix_index) {
            bus.preview_source_id = source_id;
            info!("Sub-Mix {mix_index} preview cued to: {:?}", bus.preview_source_id);
        }
    }

    pub fn set_sub_mix_program(&self, mix_index: u32, source_id: Option<String>) {
        self.ensure_sub_mix_exists(mix_index);
        let mut mixes = self.sub_mixes.write();
        if let Some(bus) = mixes.get_mut(&mix_index) {
            bus.program_source_id = source_id;
            info!("Sub-Mix {mix_index} program set to: {:?}", bus.program_source_id);
        }
    }

    pub fn cut_sub_mix(&self, mix_index: u32) {
        self.ensure_sub_mix_exists(mix_index);
        let mut mixes = self.sub_mixes.write();
        if let Some(bus) = mixes.get_mut(&mix_index) {
            std::mem::swap(&mut bus.preview_source_id, &mut bus.program_source_id);
            bus.in_transition = false;
            bus.transition_progress = 0.0;
            info!("Sub-Mix {mix_index} CUT executed (Program: {:?})", bus.program_source_id);
        }
    }

    pub fn set_sub_mix_transition(&self, mix_index: u32, t_type: TransitionType, duration_ms: u32) {
        self.ensure_sub_mix_exists(mix_index);
        let mut mixes = self.sub_mixes.write();
        if let Some(bus) = mixes.get_mut(&mix_index) {
            bus.transition_type = t_type;
            bus.transition_duration_ms = duration_ms.clamp(50, 10000);
        }
    }

    pub fn get_sub_mix(&self, mix_index: u32) -> Option<SubMixBus> {
        self.ensure_sub_mix_exists(mix_index);
        self.sub_mixes.read().get(&mix_index).cloned()
    }

    pub fn list_sub_mixes(&self) -> Vec<SubMixBus> {
        let mut list: Vec<SubMixBus> = self.sub_mixes.read().values().cloned().collect();
        list.sort_by_key(|b| b.mix_index);
        list
    }

    pub fn render_sub_mix_frame<F>(&self, mix_index: u32, frame_provider: F) -> Option<RgbaImage>
    where
        F: Fn(&str) -> Option<RgbaImage>,
    {
        let bus = self.get_sub_mix(mix_index)?;
        if let Some(ref pgm_id) = bus.program_source_id {
            frame_provider(pgm_id)
        } else if let Some(ref prev_id) = bus.preview_source_id {
            frame_provider(prev_id)
        } else {
            None
        }
    }
}
