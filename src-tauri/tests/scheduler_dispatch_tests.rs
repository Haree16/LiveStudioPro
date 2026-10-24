use chrono::{Duration, Utc};

use livestudio_lib::automation::scheduler::{AutomationScheduler, TimedCue, TimedCueStatus};
use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::playback::model::{ScheduleStatus, ScheduledCue};
use livestudio_lib::project::model::{InputItem, InputType};

fn due_cue(input: &str, take_live: bool) -> ScheduledCue {
    let mut cue = ScheduledCue::new("Auto cue", None, Utc::now() - Duration::seconds(1));
    cue.requires_operator_confirmation = false;
    cue.target_input_id = Some(input.into());
    cue.auto_take_live = take_live;
    cue
}

#[test]
fn test_due_playback_cue_executes_without_confirmation() {
    let controller = ProductionController::new().expect("controller");
    controller.add_input(InputItem::new("cam-1", "Cam 1", InputType::TestPattern, "smpte")).unwrap();
    controller.add_input(InputItem::new("cam-2", "Cam 2", InputType::TestPattern, "ball")).unwrap();

    let cue = due_cue("cam-2", true);
    controller.scheduler_add_cue(cue.clone());

    // The scheduler thread ticks every 500 ms.
    let mut fired = 0;
    for _ in 0..30 {
        fired += controller.dispatch_due_playback_cues();
        if fired > 0 {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    assert_eq!(fired, 1, "cue should fire exactly once");
    assert_eq!(controller.get_switcher_status().program_source_id, Some("cam-2".into()));

    let stored = controller.scheduler_get_cues().into_iter().find(|c| c.id == cue.id).unwrap();
    assert_eq!(stored.status, ScheduleStatus::Completed);

    // Never fires twice.
    std::thread::sleep(std::time::Duration::from_millis(700));
    assert_eq!(controller.dispatch_due_playback_cues(), 0);
}

#[test]
fn test_cue_requiring_confirmation_is_not_auto_executed() {
    let controller = ProductionController::new().expect("controller");
    controller.add_input(InputItem::new("cam-1", "Cam 1", InputType::TestPattern, "smpte")).unwrap();
    let mut cue = due_cue("cam-1", true);
    cue.requires_operator_confirmation = true;
    controller.scheduler_add_cue(cue.clone());

    std::thread::sleep(std::time::Duration::from_millis(1200));
    assert_eq!(controller.dispatch_due_playback_cues(), 0);
    assert_eq!(controller.get_switcher_status().program_source_id, None);
    assert_eq!(controller.scheduler_get_pending_confirmation().map(|c| c.id), Some(cue.id));
}

#[test]
fn test_timed_automation_cue_is_returned_once_and_confirmation_is_held() {
    let scheduler = AutomationScheduler::new();
    let past = Utc::now() - Duration::seconds(5);

    let auto = TimedCue::new_one_time("Auto", "macro-auto", past);
    let mut held = TimedCue::new_one_time("Held", "macro-held", past);
    held.requires_confirmation = true;
    scheduler.add_cue(auto);
    scheduler.add_cue(held);

    assert_eq!(scheduler.poll_due_cues(), vec!["macro-auto".to_string()]);
    assert!(scheduler.poll_due_cues().is_empty(), "one-time cue must not repeat");

    let held = scheduler.list_cues().into_iter().find(|c| c.target_macro_id == "macro-held").unwrap();
    assert_eq!(held.status, TimedCueStatus::Armed);
}
