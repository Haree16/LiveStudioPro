pub mod credential;
pub mod encoder;
pub mod engine;
pub mod model;
pub mod recovery;

pub use credential::{redact_secret_from_message, redact_stream_url, CredentialVault};
pub use encoder::EncoderCapabilityAuditor;
pub use engine::{get_available_disk_space, NativeOutputEngine};
pub use model::{
    AudioCodec, EncoderCapability, EncoderPreference, OutputProfile, OutputStatus, RateControl,
    RecordingConfig, RecordingContainer, RecordingHealth, RecordingStatus, ReconnectPolicy,
    StreamDestination, StreamHealth, StreamStatus, VideoCodec,
};
pub use recovery::{
    ActiveRecordingMarker, InterruptedRecordingSession, RecordingRecoveryManager,
    RecordingRecoveryOutcome,
};
