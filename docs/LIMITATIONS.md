# Phase 1: Known Limitations & Constraints

1. **No Simulated Video or Fake Broadcast Outputs**:
   - The application does NOT pretend to stream or record when encoders are not active.
   - Preview and Program monitors display actual media if loaded, or clearly marked standby/placeholder indicators.
2. **Switching Engine Scope**:
   - In Phase 1, switching controls (CUT, AUTO, T-Bar) manipulate Preview and Program target selections and transition states. The real-time multi-bus OpenGL/Direct3D compositor pipeline is scheduled for Phase 2.
3. **Capture Hardware Permissions**:
   - On Linux, accessing `/dev/video*` capture devices requires user membership in the `video` group. The application diagnoses this explicitly.
4. **Media Playback Scope**:
   - Local media files (MP4, MKV, MOV, WebM, etc.) are deeply inspected using real GStreamer Discoverer (extracting exact container format, duration, video codecs, dimensions, framerates, and audio tracks).
5. **Autosave Recovery**:
   - The recovery mechanism tracks dirty states and writes to a session recovery file (`.livestudio_recovery.json`). If the app exits unexpectedly, the recovery dialog prompts the user to restore the last valid state.
