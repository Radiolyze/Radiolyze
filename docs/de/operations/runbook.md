# Betriebs-Runbook

Tägliche Betriebsverfahren für Radiolyze-Administratoren.

---

## Starten und Stoppen

### Alle Dienste starten

```bash
# CPU-Modus (Standard)
docker compose up -d

# GPU-Modus (NVIDIA)
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up -d

# GPU + Whisper ASR
docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/whisper.yml --profile gpu up -d
```

### Alle Dienste stoppen (Daten bleiben erhalten)

```bash
docker compose down
```

### Einzelnen Dienst neu starten

```bash
docker compose restart backend
docker compose restart orthanc
docker compose restart postgres
docker compose restart vllm
```

### Vollständiger Dienst-Status

```bash
docker compose ps
```

---

## Health Checks

Alle Health Checks auf einmal ausführen:

```bash
echo "=== Backend ===" && curl -sf http://localhost:8000/api/v1/health || echo "FAIL"
echo "=== Orthanc ===" && curl -sf -u orthanc:orthanc http://localhost:8042/api/system | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK -', d.get('DicomAet','?'))" || echo "FAIL"
echo "=== Postgres ===" && docker compose exec postgres pg_isready -U postgres || echo "FAIL"
echo "=== Redis ===" && docker compose exec redis redis-cli ping || echo "FAIL"
echo "=== vLLM ===" && curl -sf http://localhost:8001/v1/models || echo "FAIL (kein GPU?)"
```

### Erwarteter gesunder Zustand

| Dienst | Gesunde Antwort |
|---|---|
| Backend | `{"status": "ok", ...}` |
| Orthanc | JSON mit `DicomAet`-Feld |
| PostgreSQL | `postgres:5432 - accepting connections` |
| Redis | `PONG` |
| vLLM | JSON mit Modellliste |

---

## GPU überwachen

```bash
# Echtzeit-GPU-Auslastung (NVIDIA)
nvidia-smi dmon -s u -d 5

# Einzelne Momentaufnahme
nvidia-smi

# vLLM Prometheus-Metriken
curl -s http://localhost:8001/metrics | grep -E "vllm_gpu_cache|num_requests"
```

---

## Logs anzeigen

```bash
# Alle Dienste (letzte 100 Zeilen)
docker compose logs --tail=100

# Einzelnen Dienst in Echtzeit verfolgen
docker compose logs -f backend
docker compose logs -f vllm

# Nach Fehlern suchen
docker compose logs backend | grep -i error | tail -20

# Worker-Logs
docker compose logs worker | tail -50
```

---

## Datenbank-Operationen

### Mit PostgreSQL verbinden

```bash
docker compose exec postgres psql -U postgres radiolyze
```

Nützliche SQL-Abfragen:

```sql
-- Berichte zählen
SELECT status, COUNT(*) FROM reports GROUP BY status;

-- Aktuelle Audit-Events
SELECT created_at, event_type, report_id FROM audit_events
ORDER BY created_at DESC LIMIT 20;

-- Audit-Log-Größe prüfen
SELECT pg_size_pretty(pg_total_relation_size('audit_events'));

-- Letzte Inferenz-Jobs
SELECT created_at, status, model_version, duration_ms
FROM audit_events WHERE event_type LIKE 'inference_%'
ORDER BY created_at DESC LIMIT 10;
```

### Manuelles Datenbank-Backup

```bash
docker compose exec postgres pg_dump -U postgres radiolyze \
  > /backup/radiolyze_$(date +%Y%m%d_%H%M%S).sql
```

Vollständiges Verfahren: [Backup und Recovery](backup-recovery.md)

---

## Orthanc-Betrieb

### Studienanzahl prüfen

```bash
curl -s -u orthanc:orthanc http://localhost:8042/statistics \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{d[\"CountStudies\"]} Studien, {d[\"CountInstances\"]} Instanzen')"
```

### Orthanc Web-UI

`http://localhost:8042` im Browser öffnen. Mit konfigurierten Zugangsdaten anmelden.

