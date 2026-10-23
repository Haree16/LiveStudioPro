# LiveStudio Pro — Windows Packaging & Installation Guide

**Version:** 1.0.0-rc1  
**Target OS:** Windows 10 & 11 (64-bit x86_64)  
**Package Formats:** NSIS Installer (`.exe`), MSI Package (`.msi`)

---

## 1. System Requirements

### Minimum
- **Operating System:** Windows 10 64-bit (Version 2004 or later).
- **Processor:** Intel Core i5 (6th Gen) / AMD Ryzen 5 or equivalent (4 cores).
- **Memory:** 8 GB RAM.
- **Graphics:** DirectX 11 / Direct3D 11 compatible GPU.
- **Storage:** 500 MB for application binaries; 20+ GB recommended for ISO recordings.

### Recommended
- **Processor:** Intel Core i7 (10th Gen+) / AMD Ryzen 7 (8+ cores).
- **Memory:** 16 GB or 32 GB DDR4/DDR5 RAM.
- **Graphics:** NVIDIA GeForce RTX 3060+ with NVENC hardware encoder.
- **Storage:** Dedicated NVMe SSD for multi-angle ISO recording.

---

## 2. Required Runtimes

1. **Microsoft Edge WebView2 Runtime:** Pre-installed on Windows 10/11; automatically updated by Windows Update.
2. **Visual C++ Redistributable 2015–2022 (x64):** Required by native Rust and GStreamer binaries.
3. **GStreamer MSVC 64-bit Runtime:** Bundled or installed via the official GStreamer Windows installer.

---

## 3. Installation Walkthrough (NSIS Installer)

1. Download `LiveStudioPro_1.0.0-rc1_x64-setup.exe`.
2. Double-click the installer. If a Windows SmartScreen prompt appears:
   > *Windows protected your PC: LiveStudio Pro is an open-source/developer release. Click "More info" and select "Run anyway".*
3. Select installation directory (default: `%LOCALAPPDATA%\Programs\LiveStudioPro`).
4. Complete installation. A desktop shortcut and Start Menu entry are created.
5. Launch LiveStudio Pro. On first run, the **System Compatibility Workspace** verifies hardware encoders and audio/video input devices.

---

## 4. Upgrading & Data Preservation

- Installing a newer release automatically upgrades the binary files in `%LOCALAPPDATA%\Programs\LiveStudioPro`.
- User projects, application preferences, credential vaults, and recorded media in `%APPDATA%\LiveStudioPro\` are **strictly preserved** during upgrades.

---

## 5. Uninstallation

To remove LiveStudio Pro:
1. Open **Windows Settings > Apps > Installed apps**.
2. Locate **LiveStudio Pro** and click **Uninstall**.
3. The uninstaller removes application binaries, shortcuts, and registry entries.
4. User projects and recordings in `%APPDATA%\LiveStudioPro\` are preserved by default so that user data is never lost.
