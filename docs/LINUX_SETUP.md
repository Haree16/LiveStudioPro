# Linux Development & Runtime Setup Guide

## 1. Prerequisites

LiveStudio Pro on Linux requires Rust (1.80+), Node.js (20+), GStreamer (1.20+), WebKit2GTK, and GTK 3.

### 1.1. Arch Linux / Manjaro
```bash
sudo pacman -S --needed \
    base-devel \
    rust \
    cargo \
    nodejs \
    npm \
    pkg-config \
    webkit2gtk-4.1 \
    gtk3 \
    gstreamer \
    gst-plugins-base \
    gst-plugins-good \
    gst-plugins-bad \
    gst-plugins-ugly \
    gst-libav
```

### 1.2. Ubuntu / Debian (22.04 LTS / 24.04 LTS)
```bash
sudo apt update && sudo apt install -y \
    build-essential \
    curl \
    pkg-config \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    libssl-dev \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    libgstreamer-plugins-bad1.0-dev \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-tools \
    gstreamer1.0-vaapi
```

### 1.3. Fedora / RHEL
```bash
sudo dnf install -y \
    gcc gcc-c++ make \
    pkgconf-pkg-config \
    gtk3-devel \
    webkit2gtk4.1-devel \
    openssl-devel \
    gstreamer1-devel \
    gstreamer1-plugins-base-devel \
    gstreamer1-plugins-bad-free-devel \
    gstreamer1-plugins-good \
    gstreamer1-plugins-bad-free \
    gstreamer1-plugins-ugly-free \
    gstreamer1-vaapi
```

## 2. Capture Device Permissions

To access V4L2 webcams and video capture cards (`/dev/video*`) without root permissions:
```bash
sudo usermod -aG video $USER
```
Log out and log back in for the group membership to take effect.

## 3. Building & Running

```bash
# 1. Switch to Node 20+
nvm use 24

# 2. Install frontend dependencies
npm install

# 3. Run frontend tests
npm run test

# 4. Run Rust native tests
cd src-tauri && cargo test && cd ..

# 5. Launch desktop development application
npm run tauri dev

# 6. Build production package
npm run tauri build
```
