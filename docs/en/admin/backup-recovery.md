# Backup and Recovery

This guide covers backup procedures, verification, and recovery for all Radiolyze data components.

---

## Data Components

| Component | What it stores | Volume / Path |
|---|---|---|
| **PostgreSQL** | Reports, audit events, model metrics | Docker volume `postgres-data` |
| **Orthanc** | DICOM studies (pixel data + metadata) | Docker volume `orthanc-data` |
| **Configuration** | `.env`, compose overlays, custom configs | Host filesystem |

!!! danger "Backup all three"
    Losing any one component makes the system unrecoverable or non-compliant. Compliance regulations (EU AI Act Art. 12) require audit log retention — back up PostgreSQL.

---

## PostgreSQL Backup

### Manual Backup

```bash
# Create a timestamped SQL dump
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose exec postgres pg_dump \
  -U postgres radiolyze \
  > /backup/radiolyze_${TIMESTAMP}.sql

echo "Backup saved: /backup/radiolyze_${TIMESTAMP}.sql"
```

### Verify the Backup

```bash
# Check file is not empty and contains expected tables
head -50 /backup/radiolyze_${TIMESTAMP}.sql
grep "CREATE TABLE" /backup/radiolyze_${TIMESTAMP}.sql
```

### Automated Daily Backup (cron)

```bash
# Add to root's crontab (crontab -e):
0 2 * * * docker compose -f /opt/radiolyze/docker-compose.yml exec -T postgres \
  pg_dump -U postgres radiolyze \
  > /backup/radiolyze_$(date +\%Y\%m\%d).sql 2>> /var/log/radiolyze-backup.log

# Keep 30 days of backups
0 3 * * * find /backup -name "radiolyze_*.sql" -mtime +30 -delete
```

### Compressed Backup (recommended for large databases)

```bash
docker compose exec postgres pg_dump -U postgres radiolyze \
  | gzip > /backup/radiolyze_$(date +%Y%m%d).sql.gz
```

---

## Orthanc (DICOM) Backup

Orthanc stores DICOM files in its data volume. There are two approaches:

### Option A: Volume Backup (preferred)

```bash
# Stop Orthanc to ensure consistency (brief downtime):
docker compose stop orthanc

# Backup the volume to a tar archive:
docker run --rm \
  -v radiolyze_orthanc-data:/data \
  -v /backup:/backup \
  alpine tar czf /backup/orthanc_$(date +%Y%m%d).tar.gz -C /data .

# Restart Orthanc:
docker compose start orthanc

echo "Orthanc backup complete"
```

### Option B: Online Export via Orthanc API (no downtime)

```bash
# Export all studies as DICOM zip (may be slow for large archives):
curl -s -u $ORTHANC_USER:$ORTHANC_PASS \
  "http://localhost:8042/studies?expand" \
  | python3 -c "import sys,json; [print(s['ID']) for s in json.load(sys.stdin)]" \
  | while read id; do
      curl -s -u $ORTHANC_USER:$ORTHANC_PASS \
        "http://localhost:8042/studies/$id/archive" \
        > /backup/orthanc_study_${id}.zip
    done
```

For large archives, schedule this during off-hours and use Option A for full volume recovery capability.

---

## Configuration Backup

```bash
# Backup all configuration files (exclude secrets if pushing to git)
tar czf /backup/config_$(date +%Y%m%d).tar.gz \
  /opt/radiolyze/.env \
  /opt/radiolyze/docker-compose.yml \
  /opt/radiolyze/docker/ \
  /etc/nginx/sites-available/radiolyze
```

Store configuration backups in a separate, secure location from the data backups.

---

## Backup Storage Recommendations

| Requirement | Recommendation |
|---|---|
| Off-site copy | Copy backups to a separate server or cloud storage (encrypted) |
| Encryption | Encrypt backups at rest: `gpg --symmetric backup.sql.gz` |
| Retention | ≥90 days for audit logs (regulatory minimum); ≥7 years for clinical reports (check local regulations) |
| Access control | Restrict backup directory to root or backup service account |
| Monitoring | Alert if backup job does not complete (check cron log or use a monitoring tool) |

---

## Recovery Procedures

### Recover PostgreSQL

```bash
# 1. Stop the backend to prevent writes during restore:
docker compose stop backend worker

# 2. Drop and recreate the database:
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS radiolyze;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE radiolyze;"

# 3. Restore from backup:
docker compose exec -T postgres psql -U postgres radiolyze \
  < /backup/radiolyze_20260428.sql

# 4. Restart backend:
docker compose start backend worker

# 5. Verify:
curl http://localhost:8000/api/v1/health
```

For compressed backups:

```bash
gunzip -c /backup/radiolyze_20260428.sql.gz \
  | docker compose exec -T postgres psql -U postgres radiolyze
```

### Recover Orthanc (Volume Restore)

```bash
# 1. Stop Orthanc:
docker compose stop orthanc

# 2. Clear existing volume (CAUTION — deletes current data):
docker volume rm radiolyze_orthanc-data
docker volume create radiolyze_orthanc-data

# 3. Restore from tar backup:
docker run --rm \
  -v radiolyze_orthanc-data:/data \
  -v /backup:/backup \
  alpine tar xzf /backup/orthanc_20260428.tar.gz -C /data

# 4. Restart Orthanc:
docker compose start orthanc

# 5. Verify — should show studies:
curl -s -u orthanc:orthanc http://localhost:8042/studies | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'studies')"
```

### Recover Configuration

```bash
# Extract to original locations:
tar xzf /backup/config_20260428.tar.gz -C /

# Rebuild containers with restored configuration:
docker compose up --build -d
```

---

## Backup Verification Schedule

Test your backups regularly — an untested backup is not a reliable backup.

| Test | Frequency | Procedure |
|---|---|---|
| PostgreSQL restore | Monthly | Restore to a test instance; verify row counts match |
| Orthanc restore | Monthly | Restore to a test instance; verify study count and open one study |
| Config restore | After each config change | Restore and rebuild on a staging system |
| Full disaster recovery drill | Annually | Restore everything to fresh hardware from backups |

Log each test with the date, result, and responsible person.

---

## Audit Log Retention

Audit logs are stored in the PostgreSQL `audit_events` table. Consider the following:

- **EU AI Act Article 12** requires logs to be kept for the lifetime of the AI system plus an additional period defined by the Member State.
- **GDPR** requires that personal data is not kept longer than necessary — balance compliance retention with data minimisation.
- Agree on a retention period with your Data Protection Officer before configuring automated deletion.

To export audit logs before deletion:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > /archive/audit_export_$(date +%Y%m%d).json
```

Store the export in a read-only archive accessible only to compliance and admin roles.
