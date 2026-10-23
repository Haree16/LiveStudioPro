# LiveStudio Pro — Autosave, Snapshots & Project Recovery

**Version:** 1.0.0-rc1  
**Project Schema Version:** 11  
**Default Storage Location:** `~/.local/share/LiveStudioPro/` (Linux) / `%APPDATA%\LiveStudioPro\` (Windows)

---

## 1. Overview

LiveStudio Pro protects user production data against abrupt crashes, power loss, and hardware dropouts through a multi-tiered persistence and recovery architecture:
1. **Atomic File Persistence:** Projects are saved using a write-to-temp-and-rename pattern, preventing file truncation if a crash occurs mid-write.
2. **Rotating Recovery Snapshots:** A bounded history of snapshots (default: up to 10 snapshots) is maintained in `snapshots/` with UTC timestamps.
3. **Safety Backup Preservation:** Before restoring an autosave over an existing project file, a `.bak_<timestamp>` copy is created to prevent unrecoverable overwrites.
4. **Schema Versioning & Migration:** Project files are strictly schema-versioned (currently version 11). Any project from schema versions 1 through 10 is automatically upgraded with backward-compatible defaults.

---

## 2. Autosave Architecture

### Configurable Parameters
Autosave behavior is governed by `LifecycleConfig` within the project schema:
- `autosaveIntervalSeconds`: Configurable timer interval (default: 60 seconds).
- `maxRecoverySnapshots`: Upper limit on rotating historical snapshots (default: 10).
- `warnOnActiveOutputShutdown`: Warn operator before exiting while streaming/recording (default: `true`).
- `gracefulShutdownTimeoutMs`: Upper bound on graceful shutdown time (default: 5000ms).

### Trigger Points
Autosave snapshots are written:
- Whenever project state is marked **dirty** (input added/modified, scene updated, overlay changed, mixer fader moved).
- Periodically by the autosave background task.
- Immediately preceding application shutdown if uncommitted modifications exist.

### Atomic Writing Procedure
To guarantee that the primary project or recovery file is never left in a corrupted or half-written state:
1. Serialize the project model to JSON in memory.
2. Write bytes to `<filename>.tmp` in the same directory.
3. Flush and sync bytes to storage media.
4. Execute `fs::rename(temp_path, final_path)`. On POSIX and Windows filesystems, renaming an existing file in the same filesystem is an atomic operation.
5. If the operation fails at any step, the original file remains intact.

---

## 3. Recovery Discovery & Operator Interface

On application launch, `ProductionController` inspects:
1. `session_recovery.json` in the application data root.
2. `snapshots/` folder for timestamped snapshot entries.
3. Disk timestamps comparing the recovery snapshot against the original project file.

If an uncommitted session is detected, the **Crash Recovery & Interrupted Session Manager** modal appears:

### Available Operator Actions
- **Compare Timestamps:** Displays the snapshot creation time alongside an indicator badge: `Newer than original file` if the crash snapshot has updates made after the last manual save.
- **Inspect Input Count & File Size:** Displays channel counts and file sizes to help the operator identify the intended production state.
- **Preserve Original Backup (`.bak`):** When checked (enabled by default), LiveStudio Pro copies the current project file to `<project_name>.bak_<timestamp>` before applying the recovery data.
- **Restore Selected Snapshot:** Deserializes and loads the chosen snapshot, restoring all scenes, inputs, audio matrix configurations, and overlays.
- **Discard Snapshot:** Deletes obsolete or unwanted snapshots individually or clears all snapshots.
- **Export Diagnostics:** Bundles system specifications, recent sanitized logs, and project metadata into a support JSON bundle before taking recovery action.

---

## 4. Schema Version 11 Migration

Project schema 11 introduces native lifecycle configuration and portable package metadata:

```json
{
  "schemaVersion": 11,
  "id": "proj-uuid",
  "name": "Live Broadcast Production",
  "createdAt": "2026-10-22T08:00:00Z",
  "updatedAt": "2026-10-22T10:00:00Z",
  "lifecycleConfig": {
    "autosaveIntervalSeconds": 60,
    "maxRecoverySnapshots": 10,
    "warnOnActiveOutputShutdown": true,
    "gracefulShutdownTimeoutMs": 5000,
    "storageRetentionDays": 30
  },
  "portableConfig": {
    "isPortableBundle": false,
    "relativeMediaFolder": "assets",
    "bundleManifestVersion": "1.0"
  }
}
```

### Migration Policy
When loading a project file:
- If `schemaVersion == 0`: Rejected as invalid project JSON.
- If `schemaVersion > 11`: Rejected with an actionable error informing the user that the project was created in a newer release of LiveStudio Pro.
- If `schemaVersion < 11`: Passed through `ProjectFile::migrate_from_v1()`, which incrementally adds default structures for scenes, audio mixers, overlays, playlists, remote configurations, broadcast aux outputs, and Phase 11 lifecycle configs.
