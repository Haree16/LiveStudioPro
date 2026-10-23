# LiveStudio Pro — Portable Projects & Asset Manifests

**Version:** 1.0.0-rc1  
**Target Specification:** Cross-Platform Project Portability & Media Packaging

---

## 1. Overview

In professional multi-camera productions, projects are frequently prepared on studio workstations and transferred to OB vans, venue laptops, or archive storage. Standard production files that rely exclusively on absolute filesystem paths (e.g., `C:\Users\Director\Videos\intro.mp4` or `/home/director/media/intro.mp4`) break when opened on a different machine or OS.

Phase 11 introduces **Portable Project Packaging** and **Relative Media Resolution**:
- Organizes a project and its referenced media into a self-contained directory bundle.
- Generates a verified `manifest.json` with SHA-256 integrity hashes, file sizes, and asset IDs.
- Fully supports non-ASCII and Unicode filenames (including Tamil script, e.g., `காணொளி_நேரலை.mp4`).
- Offers choice between **Copy All Media** (self-contained package) and **Keep External References** (lightweight manifest).

---

## 2. Portable Folder Structure

```
MyProductionBundle/
├── manifest.json              <-- Package manifest with SHA-256 checksums
├── MyProduction.lsp           <-- Primary project file (pointing to relative asset paths)
└── assets/                    <-- Copied or linked media assets
    ├── e8f912ab_intro.mp4
    ├── a1c490bc_sponsor_logo.png
    ├── d492ef11_lower_third.svg
    ├── b3912ca8_LUT_FilmLook.cube
    └── f8921b33_நேரலை_காணொளி.mp4
```

---

## 3. Manifest Specification (`manifest.json`)

```json
{
  "manifestVersion": "1.0",
  "projectId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "projectName": "Championship Live Production",
  "schemaVersion": 11,
  "exportedAt": "2026-10-22T10:15:00Z",
  "projectFileName": "Championship_Live_Production.lsp",
  "assetsFolderName": "assets",
  "totalAssetsCount": 5,
  "copiedAssetsCount": 5,
  "totalSizeBytes": 524288000,
  "assets": [
    {
      "assetId": "in-video-01",
      "originalPath": "/home/hari-pc/Videos/intro.mp4",
      "relativePath": "assets/e8f912ab_intro.mp4",
      "fileSizeBytes": 45120000,
      "sha256Checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "mediaType": "MediaFile",
      "isMissing": false
    },
    {
      "assetId": "in-video-02",
      "originalPath": "/home/hari-pc/Videos/நேரலை_காணொளி.mp4",
      "relativePath": "assets/f8921b33_நேரலை_காணொளி.mp4",
      "fileSizeBytes": 320000000,
      "sha256Checksum": "a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
      "mediaType": "MediaFile",
      "isMissing": false
    }
  ]
}
```

---

## 4. Export Modes

1. **Copy All Media (`PortableExportMode::CopyAllMedia`):**
   - Copies every referenced video file, audio track, still image, graphics template, and 3D LUT into the `assets/` subfolder.
   - Names each asset with a prefix derived from its unique asset ID (`<id_prefix>_<original_name>`) to prevent collisions if different inputs refer to files with identical names from different directories.
   - Updates `sourcePathOrId` in the project file to the relative path (`assets/<filename>`).
   - Ensures the bundle can be moved to any external drive, Windows machine, or Linux host without missing media.

2. **Keep External References (`PortableExportMode::KeepExternalReferences`):**
   - Retains original paths for huge video assets while exporting the manifest and lightweight templates.
   - Ideal for local project backup where media files reside on high-speed network storage (SAN/NAS).

---

## 5. Relative Path Resolution Engine

When a project is loaded, `PortableProjectManager::resolve_asset_path()` evaluates asset paths in order:
1. **Direct Path Probe:** Check if `sourcePathOrId` exists at the literal path on disk.
2. **Project Root Probe:** Check if path exists relative to the project directory (`project_dir.join(path)`).
3. **Assets Subfolder Probe:** Check if the filename exists inside `<project_dir>/assets/<filename>`.
4. If all checks fail, the input is flagged with `isMissing: true`, allowing the **Media Relinking Workspace** to assist the operator in reconnecting the asset.
