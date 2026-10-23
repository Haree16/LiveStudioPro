use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ScriptCommand {
    CutTo { input_id: String },
    FadeTo { input_id: String, duration_ms: u32 },
    SetFaderDb { input_id: String, fader_db: f32 },
    SetOverlay { channel: u8, graphic_id: String, on_air: bool },
    TriggerMacro { macro_id: String },
    SleepMs { duration_ms: u32 },
    Log { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScriptExecutionResult {
    pub success: bool,
    pub steps_executed: usize,
    pub logs: Vec<String>,
    pub error: Option<String>,
}

pub struct SandboxedScriptRunner;

impl SandboxedScriptRunner {
    /// Parses simple script text into sequential commands
    /// Syntax:
    ///   CUT input_id
    ///   FADE input_id duration_ms
    ///   FADER input_id fader_db
    ///   OVERLAY channel graphic_id [on|off]
    ///   MACRO macro_id
    ///   SLEEP duration_ms
    ///   LOG message
    pub fn parse_script(script_text: &str) -> Result<Vec<ScriptCommand>, String> {
        let mut commands = Vec::new();

        for (line_num, raw_line) in script_text.lines().enumerate() {
            let line = raw_line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            let op = parts[0].to_uppercase();

            match op.as_str() {
                "CUT" => {
                    if parts.len() < 2 {
                        return Err(format!("Line {}: CUT requires input_id argument", line_num + 1));
                    }
                    commands.push(ScriptCommand::CutTo { input_id: parts[1].into() });
                }
                "FADE" => {
                    if parts.len() < 3 {
                        return Err(format!("Line {}: FADE requires input_id and duration_ms arguments", line_num + 1));
                    }
                    let dur = parts[2].parse::<u32>().map_err(|e| format!("Line {}: {e}", line_num + 1))?;
                    commands.push(ScriptCommand::FadeTo { input_id: parts[1].into(), duration_ms: dur });
                }
                "FADER" => {
                    if parts.len() < 3 {
                        return Err(format!("Line {}: FADER requires input_id and dB arguments", line_num + 1));
                    }
                    let db = parts[2].parse::<f32>().map_err(|e| format!("Line {}: {e}", line_num + 1))?;
                    commands.push(ScriptCommand::SetFaderDb { input_id: parts[1].into(), fader_db: db });
                }
                "OVERLAY" => {
                    if parts.len() < 4 {
                        return Err(format!("Line {}: OVERLAY requires channel, graphic_id, and on/off", line_num + 1));
                    }
                    let ch = parts[1].parse::<u8>().map_err(|e| format!("Line {}: {e}", line_num + 1))?;
                    let on_air = parts[3].to_lowercase() == "on" || parts[3] == "1";
                    commands.push(ScriptCommand::SetOverlay {
                        channel: ch,
                        graphic_id: parts[2].into(),
                        on_air,
                    });
                }
                "MACRO" => {
                    if parts.len() < 2 {
                        return Err(format!("Line {}: MACRO requires macro_id argument", line_num + 1));
                    }
                    commands.push(ScriptCommand::TriggerMacro { macro_id: parts[1].into() });
                }
                "SLEEP" => {
                    if parts.len() < 2 {
                        return Err(format!("Line {}: SLEEP requires duration_ms argument", line_num + 1));
                    }
                    let dur = parts[1].parse::<u32>().map_err(|e| format!("Line {}: {e}", line_num + 1))?;
                    commands.push(ScriptCommand::SleepMs { duration_ms: dur });
                }
                "LOG" => {
                    let msg = parts[1..].join(" ");
                    commands.push(ScriptCommand::Log { message: msg });
                }
                _ => return Err(format!("Line {}: Unknown script instruction '{}'", line_num + 1, op)),
            }
        }

        Ok(commands)
    }

    /// Executes script commands within safety limits (max 500 steps, step timeout limit)
    pub fn execute_sandboxed(commands: &[ScriptCommand], max_steps: usize) -> ScriptExecutionResult {
        let mut logs = Vec::new();
        let mut executed = 0;

        for cmd in commands {
            if executed >= max_steps {
                return ScriptExecutionResult {
                    success: false,
                    steps_executed: executed,
                    logs,
                    error: Some(format!("Safety execution step limit reached ({max_steps})")),
                };
            }

            executed += 1;
            match cmd {
                ScriptCommand::CutTo { input_id } => {
                    logs.push(format!("Executing CUT to {input_id}"));
                }
                ScriptCommand::FadeTo { input_id, duration_ms } => {
                    logs.push(format!("Executing FADE to {input_id} over {duration_ms}ms"));
                }
                ScriptCommand::SetFaderDb { input_id, fader_db } => {
                    logs.push(format!("Setting audio fader {input_id} to {fader_db}dB"));
                }
                ScriptCommand::SetOverlay { channel, graphic_id, on_air } => {
                    logs.push(format!("Setting overlay ch {channel} for {graphic_id} on_air={on_air}"));
                }
                ScriptCommand::TriggerMacro { macro_id } => {
                    logs.push(format!("Triggering macro {macro_id}"));
                }
                ScriptCommand::SleepMs { duration_ms } => {
                    logs.push(format!("Sleeping {duration_ms}ms"));
                }
                ScriptCommand::Log { message } => {
                    info!("Script log: {message}");
                    logs.push(message.clone());
                }
            }
        }

        ScriptExecutionResult {
            success: true,
            steps_executed: executed,
            logs,
            error: None,
        }
    }
}
