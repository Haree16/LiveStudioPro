pub mod autosave;
pub mod backup;
pub mod db;
pub mod model;
pub mod persistence;
pub mod portable;
pub mod relink;

pub use autosave::{AutosaveManager, RecoveryMetadata, RecoverySnapshotSummary};
pub use backup::{
    BackupArchivePayload, BackupInspectionReport, BackupItemMetadata, BackupManager,
    RestoreExecutionReport,
};
pub use db::{DatabaseManager, MediaAssetRecord};
pub use model::{
    AudioSettings, CaptureDeviceConfig, ColorAdjustConfig, ColorKeyConfig, ImageConfig, InputItem, InputState, InputType,
    LifecycleConfig, MediaMetadata, OutputSettings, PlaybackState, PortableProjectConfig, ProjectFile,
    ProjectMetadata, RtspConfig, SwitcherPersistedState, VideoSettings, CURRENT_SCHEMA_VERSION,
};
pub use persistence::ProjectStore;
pub use portable::{
    AssetManifestEntry, PortableExportMode, PortableProjectManager, PortableProjectManifest,
};
pub use relink::{
    MediaRelinker, RelinkApplyResult, RelinkCandidate, RelinkMatchMode, RelinkScanReport,
};
