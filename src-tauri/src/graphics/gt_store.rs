use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::graphics::renderer::GraphicsRenderer;

pub struct GtTemplateStore;

impl GtTemplateStore {
    /// Returns the directory where GT title templates (.gtp) are persisted
    pub fn templates_directory() -> PathBuf {
        let base = std::env::var("LIVESTUDIO_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                dirs_fallback()
            });
        base.join("gt-templates")
    }

    /// Saves a GT Template JSON string atomically to disk
    pub fn save_template(template_json: &str, template_id: &str) -> Result<PathBuf, LiveStudioError> {
        // Sanitize template_id to prevent path traversal
        let safe_id = template_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();

        let dir = Self::templates_directory();
        fs::create_dir_all(&dir).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to create GT template directory: {e}"), None)
        })?;

        let dest_path = dir.join(format!("{safe_id}.gtp"));
        let temp_path = dir.join(format!("{safe_id}.gtp.tmp"));

        // Validate JSON
        let _: serde_json::Value = serde_json::from_str(template_json).map_err(|e| {
            LiveStudioError::validation(format!("Invalid template JSON syntax: {e}"), None)
        })?;

        // Atomic write
        fs::write(&temp_path, template_json.as_bytes()).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to write temporary template file: {e}"), None)
        })?;

        fs::rename(&temp_path, &dest_path).map_err(|e| {
            let _ = fs::remove_file(&temp_path);
            LiveStudioError::persistence(format!("Failed to commit GT template file: {e}"), None)
        })?;

        info!("Successfully saved GT template '{safe_id}' to {:?}", dest_path);
        Ok(dest_path)
    }

    /// Loads a GT Template JSON string from disk by ID
    pub fn load_template(template_id: &str) -> Result<String, LiveStudioError> {
        let safe_id = template_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();

        let target_path = Self::templates_directory().join(format!("{safe_id}.gtp"));
        if !target_path.exists() {
            return Err(LiveStudioError::persistence(
                format!("GT Template '{safe_id}' not found"),
                Some(target_path.to_string_lossy().as_ref()),
            ));
        }

        fs::read_to_string(&target_path).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to read GT template: {e}"), None)
        })
    }

    /// Lists all saved GT templates in the store
    pub fn list_templates() -> Result<Vec<String>, LiveStudioError> {
        let dir = Self::templates_directory();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut templates = Vec::new();
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("gtp") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        templates.push(content);
                    }
                }
            }
        }

        Ok(templates)
    }

    /// Deletes a GT template by ID
    pub fn delete_template(template_id: &str) -> Result<bool, LiveStudioError> {
        let safe_id = template_id
            .chars()
            .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
            .collect::<String>();

        let target_path = Self::templates_directory().join(format!("{safe_id}.gtp"));
        if target_path.exists() {
            fs::remove_file(&target_path).map_err(|e| {
                LiveStudioError::persistence(format!("Failed to delete GT template: {e}"), None)
            })?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Renders an SVG document into a transparent PNG and returns a data URL
    pub fn render_svg_to_png_data_url(
        svg_content: &str,
        width: u32,
        height: u32,
    ) -> Result<String, LiveStudioError> {
        let img = GraphicsRenderer::render_svg_to_image(svg_content, width, height);

        let mut png_bytes = Vec::new();
        let mut cursor = Cursor::new(&mut png_bytes);
        img.write_to(&mut cursor, image::ImageFormat::Png).map_err(|e| {
            LiveStudioError::internal(format!("Failed to encode rendered SVG to PNG: {e}"))
        })?;

        let encoded = BASE64_STANDARD.encode(&png_bytes);
        Ok(format!("data:image/png;base64,{encoded}"))
    }
}

fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".local/share/livestudio-pro")
    } else if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata).join("LiveStudioPro")
    } else {
        PathBuf::from("/tmp/livestudio-pro")
    }
}
