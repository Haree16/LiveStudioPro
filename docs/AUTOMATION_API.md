# LiveStudio Pro — Automation API Reference (Phase 9)

## 1. Native Tauri Commands

### Macro Management
- `automation_list_actions()`: Returns list of all registered `ActionDefinition` metadata with schemas and safety tiers.
- `automation_list_macros()`: Returns array of saved `MacroDefinition` objects.
- `automation_get_macro(id: String)`: Returns specific macro by ID or null.
- `automation_save_macro(macro_def: MacroDefinition)`: Saves or updates a macro.
- `automation_delete_macro(id: String)`: Removes a macro by ID.
- `automation_run_macro(id: String, trigger_source: String)`: Asynchronously runs a macro and returns `MacroExecutionRecord`.

### Direct Action Execution
- `automation_execute_action(invocation: ActionInvocation)`: Dispatches a single action to the native engine with parameter validation and safety checks.

### Safety Governor & Emergency Stop
- `automation_emergency_stop()`: Immediately engages emergency stop, cancels all running macros, and locks out automation.
- `automation_reset_emergency_stop()`: Resets emergency stop lockout.
- `automation_is_emergency_stopped()`: Returns boolean indicating emergency stop status.
- `automation_get_policy()`: Returns current `AutomationPolicy`.
- `automation_set_policy(policy: AutomationPolicy)`: Updates safety governance policy.

### Hotkeys & Shortcuts
- `automation_list_hotkeys()`: Returns all hotkey mappings.
- `automation_set_hotkeys(mappings: Vec<HotkeyMapping>)`: Validates for collisions and saves hotkey set.

### MIDI Subsystem
- `automation_list_midi_devices()`: Returns list of available physical MIDI input device names.
- `automation_list_midi_mappings()`: Returns all active MIDI mappings.
- `automation_set_midi_mappings(mappings: Vec<MidiMapping>)`: Saves MIDI mappings.
- `automation_set_midi_learning(enabled: bool)`: Toggles interactive learn mode.
- `automation_get_last_midi_learned()`: Returns the most recent hardware packet detected.

### Scheduling & History
- `automation_list_cues()`: Returns list of scheduled timed cues.
- `automation_add_cue(cue: TimedCue)`: Adds a timed cue.
- `automation_remove_cue(id: String)`: Deletes a timed cue.
- `automation_get_history()`: Returns the execution audit log ring buffer.
