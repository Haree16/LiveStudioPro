use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use parking_lot::RwLock;

use super::action::{ActionInvocation, ActionRegistry, ActionSafetyTier};
use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AutomationPolicy {
    pub require_confirmation_for_program_actions: bool,
    pub require_confirmation_for_output_actions: bool,
    pub allow_automation_during_live_stream: bool,
    pub max_parallel_macros: usize,
}

impl Default for AutomationPolicy {
    fn default() -> Self {
        Self {
            require_confirmation_for_program_actions: false,
            require_confirmation_for_output_actions: true,
            allow_automation_during_live_stream: true,
            max_parallel_macros: 3,
        }
    }
}

pub struct AutomationSafetyGovernor {
    policy: Arc<RwLock<AutomationPolicy>>,
    emergency_stop_tripped: Arc<AtomicBool>,
}

impl AutomationSafetyGovernor {
    pub fn new(policy: AutomationPolicy) -> Self {
        Self {
            policy: Arc::new(RwLock::new(policy)),
            emergency_stop_tripped: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn set_policy(&self, policy: AutomationPolicy) {
        *self.policy.write() = policy;
    }

    pub fn get_policy(&self) -> AutomationPolicy {
        self.policy.read().clone()
    }

    pub fn trip_emergency_stop(&self) {
        self.emergency_stop_tripped.store(true, Ordering::SeqCst);
    }

    pub fn reset_emergency_stop(&self) {
        self.emergency_stop_tripped.store(false, Ordering::SeqCst);
    }

    pub fn is_emergency_stopped(&self) -> bool {
        self.emergency_stop_tripped.load(Ordering::SeqCst)
    }

    pub fn check_action_safety(
        &self,
        registry: &ActionRegistry,
        invocation: &ActionInvocation,
        is_streaming: bool,
    ) -> Result<(), LiveStudioError> {
        if self.is_emergency_stopped() {
            return Err(LiveStudioError::validation(
                "Automation is halted by Emergency Stop. Reset Emergency Stop to proceed.",
                Some("emergencyStop"),
            ));
        }

        let def = registry.get(&invocation.action_id).ok_or_else(|| {
            LiveStudioError::validation(
                format!("Action '{}' not found", invocation.action_id),
                Some("actionId"),
            )
        })?;

        let pol = self.policy.read();

        if is_streaming && !pol.allow_automation_during_live_stream {
            return Err(LiveStudioError::validation(
                "Automation execution is disabled during active live stream by current safety policy",
                Some("policy"),
            ));
        }

        if def.safety_tier == ActionSafetyTier::OutputAffecting
            && pol.require_confirmation_for_output_actions
            && invocation.action_id == "output.stopStream"
        {
            // Requires explicit confirmation parameter
            let confirmed = invocation
                .parameters
                .get("confirmed")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !confirmed {
                return Err(LiveStudioError::validation(
                    "Stopping live broadcast requires operator confirmation",
                    Some("confirmationRequired"),
                ));
            }
        }

        Ok(())
    }
}
