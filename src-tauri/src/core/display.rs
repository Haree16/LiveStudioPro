//! Maps OS monitors to the app's display list and back, independent of Tauri so it is testable.
use crate::switcher::DisplayInfo;

/// Label of the borderless fullscreen window that shows Program on a second monitor.
pub const PROGRAM_OUTPUT_WINDOW: &str = "program-output";

/// Plain description of one OS monitor (physical pixels).
#[derive(Debug, Clone, PartialEq)]
pub struct MonitorRect {
    pub name: Option<String>,
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub scale_factor: f64,
}

pub fn display_id(index: usize) -> String {
    format!("monitor-{index}")
}

pub fn parse_display_id(id: &str) -> Option<usize> {
    id.strip_prefix("monitor-")?.parse().ok()
}

/// Builds the display list. `primary` is the (x, y) origin of the primary monitor, if known.
pub fn displays_from_monitors(
    monitors: &[MonitorRect],
    primary: Option<(i32, i32)>,
    active_id: Option<&str>,
) -> Vec<DisplayInfo> {
    monitors
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let id = display_id(i);
            DisplayInfo {
                name: m.name.clone().unwrap_or_else(|| format!("Display {}", i + 1)),
                width: m.width,
                height: m.height,
                is_primary: primary.map(|p| p == (m.x, m.y)).unwrap_or(i == 0),
                is_fullscreen_active: active_id == Some(id.as_str()),
                id,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mon(name: Option<&str>, w: u32, h: u32, x: i32) -> MonitorRect {
        MonitorRect { name: name.map(String::from), width: w, height: h, x, y: 0, scale_factor: 1.0 }
    }

    #[test]
    fn maps_monitors_and_flags_primary_and_active() {
        let list = displays_from_monitors(
            &[mon(Some("DP-1"), 2560, 1440, 0), mon(None, 1920, 1080, 2560)],
            Some((0, 0)),
            Some("monitor-1"),
        );
        assert_eq!(list.len(), 2);
        assert_eq!((list[0].id.as_str(), list[0].is_primary, list[0].is_fullscreen_active), ("monitor-0", true, false));
        assert_eq!(list[1].name, "Display 2");
        assert_eq!((list[1].width, list[1].is_primary, list[1].is_fullscreen_active), (1920, false, true));
    }

    #[test]
    fn id_round_trip_and_rejects_garbage() {
        assert_eq!(parse_display_id(&display_id(3)), Some(3));
        assert_eq!(parse_display_id("display-secondary"), None);
        assert_eq!(parse_display_id("monitor-x"), None);
    }

    #[test]
    fn no_monitors_means_empty_list() {
        assert!(displays_from_monitors(&[], None, None).is_empty());
    }
}
