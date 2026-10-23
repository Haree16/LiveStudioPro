use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;
use tracing::info;

use crate::core::error::LiveStudioError;
use crate::playback::model::{Playlist, PlaylistItem, PlaylistLoopMode};

pub struct PlaybackEngine {
    playlists: Arc<RwLock<Vec<Playlist>>>,
    active_playlist_id: Arc<RwLock<Option<String>>>,
    is_paused: AtomicBool,
}

impl PlaybackEngine {
    pub fn new() -> Self {
        Self {
            playlists: Arc::new(RwLock::new(Vec::new())),
            active_playlist_id: Arc::new(RwLock::new(None)),
            is_paused: AtomicBool::new(false),
        }
    }

    pub fn load_playlists(&self, playlists: Vec<Playlist>) {
        *self.playlists.write() = playlists;
    }

    pub fn get_playlists(&self) -> Vec<Playlist> {
        self.playlists.read().clone()
    }

    pub fn get_playlist(&self, id: &str) -> Option<Playlist> {
        self.playlists.read().iter().find(|p| p.id == id).cloned()
    }

    pub fn create_playlist(&self, name: &str) -> Playlist {
        let pl = Playlist::new(name);
        self.playlists.write().push(pl.clone());
        info!("Created new media playlist '{}' (id: {})", pl.name, pl.id);
        pl
    }

    pub fn update_playlist(&self, playlist: Playlist) -> Result<(), LiveStudioError> {
        let mut pls = self.playlists.write();
        if let Some(pos) = pls.iter().position(|p| p.id == playlist.id) {
            pls[pos] = playlist;
            Ok(())
        } else {
            Err(LiveStudioError::validation("Playlist not found", None))
        }
    }

    pub fn delete_playlist(&self, id: &str) -> Result<(), LiveStudioError> {
        let mut pls = self.playlists.write();
        if let Some(pos) = pls.iter().position(|p| p.id == id) {
            pls.remove(pos);
            if *self.active_playlist_id.read() == Some(id.to_string()) {
                *self.active_playlist_id.write() = None;
            }
            info!("Deleted media playlist id: {id}");
            Ok(())
        } else {
            Err(LiveStudioError::validation("Playlist not found", None))
        }
    }

    pub fn add_item(&self, playlist_id: &str, item: PlaylistItem) -> Result<Playlist, LiveStudioError> {
        item.validate_cue_points().map_err(|e| LiveStudioError::validation(e, None))?;

        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        pl.items.push(item);
        Ok(pl.clone())
    }

    pub fn remove_item(&self, playlist_id: &str, item_id: &str) -> Result<Playlist, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        if let Some(pos) = pl.items.iter().position(|i| i.id == item_id) {
            pl.items.remove(pos);
            // Adjust current index if necessary
            if let Some(curr) = pl.current_item_index {
                if pos < curr {
                    pl.current_item_index = Some(curr.saturating_sub(1));
                } else if pos == curr {
                    if pl.items.is_empty() {
                        pl.current_item_index = None;
                        pl.is_playing = false;
                    } else if curr >= pl.items.len() {
                        pl.current_item_index = Some(0);
                    }
                }
            }
        }
        Ok(pl.clone())
    }

    pub fn reorder_items(&self, playlist_id: &str, from_idx: usize, to_idx: usize) -> Result<Playlist, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        if from_idx < pl.items.len() && to_idx < pl.items.len() {
            let item = pl.items.remove(from_idx);
            pl.items.insert(to_idx, item);
        }
        Ok(pl.clone())
    }

    pub fn update_item_cue_points(
        &self,
        playlist_id: &str,
        item_id: &str,
        cue_in_ms: u64,
        cue_out_ms: u64,
    ) -> Result<Playlist, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        let item = pl
            .items
            .iter_mut()
            .find(|i| i.id == item_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist item not found", None))?;

        item.cue_in_ms = cue_in_ms;
        item.cue_out_ms = cue_out_ms;
        item.validate_cue_points().map_err(|e| LiveStudioError::validation(e, None))?;

        Ok(pl.clone())
    }

    /// Plays a specific item in a playlist
    pub fn play_item(&self, playlist_id: &str, item_index: usize) -> Result<PlaylistItem, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        if item_index >= pl.items.len() {
            return Err(LiveStudioError::validation("Item index out of bounds", None));
        }

        let item = &pl.items[item_index];
        if !item.enabled {
            return Err(LiveStudioError::validation("Selected item is disabled", None));
        }

        pl.is_playing = true;
        pl.current_item_index = Some(item_index);
        *self.active_playlist_id.write() = Some(playlist_id.to_string());
        self.is_paused.store(false, Ordering::SeqCst);

        info!("Playlist '{}' playing item {} ('{}')", pl.name, item_index, item.name);
        Ok(item.clone())
    }

    /// Advances to the next item based on loop mode and advance mode
    pub fn advance_next(&self, playlist_id: &str) -> Result<Option<PlaylistItem>, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        if pl.items.is_empty() {
            pl.is_playing = false;
            pl.current_item_index = None;
            return Ok(None);
        }

        let current = pl.current_item_index.unwrap_or(0);
        let next_idx = match pl.loop_mode {
            PlaylistLoopMode::LoopOne => current,
            PlaylistLoopMode::LoopAll => (current + 1) % pl.items.len(),
            PlaylistLoopMode::StopAtEnd | PlaylistLoopMode::None => {
                if current + 1 < pl.items.len() {
                    current + 1
                } else {
                    pl.is_playing = false;
                    pl.current_item_index = None;
                    info!("Playlist '{}' reached end of playlist (stopped)", pl.name);
                    return Ok(None);
                }
            }
        };

        // Find next enabled item
        let mut resolved_idx = next_idx;
        let mut attempts = 0;
        while attempts < pl.items.len() && !pl.items[resolved_idx].enabled {
            resolved_idx = (resolved_idx + 1) % pl.items.len();
            attempts += 1;
        }

        if attempts >= pl.items.len() {
            pl.is_playing = false;
            pl.current_item_index = None;
            return Ok(None);
        }

        pl.current_item_index = Some(resolved_idx);
        pl.is_playing = true;
        let item = pl.items[resolved_idx].clone();
        info!("Playlist '{}' advanced to item {} ('{}')", pl.name, resolved_idx, item.name);
        Ok(Some(item))
    }

    /// Moves to the previous item
    pub fn advance_prev(&self, playlist_id: &str) -> Result<Option<PlaylistItem>, LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        if pl.items.is_empty() {
            return Ok(None);
        }

        let current = pl.current_item_index.unwrap_or(0);
        let prev_idx = if current == 0 {
            if pl.loop_mode == PlaylistLoopMode::LoopAll {
                pl.items.len().saturating_sub(1)
            } else {
                0
            }
        } else {
            current - 1
        };

        pl.current_item_index = Some(prev_idx);
        pl.is_playing = true;
        let item = pl.items[prev_idx].clone();
        info!("Playlist '{}' returned to item {} ('{}')", pl.name, prev_idx, item.name);
        Ok(Some(item))
    }

    pub fn stop_playlist(&self, playlist_id: &str) -> Result<(), LiveStudioError> {
        let mut pls = self.playlists.write();
        let pl = pls
            .iter_mut()
            .find(|p| p.id == playlist_id)
            .ok_or_else(|| LiveStudioError::validation("Playlist not found", None))?;

        pl.is_playing = false;
        pl.current_item_index = None;
        info!("Playlist '{}' stopped", pl.name);
        Ok(())
    }
}
