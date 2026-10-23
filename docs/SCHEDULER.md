# LiveStudio Pro — Timed Cues & Scheduler (Phase 9)

## 1. Overview

The Automation Scheduler executes timed cues and recurring sequences synchronized to wall-clock time, countdown intervals, or fixed calendar dates.

---

## 2. Schedule Types

1. **One-Time (`OneTime`):** Triggers once at an exact UTC ISO-8601 timestamp (e.g. `2026-10-22T19:30:00Z`).
2. **Daily Recurring (`Daily`):** Triggers every 24 hours at a specific hour, minute, and second in the selected broadcast timezone.
3. **Weekly Recurring (`Weekly`):** Triggers on designated days of the week (e.g., Saturday at 14:00:00 for weekly sports broadcast).
4. **Interval (`IntervalMinutes`):** Triggers repeatedly after a set elapsed duration (e.g., station ID roll every 30 minutes).

---

## 3. Startup Reconciliation Policy

When the production application restarts or recovers from a power event, scheduled cues whose trigger times passed while the application was closed are reconciled:

- **`Skip` (Default):** Past-due cues are marked `Missed` without executing. Prevents stale cues from firing out of sequence.
- **`ExecuteImmediately`:** Fires the cue immediately upon application load. Suitable for critical setup macros or daily automation triggers.
- **`NotifyOperator`:** Sets the cue to `Armed` status and presents a modal notification to the technical director for manual confirmation.
