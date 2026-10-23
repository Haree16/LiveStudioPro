# LiveStudio Pro — Media Relinking & Asset Resolution

**Version:** 1.0.0-rc1  
**Module:** `src-tauri/src/project/relink.rs` & `src/components/MediaRelinkModal.tsx`

---

## 1. Overview

When media files are moved, external drives are unplugged, or project directories are relocated across platforms, asset links can break. LiveStudio Pro provides a robust, operator-guided **Media Relinking Workspace** designed around safety and precision:
- Scans candidate folders recursively.
- Scores matches using multiple configurable criteria.
- Flags ambiguous duplicate matches to prevent accidental asset mix-ups.
- Requires operator preview and confirmation before writing updated references to disk.
- Never silently replaces an asset with an unrelated file.

---

## 2. Match Strategies

Operators can select from four matching modes depending on the scenario:

| Mode | Match Logic | Confidence Score | Typical Use Case |
| :--- | :--- | :--- | :--- |
| **Exact Filename** | Exact byte-for-byte filename match (including Unicode and Tamil characters). | 1.0 (100%) | Standard folder moves where filenames were not modified. |
| **Case-Insensitive** | Filename match ignoring uppercase/lowercase differences. | 0.9–1.0 | Projects migrated between Windows (case-insensitive) and Linux (case-sensitive) filesystems. |
| **Size & Name** | Filename match combined with file size verification. | 0.95 | Ensuring that replaced clips match the expected render length and codec profile. |
| **SHA-256 Checksum** | Filename match with cryptographic hash verification against stored manifest checksums. | 1.0 | Strict broadcast compliance verification for commercial and sponsor assets. |

---

## 3. Ambiguous Candidate Detection

A major danger in media relinking is **ambiguous matches**: for example, if multiple cameras produced files named `clip001.mp4` across different subfolders (`card1/clip001.mp4` and `card2/clip001.mp4`).

If multiple candidate files in the searched folder match the missing asset:
1. `RelinkCandidate.is_ambiguous` is set to `true`.
2. The UI renders an **Ambiguous (+N candidates)** warning badge in amber.
3. Automatic checkbox selection is skipped for that candidate, requiring the operator to review the proposed file path manually before confirming.

---

## 4. Operator Workflow

1. Open **Media Relinking** from the status bar or the missing asset drawer.
2. Select the search directory (e.g., an attached USB drive or network share).
3. Choose the match strategy.
4. Click **Scan For Missing Media**.
5. The workspace presents a candidate table displaying:
   - Original missing asset path.
   - Proposed replacement path.
   - Match confidence score.
   - Ambiguity warning status.
6. Verify selections and click **Apply Confirmed Relinks**.
7. The project references are atomically updated, `isMissing` is cleared, and an autosave recovery snapshot is created.
