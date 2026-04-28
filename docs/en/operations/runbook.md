# Operations Runbook

Day-to-day operating procedures for Radiolyze administrators. Keep this page bookmarked.

---

## Starting and Stopping

### Start All Services

```bash
# CPU mode (standard)
docker compose up -d

# GPU mode (NVIDIA)
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up -d

# GPU + Whisper ASR
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/whisper.yml --profile gpu up -d
```

### Stop All Services (keep data)

```bash
docker compose down
```

### Restart a Single Service

```bash
docker compose restart backend
docker compose restart orthanc
docker compose restart postgres
docker compose restart vllm
```

### Full Service Status

```bash
docker compose ps
```

---

## Health Checks

Run all health checks at once:

```bash
echo "=== Backend ===" && curl -sf http://localhost:8000/api/v1/health || echo "FAIL"
echo "=== Orthanc ===" && curl -sf -u orthanc:orthanc http://localhost:8042/api/system | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK -', d.get('DicomAet','?'))" || echo "FAIL"
echo "=== Postgres ===" && docker compose exec postgres pg_isready -U postgres || echo "FAIL"
echo "=== Redis ===" && docker compose exec redis redis-cli ping || echo "FAIL"
echo "=== vLLM ===" && curl -sf http://localhost:8001/v1/models || echo "FAIL (no GPU?)"
```

### Expected Healthy State

| Service | Healthy response |
|---|---|
| Backend | `{"status": "ok", ...}` |
| Orthanc | JSON with `DicomAet` field |
| PostgreSQL | `postgres:5432 - accepting connections` |
| Redis | `PONG` |
| vLLM | JSON with models list |

---

## Monitoring GPU

```bash
# Real-time GPU utilisation (NVIDIA)
nvidia-smi dmon -s u -d 5    # Refresh every 5 seconds

# Single snapshot
nvidia-smi

# vLLM Prometheus metrics
curl -s http://localhost:8001/metrics | grep -E "vllm_gpu_cache|num_requests"
```

---

## Viewing Logs

```bash
# All services (last 100 lines)
docker compose logs --tail=100

# Follow a specific service in real time
docker compose logs -f backend
docker compose logs -f vllm
docker compose logs -f orthanc

# Search for errors
docker compose logs backend | grep -i error | tail -20

# ASR worker logs
docker compose logs worker | tail -50
```

---

## Database Operations

### Connect to PostgreSQL

```bash
docker compose exec postgres psql -U postgres radiolyze
```

Useful SQL queries:

```sql
-- Count reports
SELECT status, COUNT(*) FROM reports GROUP BY status;

-- Recent audit events
SELECT created_at, event_type, report_id FROM audit_events
ORDER BY created_at DESC LIMIT 20;

-- Check audit log size
SELECT pg_size_pretty(pg_total_relation_size('audit_events'));

-- Recent inference jobs
SELECT created_at, status, model_version, duration_ms
FROM audit_events WHERE event_type LIKE 'inference_%'
ORDER BY created_at DESC LIMIT 10;
```

### Manual Database Backup

```bash
docker compose exec postgres pg_dump -U postgres radiolyze \
  > /backup/radiolyze_$(date +%Y%m%d_%H%M%S).sql
```

See [Backup and Recovery](backup-recovery.md) for the full backup procedure.

---

## Orthanc Operations

### Check Study Count

```bash
curl -s -u orthanc:orthanc http://localhost:8042/statistics \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"CountStudies\"]} studies, {d[\"CountInstances\"]} instances')"
```

### Access the Orthanc Web UI

Open `http://localhost:8042` in a browser. Login with the configured credentials.

### Manual DICOM Upload

```bash
# Upload a DICOM file
curl -s -u orthanc:orthanc \
  -X POST http://localhost:8042/instances \
  -H "Content-Type: application/dicom" \
  --data-binary @/path/to/study.dcm

# Upload a folder of DICOM files
find /path/to/dicom -name "*.dcm" -exec \
  curl -s -u orthanc:orthanc -X POST http://localhost:8042/instances \
  -H "Content-Type: application/dicom" --data-binary @{} \;
```

---

## Incident Response

Use this checklist when a service is degraded or users report problems.

### Step 1: Identify the Failing Service

```bash
docker compose ps                         # Check container states
docker compose logs --tail=30 backend     # Check for recent errors
docker compose logs --tail=30 orthanc
```

### Step 2: Common Issues and Fixes

| Symptom | Service | Fix |
|---|---|---|
| UI does not load | Frontend | `docker compose restart frontend` or check NGINX |
| Worklist empty | Orthanc / Backend | Check Orthanc health; `docker compose restart backend` |
| AI returns errors | vLLM | Check GPU; see [GPU Troubleshooting](gpu-setup.md#troubleshooting) |
| ASR not transcribing | Worker / Whisper | `docker compose restart worker` |
| "Database connection error" | PostgreSQL | `docker compose restart postgres backend` |
| "Redis connection error" | Redis | `docker compose restart redis worker` |
| Reports not saving | Backend / DB | Check backend logs; `docker compose restart backend` |

### Step 3: Escalation Path

1. **First response:** Restart the failing service (`docker compose restart <service>`).
2. **If restart does not help:** Check logs for root cause (`docker compose logs <service>`).
3. **If data integrity may be affected:** Stop the service first, then investigate logs before restarting.
4. **If database is corrupted:** Restore from most recent backup. See [Backup and Recovery](backup-recovery.md).
5. **If GPU driver issue:** Reboot the server; check `nvidia-smi` after reboot before starting services.

### Step 4: After Incident Recovery

- Verify all services are healthy (run the full health check block above)
- Check audit logs for incomplete events during the outage
- Document the incident: cause, time of impact, fix, and affected reports

---

## Scheduled Maintenance

### Before Maintenance

1. Notify radiologists that the system will be unavailable
2. Wait for any in-progress AI jobs to complete:
   ```bash
   docker compose exec redis redis-cli llen rq:queue:default
   # Wait until this returns 0
   ```
3. Take a backup before applying changes

### During Maintenance

```bash
# Stop all services cleanly
docker compose down

# Apply changes (image rebuild, config, etc.)

# Restart
docker compose up --build -d
```

### After Maintenance

1. Run the full health check
2. Load a test study and approve one report to verify end-to-end workflow
3. Notify radiologists that service is restored

---

## Routine Operational Checks (Weekly)

| Check | Command |
|---|---|
| Disk space | `df -h /var/lib/docker` |
| Docker volume sizes | `docker system df -v` |
| Backup completeness | `ls -lh /backup/*.sql \| tail -10` |
| Error rate in logs | `docker compose logs --since 7d backend \| grep -c ERROR` |
| GPU VRAM headroom | `nvidia-smi --query-gpu=memory.used,memory.total --format=csv` |
| Audit log growth | Run the audit log size SQL query (see above) |

---

## Updating Radiolyze

```bash
# Pull latest code
git pull origin main

# Rebuild images and restart
docker compose up --build -d

# Verify
docker compose ps
curl http://localhost:8000/api/v1/health
```

Database migrations run automatically on backend startup. Check backend logs after update:

```bash
docker compose logs backend | grep -i "migration\|alembic\|upgrade" | tail -20
```

---

## Emergency: Force Stop All Services

```bash
docker compose kill      # Immediate stop (no graceful shutdown)
docker compose rm -f     # Remove containers
docker compose up -d     # Restart
```

Use only if graceful `docker compose down` hangs for more than 60 seconds.
