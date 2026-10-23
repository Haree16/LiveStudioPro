# LiveStudio Pro — Remote Guest Contribution Guide

## 1. Overview

The Remote Guest contribution system allows live interviews, co-hosts, callers, and field contributors to join productions directly from any modern web browser without installing third-party software.

---

## 2. Operator Workflow

### Step 1: Open Remote Guests Workspace
Click the **Remote Guests** button on the top workspace navbar to open the guest management modal.

### Step 2: Configure Invitation
1. **Guest Name:** Enter interviewee or participant name (e.g. `Dr. Alice Smith`).
2. **Production Role:** Select `Guest`, `Co-Host`, `Subject Expert`, or `Call-in Audience`.
3. **Link Expiration:** Choose valid duration (`15 min`, `30 min`, `1 hour`, `2 hours`, `4 hours`, `24 hours`). Once expired, the link cannot be used to establish a new session.
4. **Target Production Input:** Choose a specific production input slot or leave as `Auto-Assign`.
5. **Return Feeds:** Toggle `Audio Return (Program Mix Minus)` and `Video Return (Program Feed)`.

### Step 3: Copy and Share Link
Click **Generate Invitation Link**, then click **Copy Link**. The generated URL follows the format:
```
http://<host-ip>:8088/guest/<token>
```

---

## 3. Remote Guest Browser Experience

When the remote guest opens the link:
1. The browser requests standard camera and microphone permissions.
2. The guest can select their preferred webcam and microphone from dropdown lists.
3. The guest sees their local video preview and a Program Return monitor.
4. Mute Microphone and Stop Video controls are available.
5. Live telemetry (RTT, packet loss, resolution, framerate) is continuously reported back to the operator console.

---

## 4. Production Audio Integration & Mix-Minus

Remote guests receive an automated Program Mix-Minus:
- The return audio contains the full Program mix **excluding** the guest's own microphone.
- Prevents feedback loops and echoes for the guest.
- The guest's contribution is routed to an independent channel in the native audio mixer with EQ, compression, gate, and fader control.
