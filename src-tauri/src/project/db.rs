use std::path::{Path, PathBuf};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::project::model::MediaMetadata;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaAssetRecord {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
    pub file_size_bytes: u64,
    pub duration_seconds: f64,
    pub container_format: String,
    pub media_type: String, // "video", "audio", "image"
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub framerate: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub audio_channels: Option<u32>,
    pub audio_sample_rate: Option<u32>,
    pub thumbnail_path: Option<String>,
    pub is_missing: bool,
    pub created_at: String,
}

pub struct DatabaseManager {
    db_path: PathBuf,
}

impl DatabaseManager {
    pub fn new() -> Result<Self, LiveStudioError> {
        let base_dir = dirs_fallback().join("LiveStudioPro");
        let _ = std::fs::create_dir_all(&base_dir);
        let db_path = base_dir.join("library.db");
        let s = Self { db_path };
        s.init_schema()?;
        Ok(s)
    }

    pub fn with_path(path: PathBuf) -> Result<Self, LiveStudioError> {
        let s = Self { db_path: path };
        s.init_schema()?;
        Ok(s)
    }

    fn connect(&self) -> Result<Connection, LiveStudioError> {
        Connection::open(&self.db_path).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to open SQLite database: {e}"), None)
        })
    }

    fn init_schema(&self) -> Result<(), LiveStudioError> {
        let conn = self.connect()?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS media_assets (
                id TEXT PRIMARY KEY,
                file_path TEXT NOT NULL UNIQUE,
                file_name TEXT NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                duration_seconds REAL NOT NULL,
                container_format TEXT NOT NULL,
                media_type TEXT NOT NULL DEFAULT 'video',
                width INTEGER,
                height INTEGER,
                framerate REAL,
                video_codec TEXT,
                audio_codec TEXT,
                audio_channels INTEGER,
                audio_sample_rate INTEGER,
                thumbnail_path TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_media_path ON media_assets(file_path);
            
            CREATE TABLE IF NOT EXISTS project_history (
                id TEXT PRIMARY KEY,
                project_name TEXT NOT NULL,
                file_path TEXT NOT NULL UNIQUE,
                last_opened TEXT NOT NULL
            );",
        ).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to initialize SQLite schema: {e}"), None)
        })?;

        // Safely check and add media_type / thumbnail_path columns if migrating from Phase 1 db
        let _ = conn.execute("ALTER TABLE media_assets ADD COLUMN media_type TEXT NOT NULL DEFAULT 'video'", []);
        let _ = conn.execute("ALTER TABLE media_assets ADD COLUMN thumbnail_path TEXT", []);

        info!("SQLite asset database initialized at {:?}", self.db_path);
        Ok(())
    }

    pub fn index_media_asset(
        &self,
        id: &str,
        path: &Path,
        media_type: &str,
        meta: &MediaMetadata,
        thumbnail_path: Option<&Path>,
    ) -> Result<(), LiveStudioError> {
        let conn = self.connect()?;
        let file_name = path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".into());

        conn.execute(
            "INSERT INTO media_assets (
                id, file_path, file_name, file_size_bytes, duration_seconds,
                container_format, media_type, width, height, framerate, video_codec,
                audio_codec, audio_channels, audio_sample_rate, thumbnail_path, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, datetime('now'))
            ON CONFLICT(file_path) DO UPDATE SET
                duration_seconds = excluded.duration_seconds,
                width = excluded.width,
                height = excluded.height,
                framerate = excluded.framerate,
                video_codec = excluded.video_codec,
                audio_codec = excluded.audio_codec,
                thumbnail_path = coalesce(excluded.thumbnail_path, media_assets.thumbnail_path)",
            params![
                id,
                path.to_string_lossy(),
                file_name,
                meta.file_size_bytes as i64,
                meta.duration_seconds,
                meta.container_format,
                media_type,
                meta.width,
                meta.height,
                meta.framerate,
                meta.video_codec,
                meta.audio_codec,
                meta.audio_channels,
                meta.audio_sample_rate,
                thumbnail_path.map(|p| p.to_string_lossy().to_string()),
            ],
        ).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to index media asset: {e}"), None)
        })?;

        Ok(())
    }

    pub fn get_cached_metadata(&self, path: &Path) -> Option<MediaMetadata> {
        let conn = self.connect().ok()?;
        let mut stmt = conn.prepare(
            "SELECT duration_seconds, container_format, width, height, framerate,
                    video_codec, audio_codec, audio_channels, audio_sample_rate, file_size_bytes
             FROM media_assets WHERE file_path = ?1",
        ).ok()?;

        let res = stmt.query_row(params![path.to_string_lossy()], |row| {
            Ok(MediaMetadata {
                duration_seconds: row.get(0)?,
                container_format: row.get(1)?,
                width: row.get(2)?,
                height: row.get(3)?,
                framerate: row.get(4)?,
                video_codec: row.get(5)?,
                audio_codec: row.get(6)?,
                audio_channels: row.get(7)?,
                audio_sample_rate: row.get(8)?,
                bitrate: None,
                file_size_bytes: row.get::<_, i64>(9)? as u64,
            })
        });

        res.ok()
    }

    pub fn get_all_assets(
        &self,
        search_query: Option<&str>,
        sort_by: Option<&str>,
    ) -> Result<Vec<MediaAssetRecord>, LiveStudioError> {
        let conn = self.connect()?;

        let order_clause = match sort_by.unwrap_or("created_at") {
            "name" => "file_name ASC",
            "duration" => "duration_seconds DESC",
            _ => "created_at DESC",
        };

        let query = format!(
            "SELECT id, file_path, file_name, file_size_bytes, duration_seconds,
                    container_format, media_type, width, height, framerate, video_codec,
                    audio_codec, audio_channels, audio_sample_rate, thumbnail_path, created_at
             FROM media_assets
             WHERE (?1 IS NULL OR file_name LIKE '%' || ?1 || '%' OR file_path LIKE '%' || ?1 || '%')
             ORDER BY {order_clause}"
        );

        let mut stmt = conn.prepare(&query).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to prepare asset query: {e}"), None)
        })?;

        let rows = stmt.query_map(params![search_query], |row| {
            let file_path: String = row.get(1)?;
            let is_missing = !Path::new(&file_path).exists();

            Ok(MediaAssetRecord {
                id: row.get(0)?,
                file_path,
                file_name: row.get(2)?,
                file_size_bytes: row.get::<_, i64>(3)? as u64,
                duration_seconds: row.get(4)?,
                container_format: row.get(5)?,
                media_type: row.get(6)?,
                width: row.get(7)?,
                height: row.get(8)?,
                framerate: row.get(9)?,
                video_codec: row.get(10)?,
                audio_codec: row.get(11)?,
                audio_channels: row.get(12)?,
                audio_sample_rate: row.get(13)?,
                thumbnail_path: row.get(14)?,
                is_missing,
                created_at: row.get(15)?,
            })
        }).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to query assets: {e}"), None)
        })?;

        let mut results = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                results.push(item);
            }
        }
        Ok(results)
    }

    pub fn relink_asset(&self, old_path: &Path, new_path: &Path) -> Result<(), LiveStudioError> {
        let conn = self.connect()?;
        let new_file_name = new_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".into());

        let rows = conn.execute(
            "UPDATE media_assets SET file_path = ?1, file_name = ?2 WHERE file_path = ?3",
            params![new_path.to_string_lossy(), new_file_name, old_path.to_string_lossy()],
        ).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to relink asset: {e}"), None)
        })?;

        if rows == 0 {
            Err(LiveStudioError::persistence("Asset not found for relinking", Some(old_path.to_string_lossy().as_ref())))
        } else {
            info!("Relinked media asset from {:?} to {:?}", old_path, new_path);
            Ok(())
        }
    }

    pub fn delete_asset(&self, id: &str) -> Result<(), LiveStudioError> {
        let conn = self.connect()?;
        conn.execute("DELETE FROM media_assets WHERE id = ?1", params![id]).map_err(|e| {
            LiveStudioError::persistence(format!("Failed to delete asset: {e}"), None)
        })?;
        Ok(())
    }
}

fn dirs_fallback() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".local").join("share")
    } else if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else {
        std::env::temp_dir()
    }
}
