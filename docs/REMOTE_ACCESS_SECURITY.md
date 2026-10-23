# LiveStudio Pro — Remote Access Security & Hardening

## 1. Security Architecture Principles

LiveStudio Pro is designed around a "Defense-in-Depth" security posture:

1. **Loopback-by-Default:** Remote production services bind exclusively to `127.0.0.1` by default. Exposure to LAN (`0.0.0.0`) requires explicit operator intervention.
2. **Cryptographic Token Hashing:** Invitation tokens are generated via high-entropy UUIDv4 and validated using SHA-256 hashes.
3. **Role-Based Access Control (RBAC):** Capabilities are strictly partitioned into three distinct tiers:
   - `Viewer`: Read-only telemetry, status, multiview, and tallies.
   - `Operator`: Switcher switching (CUT, AUTO), audio mixing, PTZ camera steering.
   - `Admin`: Full configuration, server binding changes, invitation generation, and token management.
4. **Rate Limiting & Payload Guards:** Inbound WebSocket and REST commands are rate-limited per IP to prevent command injection and DoS attacks.
5. **No Direct Filesystem Exposure:** Web clients cannot trigger arbitrary file reads, shell commands, or path traversal attacks.

---

## 2. Production Deployment & Reverse Proxy Recommendation

When exposing LiveStudio Pro to the public Internet or across untrusted enterprise WANs:

> [!IMPORTANT]
> Never expose HTTP/WebSocket port `8088` directly to the open Internet without TLS encryption.

### Recommended Topology (Caddy / Nginx Reverse Proxy)

```mermaid
flowchart LR
    ClientBrowser["Browser / Phone Client"] <-->|HTTPS / WSS (Port 443)| ReverseProxy["Reverse Proxy (Caddy / Nginx)"]
    ReverseProxy <-->|HTTP / WS (Port 8088)| LiveStudioPro["LiveStudio Pro (127.0.0.1)"]
```

### Sample Caddyfile Configuration
```caddy
live.yourstudio.com {
    reverse_proxy 127.0.0.1:8088
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000;"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }
}
```

---

## 3. Security Audit Logging

All connection attempts, token authentications, role checks, and operator actions are recorded in the in-memory and persistent ring buffer. Operators can inspect recent events in real time from the **Director** modal.
