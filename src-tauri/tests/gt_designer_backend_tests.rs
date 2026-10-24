use livestudio_lib::graphics::GtTemplateStore;
use std::sync::Mutex;
use tempfile::tempdir;

static ENV_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_gt_template_save_load_and_delete() {
    let _guard = ENV_LOCK.lock().unwrap();
    let temp_dir = tempdir().expect("Failed to create tempdir");
    unsafe {
        std::env::set_var("LIVESTUDIO_DATA_DIR", temp_dir.path());
    }

    let template_id = "test-lower-third";
    let sample_json = r##"{
        "schemaVersion": 1,
        "id": "test-lower-third",
        "name": "Test Keynote Lower Third",
        "category": "Lower Third",
        "tags": ["keynote", "test"],
        "canvas": {
            "width": 1920,
            "height": 1080,
            "fps": 60,
            "backgroundColor": "#000000",
            "transparent": true,
            "safeAreaTitle": 0.8,
            "safeAreaAction": 0.9
        },
        "layers": []
    }"##;

    // 1. Save template atomically
    let saved_path = GtTemplateStore::save_template(sample_json, template_id)
        .expect("Failed to save GT template");
    assert!(saved_path.exists());
    assert!(saved_path.to_string_lossy().ends_with("test-lower-third.gtp"));

    // 2. Load template by ID
    let loaded_content = GtTemplateStore::load_template(template_id)
        .expect("Failed to load GT template");
    assert!(loaded_content.contains("Test Keynote Lower Third"));

    // 3. List templates
    let list = GtTemplateStore::list_templates().expect("Failed to list GT templates");
    assert_eq!(list.len(), 1);
    assert!(list[0].contains("test-lower-third"));

    // 4. Delete template
    let deleted = GtTemplateStore::delete_template(template_id)
        .expect("Failed to delete GT template");
    assert!(deleted);
    assert!(!saved_path.exists());

    // 5. Delete non-existent template
    let deleted_again = GtTemplateStore::delete_template("non-existent")
        .expect("Failed call on non-existent template");
    assert!(!deleted_again);
}

#[test]
fn test_gt_template_path_sanitization() {
    let _guard = ENV_LOCK.lock().unwrap();
    let temp_dir = tempdir().expect("Failed to create tempdir");
    unsafe {
        std::env::set_var("LIVESTUDIO_DATA_DIR", temp_dir.path());
    }

    // Injection attempt with directory traversal
    let malicious_id = "../../etc/passwd";
    let sample_json = r##"{"id": "test", "name": "Test"}"##;

    let path = GtTemplateStore::save_template(sample_json, malicious_id)
        .expect("Should safely sanitize id");

    // Must be inside gt-templates directory, not traversed outside
    let templates_dir = GtTemplateStore::templates_directory();
    assert!(path.starts_with(&templates_dir));
    assert!(!path.to_string_lossy().contains(".."));
}

#[test]
fn test_gt_render_svg_to_png_data_url() {
    let svg = r##"<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="100" fill="#3b82f6" rx="8" />
        <text x="20" y="55" font-family="Arial" font-size="24" fill="#ffffff">LiveStudio Pro</text>
    </svg>"##;

    let data_url = GtTemplateStore::render_svg_to_png_data_url(svg, 400, 100)
        .expect("Failed to render SVG to PNG data URL");

    assert!(data_url.starts_with("data:image/png;base64,"));
    assert!(data_url.len() > 100);
}
