# LiveStudio Pro — Open Source License Compliance & Architectural Boundaries

This document analyzes the legal and architectural compliance of all third-party software libraries, runtimes, and components utilized by LiveStudio Pro.

---

## 1. Compliance Architecture Overview

LiveStudio Pro is designed with strict architectural boundaries to ensure compliance with permissive (MIT, Apache-2.0, BSD) and copyleft (LGPL-2.1, GPL-2.0) open-source licenses:

```mermaid
graph TD
    subgraph Proprietary / Application Core
        LSP[LiveStudio Pro Core - Rust & TypeScript]
    end

    subgraph Permissive Rust Crates [MIT / Apache-2.0]
        Tauri[Tauri 2.0 Framework]
        Tokio[Tokio Async Runtime]
        Serde[Serde JSON Serialization]
        Tar[Tar / Flate2 Archivers]
    end

    subgraph Dynamic Shared Libraries [LGPL-2.1 Compliance Boundary]
        GST[GStreamer Core & Plugins - Shared Objects / DLLs]
        WebKit[WebKit2GTK / WebView2 Runtime]
    end

    subgraph External Process Boundary [GPL / LGPL Boundary]
        FFmpeg[FFmpeg / FFprobe CLI Tool]
        V4L2[v4l2loopback Kernel Module]
    end

    LSP -->|Static Link| Permissive Rust Crates
    LSP -->|Dynamic C-FFI Linking| Dynamic Shared Libraries
    LSP -->|Fork/Exec CLI Subprocess| External Process Boundary
```

---

## 2. License Breakdown by Category

### 2.1 Application Core & Permissive Crates (MIT / Apache-2.0 / ISC)
All direct application code, UI components, and the following Rust crates are licensed under dual MIT/Apache-2.0 or ISC licenses:
- `tauri`, `tauri-plugin-shell`
- `tokio`, `serde`, `serde_json`, `chrono`, `uuid`, `sha2`, `tar`, `flate2`, `reqwest`, `sysinfo`, `tempfile`
- `react`, `react-dom`, `lucide-react`, `tailwindcss`, `vite`, `typescript`

**Compliance Requirement**: Retain original copyright notices and permission notices in distributed binary packages and documentation.

### 2.2 GStreamer Dynamic Linking (LGPL-2.1 / LGPL-2.0+)
GStreamer core libraries and base plugins are licensed under the GNU Lesser General Public License (LGPL) version 2.1 or later.
- **Architectural Boundary**: LiveStudio Pro interfaces with GStreamer exclusively through dynamically linked shared libraries (`libgstreamer-1.0.so` on Linux, `gstreamer-1.0-0.dll` on Windows) via official `gstreamer-rs` bindings.
- **Compliance Guarantee**:
  - LiveStudio Pro code is not statically compiled into GStreamer, nor is GStreamer code statically compiled into the LiveStudio Pro executable.
  - End users are legally and technically free to replace, upgrade, or recompile the system GStreamer shared libraries without requiring changes to or re-licensing of LiveStudio Pro.

### 2.3 FFmpeg Subprocess Execution (LGPL-2.1+ / GPL-2.0+)
FFmpeg is frequently built with GPL components (e.g., `libx264`, `libx265`).
- **Architectural Boundary**: LiveStudio Pro **does not link** (neither statically nor dynamically) against FFmpeg libraries (`libavcodec`, `libavformat`, etc.).
- **Process Isolation**: LiveStudio Pro invokes `ffmpeg` and `ffprobe` strictly as standalone external command-line executables via standard operating system process pipes (`std::process::Command` / `tauri_plugin_shell`).
- **Compliance Guarantee**: Under established copyright jurisprudence, standard IPC and process execution across process boundaries does not create a derivative work under GPL. LiveStudio Pro may be distributed alongside standard system FFmpeg packages without triggering reciprocal licensing terms.

### 2.4 Linux Kernel Modules (v4l2loopback - GPL-2.0)
The virtual webcam driver `v4l2loopback` is a Linux kernel module. LiveStudio Pro opens and writes to `/dev/video*` standard character device nodes via the Linux Video4Linux2 API. Standard Linux userspace system call usage (`ioctl`, `write`) does not affect userspace application licensing.

---

## 3. Distribution & Attribution Checklist

Prior to distributing binary installers (`.deb`, `.AppImage`, `.exe`), the release package must include:
1. `LICENSE`: LiveStudio Pro application license.
2. `THIRD_PARTY_NOTICES.txt`: Complete verbatim license texts and copyright statements for all bundled crates, npm modules, and web fonts.
3. Instructions on obtaining source code for any LGPL or GPL components distributed alongside the application.
