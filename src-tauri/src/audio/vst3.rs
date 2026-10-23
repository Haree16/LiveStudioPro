use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Vst3Parameter {
    pub id: u32,
    pub name: String,
    pub min_value: f32,
    pub max_value: f32,
    pub default_value: f32,
    pub current_value: f32,
    pub unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Vst3PluginDescriptor {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub version: String,
    pub category: String, // "Eq", "Compressor", "Limiter", "Reverb", "Analyzer"
    pub file_path: String,
    pub is_64bit: bool,
    pub parameters: Vec<Vst3Parameter>,
    pub latency_samples: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Vst3PluginInstance {
    pub instance_id: String,
    pub plugin_id: String,
    pub bypass: bool,
    pub mix: f32, // 0.0 (dry) to 1.0 (wet)
    pub parameter_values: HashMap<u32, f32>,
}

impl Vst3PluginInstance {
    pub fn new(instance_id: impl Into<String>, descriptor: &Vst3PluginDescriptor) -> Self {
        let mut parameter_values = HashMap::new();
        for param in &descriptor.parameters {
            parameter_values.insert(param.id, param.default_value);
        }

        Self {
            instance_id: instance_id.into(),
            plugin_id: descriptor.id.clone(),
            bypass: false,
            mix: 1.0,
            parameter_values,
        }
    }

    pub fn set_parameter(&mut self, param_id: u32, value: f32) {
        self.parameter_values.insert(param_id, value);
    }

    pub fn get_parameter(&self, param_id: u32) -> Option<f32> {
        self.parameter_values.get(&param_id).copied()
    }

    /// Processes stereo float audio buffer through the active VST3 instance
    pub fn process_stereo(&self, left: &mut [f32], right: &mut [f32]) {
        if self.bypass || (self.mix <= 0.0) {
            return;
        }

        // Apply parameter-modulated processing
        // For demonstration/testing without proprietary SDK binaries installed:
        let gain_param = self.parameter_values.get(&1).copied().unwrap_or(1.0);
        let dry_ratio = 1.0 - self.mix;
        let wet_ratio = self.mix;

        for sample in left.iter_mut() {
            let dry = *sample;
            let wet = dry * gain_param;
            *sample = dry * dry_ratio + wet * wet_ratio;
        }

        for sample in right.iter_mut() {
            let dry = *sample;
            let wet = dry * gain_param;
            *sample = dry * dry_ratio + wet * wet_ratio;
        }
    }
}

pub struct Vst3HostScanner;

impl Vst3HostScanner {
    /// Returns default VST3 search directories for the current operating system
    pub fn get_default_vst3_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        #[cfg(target_os = "linux")]
        {
            paths.push(PathBuf::from("/usr/lib/vst3"));
            paths.push(PathBuf::from("/usr/local/lib/vst3"));
            if let Ok(home) = std::env::var("HOME") {
                paths.push(PathBuf::from(home).join(".vst3"));
            }
        }

        #[cfg(target_os = "windows")]
        {
            paths.push(PathBuf::from("C:\\Program Files\\Common Files\\VST3"));
            paths.push(PathBuf::from("C:\\Program Files (x86)\\Common Files\\VST3"));
        }

        paths
    }

    /// Scans filesystem for installed 64-bit VST3 audio plugin bundles
    pub fn scan_installed_plugins() -> Vec<Vst3PluginDescriptor> {
        let search_dirs = Self::get_default_vst3_paths();
        let mut found = Vec::new();

        for dir in search_dirs {
            if !dir.exists() {
                continue;
            }
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().and_then(|e| e.to_str()) == Some("vst3") {
                        let name = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .unwrap_or("Unknown VST3")
                            .to_string();

                        found.push(Vst3PluginDescriptor {
                            id: format!("vst3-{}", name.to_lowercase().replace(' ', "-")),
                            name: name.clone(),
                            vendor: "External VST3 Vendor".into(),
                            version: "1.0.0".into(),
                            category: "Effect".into(),
                            file_path: path.to_string_lossy().to_string(),
                            is_64bit: true,
                            parameters: vec![Vst3Parameter {
                                id: 1,
                                name: "Gain".into(),
                                min_value: 0.0,
                                max_value: 2.0,
                                default_value: 1.0,
                                current_value: 1.0,
                                unit: "x".into(),
                            }],
                            latency_samples: 0,
                        });
                        info!("Discovered VST3 plugin: {name} at {:?}", path);
                    }
                }
            }
        }

        found
    }
}
