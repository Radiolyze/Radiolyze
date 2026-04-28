# Security Hardening

This guide describes the steps required to harden a Radiolyze installation for production use.
The default Docker Compose setup is **not secure** for clinical environments.

---

## Threat Model

Radiolyze processes protected health information (PHI). The primary threats are:

| Threat | Impact |
|---|---|
| Unauthenticated access to the UI | Any user can read and approve reports |
| Default credentials in use | Trivial takeover of Orthanc, database |
| Unencrypted HTTP traffic | Patient data and credentials transmitted in cleartext |
| PHI in logs | Privacy breach, compliance violation |
| Unrestricted network access | Lateral movement within hospital network |

---

## Step 1: Change All Default Credentials

### Orthanc

Edit `.env`:

```bash
VITE_DICOM_WEB_USERNAME=radiology_user
VITE_DICOM_WEB_PASSWORD=<generate-with: openssl rand -base64 24>
```

Also update the Orthanc configuration with a matching password hash:

```json
// orthanc.json
{
  "AuthenticationEnabled": true,
  "RegisteredUsers": {
    "radiology_user": "your_bcrypt_hashed_password"
  }
}
```

### PostgreSQL

Set a strong database password in `.env` and ensure it matches `docker-compose.yml`:

```bash
POSTGRES_PASSWORD=<generate-with: openssl rand -base64 32>
```

### JWT Signing Secret

```bash
JWT_SECRET_KEY=<generate-with: openssl rand -hex 32>
```

---

## Step 2: Enable TLS (HTTPS)

All traffic to the Radiolyze UI and API must be encrypted in production. See [Deployment Guide — Adding HTTPS](deployment.md#adding-https-nginx-reverse-proxy).

After enabling TLS:

- Enable HSTS header (included in the sample NGINX config).
- Redirect all HTTP traffic to HTTPS.
- Verify with: `curl -v https://radiolyze.yourhospital.example/api/v1/health`

---

## Step 3: Network Isolation

Internal services (PostgreSQL, Redis, Orthanc) must not be accessible from outside the Docker network or the server.

In `docker-compose.yml`, verify that these services do **not** have `ports:` entries exposing them to the host:

```yaml
# WRONG — exposes Postgres to all interfaces:
postgres:
  ports:
    - "5432:5432"

# CORRECT — internal only (no ports: entry):
postgres:
  expose:
    - "5432"
```

Firewall rules on the host should only allow:

| Port | Protocol | From |
|---|---|---|
| 80 | TCP | Client workstations |
| 443 | TCP | Client workstations |
| 4242 | TCP | DICOM modalities only |
| 22 | TCP | Admin IP ranges only |
| All others | — | Deny |

Apply with UFW (example):

```bash
sudo ufw default deny incoming
sudo ufw allow from <client_subnet> to any port 443 proto tcp
sudo ufw allow from <modality_subnet> to any port 4242 proto tcp
sudo ufw allow from <admin_ips> to any port 22 proto tcp
sudo ufw enable
```

---

## Step 4: Disable PHI in Logs

The application is configured to avoid logging PHI, but verify your Docker and NGINX log settings:

```bash
# Check backend logs for any patient names or IDs:
docker compose logs backend | grep -i "patient\|name\|dob\|birth" | head -20
```

For NGINX, use a log format that excludes query parameters containing IDs:

```nginx
log_format privacy_safe '$remote_addr - $remote_user [$time_local] '
                        '"$request_method $uri $server_protocol" $status';
access_log /var/log/nginx/access.log privacy_safe;
```

---

## Step 5: Rate Limiting

Prevent brute-force and DoS attacks via NGINX:

```nginx
http {
    # Limit login attempts
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Limit API requests
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;

    server {
        location /api/v1/auth/ {
            limit_req zone=login burst=3 nodelay;
        }

        location /api/ {
            limit_req zone=api burst=50 nodelay;
        }
    }
}
```

---

## Step 6: DICOM Upload Limits

Prevent oversized uploads from crashing the system:

```nginx
client_max_body_size 500M;   # Adjust to your largest expected study size
```

In Orthanc, set `MaximumStorageSize` to limit disk usage.

---

## Step 7: Secret Rotation Policy

Establish a rotation schedule:

| Secret | Rotation frequency |
|---|---|
| JWT signing key | 90 days or on staff change |
| Orthanc password | 90 days or on staff change |
| PostgreSQL password | 180 days |
| Backup encryption key | 180 days |

Document each rotation in a change log. After rotating the JWT key, all active sessions are invalidated (users must log in again).

---

## Step 8: Audit Log Access Control

The audit log endpoint (`GET /api/v1/audit`) exposes sensitive workflow data. Restrict it:

- Only admin and compliance roles should have access.
- Consider placing this endpoint behind an additional NGINX location with IP-based restrictions:

```nginx
location /api/v1/audit {
    allow <compliance_office_ip>;
    deny all;
    proxy_pass http://localhost:8000;
}
```

---

## Step 9: Dependency and Image Scanning

Run regular security scans:

```bash
# Scan Docker images
docker scout cves radiolyze-backend
docker scout cves radiolyze-frontend

# Scan Python dependencies (from repo root)
pip install safety
safety check -r backend/requirements.txt

# Scan Node.js dependencies
npm audit
```

Integrate into CI/CD for automatic scanning on each build.

---

## Production Security Checklist

Copy and track completion:

- [ ] All default credentials changed (Orthanc, PostgreSQL, JWT)
- [ ] TLS enabled with valid certificate
- [ ] HSTS header active
- [ ] HTTP → HTTPS redirect active
- [ ] Internal services not exposed on host ports
- [ ] Firewall rules applied and tested
- [ ] PHI not appearing in application logs
- [ ] Rate limiting configured in NGINX
- [ ] Upload size limits set
- [ ] Secret rotation schedule documented
- [ ] Audit log endpoint access restricted
- [ ] Dependency scan integrated in CI
- [ ] Penetration test completed (before go-live)
- [ ] Backup encryption enabled (see [Backup and Recovery](backup-recovery.md))

---

## Further Reading

- [Security Architecture](../operations/security.md) — design decisions and RBAC baseline
- [EU AI Act Compliance](../compliance/checklist.md) — regulatory requirements
- [Internet Usage Policy](../operations/internet-usage.md) — egress control
