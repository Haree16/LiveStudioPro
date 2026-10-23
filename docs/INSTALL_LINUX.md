# LiveStudio Pro — Linux Installation & Deployment Guide

This guide details the deployment, package installation, and hardware permission configuration for LiveStudio Pro on modern Linux desktop environments.

---

## 1. Supported Distributions

LiveStudio Pro is officially packaged and verified for 64-bit (`x86_64`) Linux distributions:
- **Ubuntu**: 22.04 LTS (Jammy Jellyfish), 24.04 LTS (Noble Numbat)
- **Debian**: 12 (Bookworm) and newer
- **Fedora**: 39, 40, and newer
- **Arch Linux / Manjaro**: Rolling release

---

## 2. System Prerequisites & Dependencies

LiveStudio Pro utilizes GStreamer for native low-latency multimedia routing, hardware encoders (VAAPI/NVENC), and PipeWire/PulseAudio for multi-channel audio mixing.

### 2.1 Ubuntu / Debian Package Installation

Install the required GStreamer runtime plugins, audio backends, and v4l2 device tools:

```bash
sudo apt-get update && sudo apt-get install -y \
  libwebkit2gtk-4.1-0 \
  libappindicator3-1 \
  librsvg2-common \
  gstreamer1.0-tools \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly \
  gstreamer1.0-vaapi \
  gstreamer1.0-pipewire \
  gstreamer1.0-pulseaudio \
  ffmpeg \
  v4l2loopback-dkms \
  v4l-utils
```

### 2.2 Fedora Package Installation

```bash
sudo dnf install -y \
  webkit2gtk4.1 \
  libappindicator-gtk3 \
  gstreamer1 \
  gstreamer1-plugins-base \
  gstreamer1-plugins-good \
  gstreamer1-plugins-bad-free \
  gstreamer1-plugins-ugly-free \
  gstreamer1-vaapi \
  ffmpeg \
  v4l2loopback \
  v4l-utils
```

### 2.3 Arch Linux Package Installation

```bash
sudo pacman -Syu --needed \
  webkit2gtk-4.1 \
  libappindicator-gtk3 \
  gst-plugins-base \
  gst-plugins-good \
  gst-plugins-bad \
  gst-plugins-ugly \
  gst-vaapi \
  gst-plugin-pipewire \
  ffmpeg \
  v4l2loopback-dkms \
  v4l-utils
```

---

## 3. User Groups & Device Permissions

To access USB webcams, SDI/HDMI capture cards (Blackmagic DeckLink / Magewell), audio interfaces, and GPU hardware acceleration nodes, the running operator user must belong to the proper Linux security groups:

```bash
# Add current user to video, audio, and render groups
sudo usermod -aG video,audio,render $USER
```

> **IMPORTANT**: After modifying user groups, log out and log back into your desktop session (or reboot) for group privileges to take effect. Verify with `groups`.

### 3.1 VA-API / DRM Permissions
Ensure `/dev/dri/renderD128` is accessible to the `render` group:
```bash
ls -l /dev/dri/renderD128
# Output should show: crw-rw----+ 1 root render ...
```

### 3.2 Virtual Webcam Output (v4l2loopback)
To output Program video to Zoom, Teams, or browser applications as a virtual webcam:
```bash
# Load module with 1 virtual output channel
sudo modprobe v4l2loopback devices=1 video_nr=10 card_label="LiveStudio Pro Virtual Cam" exclusive_caps=1
```
To persist this across system reboots, add to `/etc/modules-load.d/v4l2loopback.conf`:
```
v4l2loopback
```
And create `/etc/modprobe.d/v4l2loopback.conf`:
```
options v4l2loopback devices=1 video_nr=10 card_label="LiveStudio Pro Virtual Cam" exclusive_caps=1
```

---

## 4. Installing the Debian (.deb) Package

Download the official Debian release package:
```bash
sudo dpkg -i livestudiopro_1.0.0-rc1_amd64.deb
```
If any system dependencies are missing, resolve them automatically using:
```bash
sudo apt-get install -f
```

The application launcher icon will appear in your desktop application menu under **Sound & Video** / **Broadcast**.

---

## 5. Running the AppImage

The AppImage bundle contains the application runtime and webview integration in a single portable executable.

1. Ensure FUSE (Filesystem in Userspace) is installed:
   ```bash
   # Ubuntu 22.04 / 24.04
   sudo apt-get install -y libfuse2
   # Fedora
   sudo dnf install -y fuse-libs
   # Arch
   sudo pacman -S fuse2
   ```

2. Make the AppImage executable:
   ```bash
   chmod +x LiveStudioPro_1.0.0-rc1_amd64.AppImage
   ```

3. Launch LiveStudio Pro:
   ```bash
   ./LiveStudioPro_1.0.0-rc1_amd64.AppImage
   ```

---

## 6. Wayland vs. X11 Display Capture Considerations

- **X11 Sessions**: Full desktop and individual window capture functions out of the box via `ximagesrc`.
- **Wayland Sessions**: Screen and window capture requires PipeWire and the desktop portal (`xdg-desktop-portal` with `xdg-desktop-portal-gnome` or `xdg-desktop-portal-wlr`). When capturing screens in Wayland, the system will prompt the user to grant permission for the selected display or window.
- For maximum performance and lowest capture latency with hardware video switchers, an X11 session or PipeWire-native compositing pipeline is recommended.

---

## 7. Storage & Configuration Directories

On Linux, LiveStudio Pro stores files according to the XDG Base Directory specification:
- **Application Configuration & Projects**: `~/.config/LiveStudioPro/`
- **Autosave Snapshots**: `~/.config/LiveStudioPro/snapshots/`
- **Rolling Diagnostics Logs**: `~/.local/share/LiveStudioPro/logs/` or `~/.config/LiveStudioPro/logs/`
- **Temporary Cache**: `/tmp/LiveStudioPro/` or `~/.cache/LiveStudioPro/`
