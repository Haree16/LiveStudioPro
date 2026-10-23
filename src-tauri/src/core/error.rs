use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "payload")]
pub enum LiveStudioError {
    #[error("Media engine error: {message}")]
    MediaEngineError {
        message: String,
        actionable_hint: Option<String>,
    },

    #[error("File inspection failed: {path} - {reason}")]
    MediaInspectionFailed {
        path: String,
        reason: String,
        actionable_hint: Option<String>,
    },

    #[error("Project validation error: {details}")]
    ProjectValidationError {
        details: String,
        field: Option<String>,
    },

    #[error("Project persistence error: {details}")]
    ProjectPersistenceError {
        details: String,
        path: Option<String>,
    },

    #[error("Device error: {details}")]
    DeviceError {
        details: String,
        device_id: Option<String>,
    },

    #[error("Missing dependency: {name}")]
    MissingDependency {
        name: String,
        install_command: String,
    },

    #[error("Internal system error: {0}")]
    Internal(String),
}

impl LiveStudioError {
    pub fn media(message: impl Into<String>, hint: Option<&str>) -> Self {
        Self::MediaEngineError {
            message: message.into(),
            actionable_hint: hint.map(String::from),
        }
    }

    pub fn inspection(path: impl Into<String>, reason: impl Into<String>, hint: Option<&str>) -> Self {
        Self::MediaInspectionFailed {
            path: path.into(),
            reason: reason.into(),
            actionable_hint: hint.map(String::from),
        }
    }

    pub fn persistence(details: impl Into<String>, path: Option<&str>) -> Self {
        Self::ProjectPersistenceError {
            details: details.into(),
            path: path.map(String::from),
        }
    }

    pub fn validation(details: impl Into<String>, field: Option<&str>) -> Self {
        Self::ProjectValidationError {
            details: details.into(),
            field: field.map(String::from),
        }
    }

    pub fn device(details: impl Into<String>, device_id: Option<&str>) -> Self {
        Self::DeviceError {
            details: details.into(),
            device_id: device_id.map(String::from),
        }
    }
}
