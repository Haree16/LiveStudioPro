use gstreamer as gst;
use gstreamer::prelude::*;
use tracing::info;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineDiagnosticResult {
    pub success: bool,
    pub pipeline_description: String,
    pub reached_state: String,
    pub latency_ms: f64,
    pub error_message: Option<String>,
}

pub struct MediaPipelineTester;

impl MediaPipelineTester {
    /// Tests creating and transitioning a real minimal GStreamer pipeline
    pub fn test_minimal_pipeline() -> Result<PipelineDiagnosticResult, LiveStudioError> {
        gst::init().map_err(|e| {
            LiveStudioError::media(format!("Failed to initialize GStreamer: {e}"), None)
        })?;

        let pipeline_desc = "videotestsrc pattern=smpte num-buffers=15 ! fakesink sync=false";
        let start = std::time::Instant::now();

        let pipeline = gst::parse::launch(pipeline_desc).map_err(|e| {
            LiveStudioError::media(
                format!("Failed to parse test pipeline: {e}"),
                Some("Ensure videotestsrc and fakesink elements are present in gst-plugins-base."),
            )
        })?;

        let pipeline = pipeline.dynamic_cast::<gst::Pipeline>().map_err(|_| {
            LiveStudioError::media("Pipeline cast failed", None)
        })?;

        // Transition: NULL -> READY -> PLAYING
        pipeline.set_state(gst::State::Playing).map_err(|e| {
            LiveStudioError::media(format!("Failed to transition test pipeline to Playing: {e}"), None)
        })?;

        // Wait up to 2 seconds for state change
        let (state_change_res, current, _pending) = pipeline.state(gst::ClockTime::from_seconds(2));
        let latency_ms = start.elapsed().as_secs_f64() * 1000.0;

        let success = state_change_res.is_ok();
        let reached_state = format!("{current:?}");

        // Clean up pipeline
        let _ = pipeline.set_state(gst::State::Null);

        info!(
            "Pipeline probe completed: success={} reached_state={} latency={:.2}ms",
            success, reached_state, latency_ms
        );

        Ok(PipelineDiagnosticResult {
            success,
            pipeline_description: pipeline_desc.into(),
            reached_state,
            latency_ms,
            error_message: if success { None } else { Some("State change timed out".into()) },
        })
    }
}
