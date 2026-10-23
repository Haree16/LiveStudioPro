use serde::{Deserialize, Serialize};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, Pid, ProcessRefreshKind, RefreshKind, System};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    pub cpu_usage_percent: f32,
    pub total_memory_bytes: u64,
    pub used_memory_bytes: u64,
    pub memory_usage_percent: f32,
    pub app_memory_bytes: u64,
    pub app_cpu_percent: f32,
    pub thread_count: usize,
    pub uptime_seconds: u64,
}

pub struct SystemTelemetry {
    system: parking_lot::Mutex<System>,
    pid: Pid,
}

impl SystemTelemetry {
    pub fn new() -> Self {
        let refresh_kind = RefreshKind::nothing()
            .with_cpu(CpuRefreshKind::nothing().with_cpu_usage())
            .with_memory(MemoryRefreshKind::everything())
            .with_processes(ProcessRefreshKind::everything());

        let mut sys = System::new_with_specifics(refresh_kind);
        sys.refresh_all();
        let pid = sysinfo::get_current_pid().unwrap_or(Pid::from(0));

        Self {
            system: parking_lot::Mutex::new(sys),
            pid,
        }
    }

    pub fn snapshot(&self) -> SystemStats {
        let mut sys = self.system.lock();
        sys.refresh_all();

        let cpu_usage_percent = sys.global_cpu_usage();
        let total_memory_bytes = sys.total_memory();
        let used_memory_bytes = sys.used_memory();
        let memory_usage_percent = if total_memory_bytes > 0 {
            (used_memory_bytes as f32 / total_memory_bytes as f32) * 100.0
        } else {
            0.0
        };

        let (app_memory_bytes, app_cpu_percent) = if let Some(proc) = sys.process(self.pid) {
            (proc.memory(), proc.cpu_usage())
        } else {
            (0, 0.0)
        };

        let uptime_seconds = System::uptime();

        SystemStats {
            cpu_usage_percent,
            total_memory_bytes,
            used_memory_bytes,
            memory_usage_percent,
            app_memory_bytes,
            app_cpu_percent,
            thread_count: std::thread::available_parallelism().map(|p| p.get()).unwrap_or(1),
            uptime_seconds,
        }
    }
}
