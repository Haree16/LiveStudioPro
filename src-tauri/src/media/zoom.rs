use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ZoomParticipantStream {
    pub participant_id: String,
    pub user_name: String,
    pub is_video_on: bool,
    pub is_audio_muted: bool,
    pub is_screen_sharing: bool,
    pub assigned_input_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ZoomSessionConfig {
    pub meeting_number: String,
    pub passcode: String,
    pub sdk_key: String,
    pub auto_assign_inputs: bool,
    pub max_participants: usize,
}

impl Default for ZoomSessionConfig {
    fn default() -> Self {
        Self {
            meeting_number: "".into(),
            passcode: "".into(),
            sdk_key: "".into(),
            auto_assign_inputs: true,
            max_participants: 8,
        }
    }
}

pub struct ZoomMeetingManager;

impl ZoomMeetingManager {
    /// Builds GStreamer video ingestion pipeline for an isolated Zoom participant stream
    pub fn build_participant_pipeline(participant_id: &str, width: u32, height: u32) -> String {
        format!(
            "appsrc name=zoom_src_{} is-live=true format=time ! \
             videoconvert ! \
             video/x-raw,format=RGBA,width={},height={},framerate=30/1 ! \
             appsink name=sink sync=false",
            participant_id, width, height
        )
    }

    /// Evaluates active speaker status to trigger automatic switching
    pub fn find_active_speaker<'a>(participants: &'a [ZoomParticipantStream]) -> Option<&'a ZoomParticipantStream> {
        participants.iter().find(|p| p.is_video_on && !p.is_audio_muted)
    }
}
