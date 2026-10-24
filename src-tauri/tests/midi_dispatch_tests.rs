use std::sync::Mutex;

use livestudio_lib::automation::midi::{MidiControlMode, MidiMapping, MidiMessageType, MidiSubsystem};

fn mapping(id: &str, ty: MidiMessageType, num: u8, mode: MidiControlMode, device: Option<&str>) -> MidiMapping {
    MidiMapping {
        id: id.into(),
        name: id.into(),
        device_name: device.map(String::from),
        channel: Some(0),
        message_type: ty,
        note_or_cc: num,
        control_mode: mode,
        target_action_id: Some("audio.setFader".into()),
        target_macro_id: None,
        min_value: -60.0,
        max_value: 6.0,
        enabled: true,
    }
}

#[test]
fn test_dispatch_routes_mapped_messages_to_handler() {
    let midi = MidiSubsystem::new();
    midi.set_mappings(vec![
        mapping("fader", MidiMessageType::ControlChange, 7, MidiControlMode::ContinuousFader, Some("Korg")),
        mapping("pad", MidiMessageType::NoteOn, 36, MidiControlMode::ButtonPress, None),
        mapping("cc-btn", MidiMessageType::ControlChange, 20, MidiControlMode::ButtonPress, None),
    ]);
    let seen: Mutex<Vec<(String, Option<f32>)>> = Mutex::new(Vec::new());
    let h = |m: MidiMapping, v: Option<f32>| seen.lock().unwrap().push((m.id, v));

    midi.dispatch_raw("Korg", &[0xB0, 7, 127], &h); // fader full -> +6 dB
    midi.dispatch_raw("Korg", &[0xB0, 7, 0], &h); // fader zero -> -60 dB (must still fire)
    midi.dispatch_raw("Other", &[0xB0, 7, 64], &h); // wrong device -> ignored
    midi.dispatch_raw("Any", &[0x90, 36, 100], &h); // pad press
    midi.dispatch_raw("Any", &[0x90, 36, 0], &h); // velocity-0 note = release -> NoteOff, unmapped
    midi.dispatch_raw("Any", &[0xB0, 20, 127], &h); // CC button press
    midi.dispatch_raw("Any", &[0xB0, 20, 0], &h); // CC button release -> ignored
    midi.dispatch_raw("Any", &[0xB1, 7, 10], &h); // wrong channel -> ignored
    midi.dispatch_raw("Any", &[0xF8], &h); // too short

    let seen = seen.into_inner().unwrap();
    assert_eq!(
        seen,
        vec![
            ("fader".to_string(), Some(6.0)),
            ("fader".to_string(), Some(-60.0)),
            ("pad".to_string(), None),
            ("cc-btn".to_string(), None),
        ]
    );
}

#[test]
fn test_learn_mode_captures_instead_of_dispatching() {
    let midi = MidiSubsystem::new();
    midi.set_mappings(vec![mapping("pad", MidiMessageType::NoteOn, 36, MidiControlMode::ButtonPress, None)]);
    midi.set_learning_mode(true);
    let fired = Mutex::new(0);
    midi.dispatch_raw("Pad", &[0x90, 36, 100], &|_, _| *fired.lock().unwrap() += 1);
    assert_eq!(*fired.lock().unwrap(), 0);
    let learned = midi.get_last_learned().expect("learned");
    assert_eq!((learned.note_or_cc, learned.device_name.as_str()), (36, "Pad"));
}