### Manueller DICOM-Upload

```bash
# Eine DICOM-Datei hochladen
curl -s -u orthanc:orthanc \
  -X POST http://localhost:8042/instances \
  -H "Content-Type: application/dicom" \
  --data-binary @/pfad/zur/studie.dcm
```

---

## Incident Response

Diese Checkliste bei Dienstausfall oder Benutzermeldungen verwenden.

### Schritt 1: Fehlerhaften Dienst identifizieren

```bash
docker compose ps
docker compose logs --tail=30 backend
docker compose logs --tail=30 orthanc
```

### Schritt 2: Häufige Probleme und Lösungen

| Symptom | Dienst | Lösung |
|---|---|---|
| UI lädt nicht | Frontend | `docker compose restart frontend` oder NGINX prüfen |
| Arbeitsliste leer | Orthanc / Backend | Orthanc Health prüfen; `docker compose restart backend` |
| KI liefert Fehler | vLLM | GPU prüfen; siehe [GPU-Fehlerbehebung](gpu-setup.md#fehlerbehebung) |
| ASR transkribiert nicht | Worker / Whisper | `docker compose restart worker` |
| „Datenbank-Verbindungsfehler" | PostgreSQL | `docker compose restart postgres backend` |
| „Redis-Verbindungsfehler" | Redis | `docker compose restart redis worker` |
| Berichte werden nicht gespeichert | Backend / DB | Backend-Logs prüfen; `docker compose restart backend` |

### Schritt 3: Eskalationspfad

1. **Erste Maßnahme:** Fehlerhaften Dienst neu starten (`docker compose restart <dienst>`).
2. **Wenn Neustart nicht hilft:** Logs auf Ursache prüfen.
3. **Wenn Datenintegrität betroffen:** Dienst zuerst stoppen, Logs prüfen, dann neu starten.
4. **Bei Datenbankkorruption:** Aus aktuellstem Backup wiederherstellen.
5. **Bei GPU-Treiberproblem:** Server neu starten; `nvidia-smi` nach Neustart prüfen.

### Schritt 4: Nach Incident-Recovery

- Alle Dienste auf Gesundheit prüfen
- Audit-Logs auf unvollständige Events während des Ausfalls prüfen
- Incident dokumentieren: Ursache, Ausfallzeit, Lösung, betroffene Berichte

---

## Geplante Wartung

### Vor der Wartung

1. Radiologen über Nicht-Verfügbarkeit informieren
2. Laufende KI-Jobs abwarten:
   ```bash
   docker compose exec redis redis-cli llen rq:queue:default
   # Warten bis 0 zurückgegeben wird
   ```
3. Backup vor Änderungen erstellen

### Während der Wartung

```bash
docker compose down
# Änderungen durchführen
docker compose up --build -d
```

### Nach der Wartung

1. Vollständigen Health Check durchführen
2. Teststudie laden und einen Bericht freigeben
3. Radiologen über Wiederherstellung informieren

---

## Wöchentliche Routineprüfungen

| Prüfung | Befehl |
|---|---|
| Festplattenspeicher | `df -h /var/lib/docker` |
| Docker-Volume-Größen | `docker system df -v` |
| Backup-Vollständigkeit | `ls -lh /backup/*.sql \| tail -10` |
| Fehlerrate in Logs | `docker compose logs --since 7d backend \| grep -c ERROR` |
| GPU-VRAM-Headroom | `nvidia-smi --query-gpu=memory.used,memory.total --format=csv` |

---

## Radiolyze aktualisieren

```bash
git pull origin main
docker compose up --build -d
docker compose ps
curl http://localhost:8000/api/v1/health
```

Datenbank-Migrationen laufen automatisch beim Backend-Start.

---

## Notfall: Alle Dienste sofort stoppen

```bash
docker compose kill
docker compose rm -f
docker compose up -d
```

Nur verwenden, wenn `docker compose down` nach 60 Sekunden nicht reagiert.
