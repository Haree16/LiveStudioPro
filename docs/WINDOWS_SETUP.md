# Windows Development & Build Setup Guide

LiveStudio Pro is designed with Windows as its primary target.

## 1. Prerequisites

1. **Microsoft Visual Studio 2022**:
   - Install the **Desktop development with C++** workload.
   - Includes MSVC v143, Windows 10/11 SDK.
2. **Rust Toolchain**:
   - `rustup default stable-x86_64-pc-windows-msvc`
3. **Node.js**:
   - Node.js LTS (v20+ or v24+).
4. **WebView2**:
   - Preinstalled on Windows 10 (modern versions) and Windows 11.
5. **GStreamer 1.24+ / 1.28+ (MSVC 64-bit)**:
   - Download the official MSVC 64-bit binary packages:
     1. Runtime installer: `gstreamer-1.0-msvc-x86_64-*.msi`
     2. Development installer: `gstreamer-1.0-devel-msvc-x86_64-*.msi`
   - Select **Complete** installation for both.

## 2. Environment Variables Configuration

Set the following system environment variables:

```powershell
# GStreamer paths (standard 64-bit installation path)
$env:GSTREAMER_1_0_ROOT_MSVC_X86_64 = "C:\gstreamer\1.0\msvc_x86_64\"
$env:PKG_CONFIG_PATH = "C:\gstreamer\1.0\msvc_x86_64\lib\pkgconfig"
$env:PATH = "C:\gstreamer\1.0\msvc_x86_64\bin;C:\gstreamer\1.0\msvc_x86_64\lib;" + $env:PATH
```

Install `pkg-config-lite` or use `vcpkg` if `pkg-config` is not in your Windows PATH:
```powershell
winget install -e --id pkg-config.pkg-config-lite
```

## 3. Building & Packaging

```powershell
# 1. Install frontend packages
npm install

# 2. Run unit & integration test suite
npm run test
cargo test --manifest-path src-tauri/Cargo.toml

# 3. Run desktop app in development mode
npm run tauri dev

# 4. Create release bundle (.msi / .exe installer)
npm run tauri build
```

## 4. Hardware Acceleration Notes on Windows
- NVIDIA NVENC/NVDEC requires NVIDIA Graphics Driver >= 535.
- Intel QuickSync Video is supported out of the box via MSVC D3D11 / MFT elements.
- DirectShow capture devices (`dshowvideosrc`) and MediaFoundation capture (`mfvideosrc`) are enumerated natively.
