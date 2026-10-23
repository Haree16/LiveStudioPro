use url::Url;

pub struct RtspSecurity;

impl RtspSecurity {
    /// Sanitizes an RTSP URL by redacting credentials so they never leak into logs or JSON
    pub fn redact_credentials(raw_url: &str) -> String {
        if let Ok(mut parsed) = Url::parse(raw_url) {
            if parsed.password().is_some() || !parsed.username().is_empty() {
                let _ = parsed.set_username("redacted");
                let _ = parsed.set_password(Some("redacted"));
            }
            parsed.to_string()
        } else {
            // Fallback pattern replacement if URL parsing is non-standard
            if let Some(at_idx) = raw_url.find('@') {
                if let Some(proto_idx) = raw_url.find("://") {
                    let proto = &raw_url[..proto_idx + 3];
                    let host_path = &raw_url[at_idx + 1..];
                    return format!("{proto}redacted:redacted@{host_path}");
                }
            }
            raw_url.to_string()
        }
    }
}
