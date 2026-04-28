# Backup und Recovery

Backup-Verfahren, Verifizierung und Wiederherstellung für alle Radiolyze-Datenkomponenten.

---

## Datenkomponenten

| Komponente | Was gespeichert wird | Volume / Pfad |
|---|---|---|
| **PostgreSQL** | Berichte, Audit-Events, Modell-Metriken | Docker Volume `postgres-data` |
| **Orthanc** | DICOM-Studien (Pixeldaten + Metadaten) | Docker Volume `orthanc-data` |
| **Konfiguration** | `.env`, Compose-Overlays, eigene Configs | Host-Dateisystem |

!!! danger "Alle drei sichern"
    Der Verlust einer Komponente macht das System nicht wiederherstellbar oder nicht-konform. EU AI Act Art. 12 erfordert Audit-Log-Aufbewahrung — PostgreSQL sichern.

---

## PostgreSQL Backup

### Manuelles Backup

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose exec postgres pg_dump \
  -U postgres radiolyze \
  > /backup/radiolyze_${TIMESTAMP}.sql
```

### Backup verifizieren

```bash
head -50 /backup/radiolyze_${TIMESTAMP}.sql
grep "CREATE TABLE" /backup/radiolyze_${TIMESTAMP}.sql
```

### Automatisiertes tägliches Backup (Cron)

```bash
# Zu root's crontab hinzufügen (crontab -e):
0 2 * * * docker compose -f /opt/radiolyze/docker-compose.yml exec -T postgres \
  pg_dump -U postgres radiolyze \
  > /backup/radiolyze_$(date +\%Y\%m\%d).sql 2>> /var/log/radiolyze-backup.log

# 30 Tage Backups behalten
0 3 * * * find /backup -name "radiolyze_*.sql" -mtime +30 -delete
```

### Komprimiertes Backup

```bash
docker compose exec postgres pg_dump -U postgres radiolyze \
  | gzip > /backup/radiolyze_$(date +%Y%m%d).sql.gz
```

---

## Orthanc (DICOM) Backup

### Option A: Volume-Backup (bevorzugt)

```bash
docker compose stop orthanc

docker run --rm \
  -v radiolyze_orthanc-data:/data \
  -v /backup:/backup \
  alpine tar czf /backup/orthanc_$(date +%Y%m%d).tar.gz -C /data .

docker compose start orthanc
```

### Option B: Online-Export via Orthanc-API (kein Ausfallzeit)

```bash
curl -s -u $ORTHANC_USER:$ORTHANC_PASS \
  "http://localhost:8042/studies?expand" \
  | python3 -c "import sys,json; [print(s['ID']) for s in json.load(sys.stdin)]" \
  | while read id; do
      curl -s -u $ORTHANC_USER:$ORTHANC_PASS \
        "http://localhost:8042/studies/$id/archive" \
        > /backup/orthanc_study_${id}.zip
    done
```

---

## Konfigurations-Backup

```bash
tar czf /backup/config_$(date +%Y%m%d).tar.gz \
  /opt/radiolyze/.env \
  /opt/radiolyze/docker-compose.yml \
  /opt/radiolyze/docker/ \
  /etc/nginx/sites-available/radiolyze
```

---

## Backup-Empfehlungen

| Anforderung | Empfehlung |
|---|---|
| Externer Standort | Backups auf separaten Server oder verschlüsselten Cloud-Storage kopieren |
| Verschlüsselung | Backups at-rest verschlüsseln: `gpg --symmetric backup.sql.gz` |
| Aufbewahrung | ≥90 Tage für Audit-Logs; ≥7 Jahre für klinische Berichte (lokale Vorschriften prüfen) |
| Zugriffskontrolle | Backup-Verzeichnis auf root oder Backup-Service-Account beschränken |
| Monitoring | Alarm wenn Backup-Job nicht abgeschlossen |

---

## Wiederherstellungsverfahren

### PostgreSQL wiederherstellen

```bash
# 1. Backend stoppen
docker compose stop backend worker

# 2. Datenbank neu erstellen
docker compose exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS radiolyze;"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE radiolyze;"

# 3. Aus Backup wiederherstellen
docker compose exec -T postgres psql -U postgres radiolyze \
  < /backup/radiolyze_20260428.sql

# 4. Backend neu starten
docker compose start backend worker

# 5. Verifizieren
curl http://localhost:8000/api/v1/health
```

Für komprimierte Backups:

```bash
gunzip -c /backup/radiolyze_20260428.sql.gz \
  | docker compose exec -T postgres psql -U postgres radiolyze
```

### Orthanc wiederherstellen (Volume-Restore)

```bash
docker compose stop orthanc

# ACHTUNG — löscht aktuelle Daten:
docker volume rm radiolyze_orthanc-data
docker volume create radiolyze_orthanc-data

docker run --rm \
  -v radiolyze_orthanc-data:/data \
  -v /backup:/backup \
  alpine tar xzf /backup/orthanc_20260428.tar.gz -C /data

docker compose start orthanc

# Verifizieren
curl -s -u orthanc:orthanc http://localhost:8042/studies \
  | python3 -c "import sys,json; print(len(json.load(sys.stdin)), 'Studien')"
```

### Konfiguration wiederherstellen

```bash
tar xzf /backup/config_20260428.tar.gz -C /
docker compose up --build -d
```

---

## Backup-Verifizierungsplan

| Test | Häufigkeit | Verfahren |
|---|---|---|
| PostgreSQL-Restore | Monatlich | Auf Testinstanz wiederherstellen; Zeilenanzahl prüfen |
| Orthanc-Restore | Monatlich | Auf Testinstanz wiederherstellen; Studienanzahl und eine Studie öffnen |
| Config-Restore | Nach jeder Config-Änderung | Auf Staging-System wiederherstellen und neu bauen |
| Vollständige DR-Übung | Jährlich | Alles auf frischer Hardware aus Backups wiederherstellen |

---

## Audit-Log-Aufbewahrung

- **EU AI Act Art. 12** erfordert Aufbewahrung für die Lebensdauer des KI-Systems plus eine vom Mitgliedstaat festgelegte zusätzliche Periode.
- **DSGVO** erfordert, dass personenbezogene Daten nicht länger als nötig aufbewahrt werden.
- Aufbewahrungsdauer mit Datenschutzbeauftragtem abstimmen.

Audit-Logs vor Löschung exportieren:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?export=json" \
  > /archiv/audit_export_$(date +%Y%m%d).json
```
