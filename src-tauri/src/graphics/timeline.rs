use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EasingFunction {
    Linear,
    EaseInQuad,
    EaseOutQuad,
    EaseInOutQuad,
    EaseOutBack,
}

impl EasingFunction {
    pub fn apply(&self, t: f32) -> f32 {
        let t = t.clamp(0.0, 1.0);
        match self {
            Self::Linear => t,
            Self::EaseInQuad => t * t,
            Self::EaseOutQuad => t * (2.0 - t),
            Self::EaseInOutQuad => {
                if t < 0.5 {
                    2.0 * t * t
                } else {
                    -1.0 + (4.0 - 2.0 * t) * t
                }
            }
            Self::EaseOutBack => {
                let c1 = 1.70158;
                let c3 = c1 + 1.0;
                1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe<T> {
    pub timestamp_ms: u32,
    pub value: T,
    pub easing: EasingFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluatedTransform {
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub opacity: f32,
    pub rotation_degrees: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GraphicAnimationTimeline {
    pub id: String,
    pub name: String,
    pub duration_ms: u32,
    pub loop_playback: bool,
    pub x_track: Vec<Keyframe<f32>>,
    pub y_track: Vec<Keyframe<f32>>,
    pub scale_track: Vec<Keyframe<f32>>,
    pub opacity_track: Vec<Keyframe<f32>>,
    pub rotation_track: Vec<Keyframe<f32>>,
}

impl Default for GraphicAnimationTimeline {
    fn default() -> Self {
        Self {
            id: "timeline-slide-in".into(),
            name: "Lower Third Slide In".into(),
            duration_ms: 600,
            loop_playback: false,
            x_track: vec![
                Keyframe { timestamp_ms: 0, value: -1.0, easing: EasingFunction::EaseOutQuad },
                Keyframe { timestamp_ms: 600, value: 0.0, easing: EasingFunction::Linear },
            ],
            y_track: vec![
                Keyframe { timestamp_ms: 0, value: 0.0, easing: EasingFunction::Linear },
            ],
            scale_track: vec![
                Keyframe { timestamp_ms: 0, value: 1.0, easing: EasingFunction::Linear },
            ],
            opacity_track: vec![
                Keyframe { timestamp_ms: 0, value: 0.0, easing: EasingFunction::EaseInQuad },
                Keyframe { timestamp_ms: 300, value: 1.0, easing: EasingFunction::Linear },
            ],
            rotation_track: vec![
                Keyframe { timestamp_ms: 0, value: 0.0, easing: EasingFunction::Linear },
            ],
        }
    }
}

impl GraphicAnimationTimeline {
    pub fn evaluate_at(&self, timestamp_ms: u32) -> EvaluatedTransform {
        let t = if self.loop_playback && self.duration_ms > 0 {
            timestamp_ms % self.duration_ms
        } else {
            timestamp_ms.min(self.duration_ms)
        };

        EvaluatedTransform {
            x: Self::interpolate_track(&self.x_track, t, 0.0),
            y: Self::interpolate_track(&self.y_track, t, 0.0),
            scale: Self::interpolate_track(&self.scale_track, t, 1.0),
            opacity: Self::interpolate_track(&self.opacity_track, t, 1.0),
            rotation_degrees: Self::interpolate_track(&self.rotation_track, t, 0.0),
        }
    }

    fn interpolate_track(keyframes: &[Keyframe<f32>], t: u32, default_val: f32) -> f32 {
        if keyframes.is_empty() {
            return default_val;
        }
        if keyframes.len() == 1 || t <= keyframes[0].timestamp_ms {
            return keyframes[0].value;
        }
        if t >= keyframes.last().unwrap().timestamp_ms {
            return keyframes.last().unwrap().value;
        }

        // Find surrounding keyframe segment
        for i in 0..keyframes.len() - 1 {
            let k0 = &keyframes[i];
            let k1 = &keyframes[i + 1];

            if t >= k0.timestamp_ms && t <= k1.timestamp_ms {
                let seg_duration = (k1.timestamp_ms - k0.timestamp_ms) as f32;
                if seg_duration <= 0.0 {
                    return k0.value;
                }
                let norm_t = (t - k0.timestamp_ms) as f32 / seg_duration;
                let eased_t = k0.easing.apply(norm_t);
                return k0.value + (k1.value - k0.value) * eased_t;
            }
        }

        keyframes.last().unwrap().value
    }
}
