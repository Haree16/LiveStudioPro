use tempfile::tempdir;

use livestudio_lib::core::controller::ProductionController;
use livestudio_lib::project::model::{InputItem, InputState, InputType, ProjectFile};
use livestudio_lib::project::persistence::ProjectStore;

#[test]
fn test_screen_capture_and_virtual_inputs_instantiation() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    // 1. Add Screen Capture input
    let screen_input = InputItem::new(
        "screen-1",
        "Primary Desktop Capture",
        InputType::ScreenCapture,
        "desktop:0",
    );
    let proj_after_screen = controller.add_input(screen_input).expect("Failed to add screen capture input");
    assert_eq!(proj_after_screen.inputs.len(), 1);
    assert_eq!(proj_after_screen.inputs[0].input_type, InputType::ScreenCapture);

    // 2. Add Virtual Input
    let virtual_input = InputItem::new(
        "virtual-1",
        "Virtual Sub-Mix Bus",
        InputType::VirtualInput,
        "clone:screen-1",
    );
    let proj_after_virtual = controller.add_input(virtual_input).expect("Failed to add virtual input");
    assert_eq!(proj_after_virtual.inputs.len(), 2);
    assert_eq!(proj_after_virtual.inputs[1].input_type, InputType::VirtualInput);

    // Verify both are present in current project
    let current = controller.get_current_project();
    assert_eq!(current.inputs.len(), 2);
}

#[test]
fn test_color_adjustment_and_playback_rate_controls() {
    let controller = ProductionController::new().expect("Failed to initialize controller");

    let test_input = InputItem::new(
        "color-test-1",
        "Color Test Pattern",
        InputType::TestPattern,
        "smpte",
    );
    controller.add_input(test_input).expect("Failed to add test pattern input");

    // 1. Test color adjustment
    controller
        .set_input_color_adjust("color-test-1", 0.25, 1.2, 1.5, -0.1)
        .expect("Failed to set color adjustment");

    let proj = controller.get_current_project();
    let saved_input = proj.inputs.iter().find(|i| i.id == "color-test-1").unwrap();
    assert!(saved_input.color_adjust.is_some());
    let color = saved_input.color_adjust.as_ref().unwrap();
    assert!((color.brightness - 0.25).abs() < 0.001);
    assert!((color.contrast - 1.2).abs() < 0.001);
    assert!((color.saturation - 1.5).abs() < 0.001);
    assert!((color.hue - (-0.1)).abs() < 0.001);

    // 2. Test playback rate controls
    controller
        .set_input_playback_rate("color-test-1", 1.5)
        .expect("Failed to set playback rate");

    let state = controller
        .get_input_playback_state("color-test-1")
        .expect("Failed to get playback state");
    assert!((state.playback_rate - 1.5).abs() < 0.001);
}

#[test]
fn test_missing_asset_detection_and_relinking_flow() {
    let dir = tempdir().expect("Failed to create tempdir");
    let proj_path = dir.path().join("test_relink.lsproj");

    let existing_file = dir.path().join("intro.mp4");
    std::fs::write(&existing_file, b"fake intro video bytes").unwrap();

    let missing_file = dir.path().join("non_existent_outro.mp4");

    // Create project with one present and one missing file
    let mut proj = ProjectFile::new("Relink Test Project");
    let input1 = InputItem::new("in-1", "Intro Video", InputType::MediaFile, existing_file.to_string_lossy());
    let input2 = InputItem::new("in-2", "Outro Video", InputType::MediaFile, missing_file.to_string_lossy());
    proj.inputs.push(input1);
    proj.inputs.push(input2);

    ProjectStore::save(&proj, &proj_path).expect("Failed to save project");

    // Load project in controller
    let controller = ProductionController::new().expect("Failed to init controller");
    let loaded = controller.load_project(&proj_path).expect("Failed to load project with missing file");

    let in1 = loaded.inputs.iter().find(|i| i.id == "in-1").unwrap();
    let in2 = loaded.inputs.iter().find(|i| i.id == "in-2").unwrap();

    assert!(!in1.is_missing);
    assert!(in2.is_missing);
    assert_eq!(in2.state, InputState::Error);

    // Now create the new target file and relink directly
    let new_destination_file = dir.path().join("relocated_outro.mp4");
    std::fs::write(&new_destination_file, b"relocated outro video bytes").unwrap();

    controller
        .relink_media_asset(
            &missing_file.to_string_lossy(),
            &new_destination_file.to_string_lossy(),
        )
        .expect("Failed to relink asset");

    let current = controller.get_current_project();
    let relinked_in2 = current.inputs.iter().find(|i| i.id == "in-2").unwrap();
    assert_eq!(relinked_in2.source_path_or_id, new_destination_file.to_string_lossy());
    assert!(!relinked_in2.is_missing);
}
