use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::time::Instant;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tracing::debug;

use crate::core::error::LiveStudioError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub id: String,
    pub name: String,
    pub device_type: String, // "onvif_camera", "rtsp_feed", "ndi_source"
    pub ip_address: String,
    pub port: u16,
    pub service_url: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceHealthCheckResult {
    pub url: String,
    pub is_reachable: bool,
    pub latency_ms: u32,
    pub error_message: Option<String>,
    pub stream_info: Option<String>,
}

pub struct NetworkDiscovery;

impl NetworkDiscovery {
    /// Tests reachability and latency of an RTSP or SRT network endpoint
    pub async fn test_source_connection(url: &str) -> SourceHealthCheckResult {
        let start = Instant::now();

        // Parse host and port from URL
        let parsed = url::Url::parse(url);
        let (host, port) = match parsed {
            Ok(ref u) => {
                let h = u.host_str().unwrap_or("127.0.0.1");
                let p = u.port().unwrap_or(if u.scheme() == "rtsp" { 554 } else { 8554 });
                (h.to_string(), p)
            }
            Err(_) => {
                // Try manual split
                let parts: Vec<&str> = url.trim_start_matches("rtsp://").trim_start_matches("srt://").split('/').collect();
                if let Some(host_port) = parts.first() {
                    let hp: Vec<&str> = host_port.split(':').collect();
                    let h = hp[0];
                    let p = hp.get(1).and_then(|v| v.parse::<u16>().ok()).unwrap_or(554);
                    (h.to_string(), p)
                } else {
                    return SourceHealthCheckResult {
                        url: url.to_string(),
                        is_reachable: false,
                        latency_ms: 0,
                        error_message: Some("Invalid URL format".into()),
                        stream_info: None,
                    };
                }
            }
        };

        let target = format!("{}:{}", host, port);
        let res = timeout(
            std::time::Duration::from_millis(2500),
            TcpStream::connect(&target),
        )
        .await;

        let elapsed = start.elapsed().as_millis() as u32;

        match res {
            Ok(Ok(_stream)) => SourceHealthCheckResult {
                url: url.to_string(),
                is_reachable: true,
                latency_ms: elapsed,
                error_message: None,
                stream_info: Some(format!("Connected to {target} in {elapsed}ms")),
            },
            Ok(Err(e)) => SourceHealthCheckResult {
                url: url.to_string(),
                is_reachable: false,
                latency_ms: elapsed,
                error_message: Some(format!("Connection refused or unreachable: {e}")),
                stream_info: None,
            },
            Err(_) => SourceHealthCheckResult {
                url: url.to_string(),
                is_reachable: false,
                latency_ms: 2500,
                error_message: Some("Connection timed out after 2500ms".into()),
                stream_info: None,
            },
        }
    }

    /// Discovers local network ONVIF cameras via WS-Discovery UDP broadcast
    pub async fn discover_onvif_cameras() -> Result<Vec<DiscoveredDevice>, LiveStudioError> {
        let probe_xml = r#"<?xml version="1.0" encoding="utf-8"?>
<Envelope xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns="http://www.w3.org/2003/05/soap-envelope">
  <Header>
    <wsa:MessageID xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">uuid:c2b189ff-29a3-4c91-9e23-74d75d275338</wsa:MessageID>
    <wsa:To xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </Header>
  <Body>
    <Probe xmlns="http://schemas.xmlsoap.org/ws/2005/04/discovery">
      <Types>tds:Device</Types>
    </Probe>
  </Body>
</Envelope>"#;

        let socket = match tokio::net::UdpSocket::bind("0.0.0.0:0").await {
            Ok(s) => s,
            Err(e) => {
                debug!("Could not bind discovery socket: {e}");
                return Ok(Vec::new());
            }
        };

        let _ = socket.set_broadcast(true);
        let broadcast_addr: SocketAddr = "239.255.255.250:3702".parse().unwrap();
        let _ = socket.send_to(probe_xml.as_bytes(), broadcast_addr).await;

        let mut devices = Vec::new();
        let mut buf = [0u8; 4096];

        // Listen for responses up to 800ms
        let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_millis(800);
        while tokio::time::Instant::now() < deadline {
            if let Ok(Ok((size, peer))) = timeout(
                tokio::time::Duration::from_millis(200),
                socket.recv_from(&mut buf),
            )
            .await
            {
                let text = String::from_utf8_lossy(&buf[..size]);
                if text.contains("onvif") || text.contains("Device") || text.contains("XAddrs") {
                    let dev = DiscoveredDevice {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: format!("ONVIF Camera ({})", peer.ip()),
                        device_type: "onvif_camera".into(),
                        ip_address: peer.ip().to_string(),
                        port: peer.port(),
                        service_url: format!("http://{}:{}/onvif/device_service", peer.ip(), peer.port()),
                        manufacturer: Some("Standard ONVIF".into()),
                        model: Some("IP Camera".into()),
                    };
                    devices.push(dev);
                }
            }
        }

        Ok(devices)
    }
}
