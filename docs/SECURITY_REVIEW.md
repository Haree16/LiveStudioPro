# LiveStudio Pro — Security Architecture & Threat Review

This document provides a comprehensive security review of LiveStudio Pro, detailing threat models, IPC attack surface mitigation, credential protection, filesystem containment, and remote production controls.

---

## 1. Threat Model & Scope

As a mission-critical broadcast application, LiveStudio Pro faces unique threats:
1. **On-Air Stream Hijacking / Key Exfiltration**: Malicious actors or unauthorized network endpoints attempting to capture RTMP/SRT stream keys or inject unauthorized video feeds.
2. **Credential Leakage via Diagnostics**: Sensitive stream keys, API tokens, or network credentials inadvertently captured in debug logs, crash reports, or support bundles.
3. **Malicious Project Injection**: Maliciously crafted project files (`.lsp`, `.lspbak`) designed to exploit deserialization vulnerabilities or trigger arbitrary remote code execution via embedded macros.
4. **Local Privilege Escalation / Path Traversal**: Unchecked IPC commands manipulating paths to overwrite arbitrary system binaries.
5. **Unauthorized Remote Switcher Control**: Rogue actors on local LAN attempting to trigger scene switches or disconnect streams via automation APIs.

---

## 2. IPC & Tauri Command Boundary

LiveStudio Pro uses Tauri 2's secure IPC bridge interfacing the React frontend with the native Rust backend:

- **Strict Type Enforcement**: All Tauri IPC command handlers accept strongly-typed Serde structures. Untyped payloads are rejected at the IPC boundary.
- **Path Canonicalization & Directory Containment**: All filesystem access commands (`export_portable_package`, `relink_media_assets`, `create_project_backup`, `restore_project_backup`) validate and canonicalize paths using `std::fs::canonicalize`. Relative path traversals (`../`) attempting to escape intended project directories are rejected.
- **Process Isolation**: The frontend runs within an isolated webview context with `nodeIntegration: false` and strict context isolation.

---

## 3. Credential & Secret Protection

### 3.1 In-Memory & Storage Security
- Streaming credentials (RTMP stream keys, SRT passphrases) are stored only within the active `StreamingConfig` in protected application memory and encrypted preferences.
- Secrets are NEVER stored in plain text inside portable project packages (`export_portable_package`) or exported project manifests.

### 3.2 Real-Time Log Redaction
The structured logging engine (`src-tauri/src/diagnostics/logger.rs`) filters all incoming log messages through `sanitize_log_message()`:
```rust
// Automatic pattern-based redaction:
// - RTMP/SRT stream keys: rtmp://.../live/<KEY> -> rtmp://.../live/[REDACTED_STREAM_KEY]
// - Bearer / API tokens: Bearer <TOKEN> -> Bearer [REDACTED_TOKEN]
// - Key=Value pairs: key=..., password=..., secret=... -> [REDACTED]
```

### 3.3 Diagnostic Bundle Sanitization
When the operator generates a diagnostic archive (`livestudio_diag_*.tar.gz`), the `DiagnosticBundleExporter`:
1. Collects system specs, GStreamer pipeline states, and rolling log files.
2. Evaluates every configuration file to strip all passwords, tokens, and stream URLs containing embedded authentication credentials.
3. Excludes all private user media files and audio/video frame buffers.
4. Generates an SHA-256 verified audit log of bundled files.

---

## 4. Safe Project Loading & Macro Execution

A critical attack vector in media production software is project files containing automated scripts or macros that run automatically upon project open.

### LiveStudio Pro Safety Guarantees:
1. **No Auto-Execution on Project Load**: Opening a project or restoring an `.lspbak` archive **NEVER** auto-executes macros, hotkeys, or automation cues. All cues remain in an idle, un-armed state until the operator explicitly runs them.
2. **Schema Migration Validation**: When loading older or external project versions, the schema migrator validates all fields against strict whitelist constraints before instantiating objects in memory.
3. **Recovery File Preservation**: Automatic recovery never modifies or overwrites the user's original `.lsp` project file. If recovery is performed from a snapshot, the original is preserved with a `.bak_<timestamp>` suffix.

---

## 5. Remote Production & Network Access Controls

- **Automation REST & WebSocket APIs**: Require Bearer token authentication configured in application settings. Unauthenticated requests receive HTTP `401 Unauthorized`.
- **Tally & PTZ Protocols**: VISCA over IP and Tally protocols run on dedicated, operator-specified UDP/TCP ports with input validation to prevent buffer overflows or malformed command injections.
- **WebRTC Remote Guests**: WebRTC signaling uses encrypted WSS connections with cryptographically secure random session tokens. WebRTC media streams are encrypted end-to-end via SRTP/DTLS.
