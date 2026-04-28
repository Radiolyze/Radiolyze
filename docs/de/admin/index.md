# Administrations-Leitfaden

Dieser Abschnitt behandelt Deployment, Konfiguration, Sicherheit, Monitoring und Wartung von Radiolyze
in einer Krankenhausumgebung oder Private Cloud.

---

## Systemanforderungen

### Minimum (Evaluation / CPU-only)

| Komponente | Anforderung |
|---|---|
| CPU | 4 Kerne x86-64 |
| RAM | 8 GB |
| Speicher | 20 GB Stack + Speicher für DICOM-Archiv |
| Betriebssystem | Linux (aktuelle Distribution) |
| Docker | Engine 24.x + Compose v2 Plugin |
| Netzwerk | Ports 5173 (UI), 8000 (API), 8042 (Orthanc) von Clients erreichbar |

### Empfohlen (Klinisch / GPU KI)

| Komponente | Anforderung |
|---|---|
| CPU | 8+ Kerne |
| RAM | 32 GB |
| GPU | NVIDIA mit ≥16 GB VRAM (z.B. A100, RTX 4090) |
| Speicher | 100+ GB (SSD bevorzugt für DICOM) |
| Betriebssystem | Ubuntu 22.04 LTS |
| Docker | Engine 24.x + Compose v2 + NVIDIA Container Toolkit |

---

## Deployment-Modi

| Modus | Befehl | Anwendungsfall |
|---|---|---|
| CPU only | `docker compose up --build` | Evaluation, Entwicklung |
| NVIDIA GPU | `docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build` | KI-Inferenz (MedGemma) |
| AMD ROCm | `docker compose -f docker-compose.yml -f docker/compose/gpu.yml -f docker/compose/rocm.yml --profile rocm up --build` | AMD GPU Inferenz |
| Whisper ASR | `docker compose -f docker-compose.yml -f docker/compose/whisper.yml up --build` | Lokales Sprachdiktat |

---

## Wichtige Konfiguration (Umgebungsvariablen)

`env.example` nach `.env` kopieren und anpassen:

```bash
# KI-Modell-Zugang (erforderlich für MedGemma)
HUGGINGFACE_HUB_TOKEN=hf_xxx

# Orthanc-Zugangsdaten (IN PRODUKTION ÄNDERN!)
VITE_DICOM_WEB_USERNAME=orthanc
VITE_DICOM_WEB_PASSWORD=orthanc

# API-Proxy-Ziele (lokale Entwicklung ohne Docker)
VITE_API_PROXY_TARGET=http://localhost:8000
VITE_DICOM_WEB_PROXY_TARGET=http://localhost:8042

# KI-Inferenz Frame-Limits
VITE_INFERENCE_MAX_FRAMES_CURRENT=16
VITE_INFERENCE_MAX_FRAMES_PRIOR=8
```

---

## Sicherheit

!!! danger "Vor klinischem Einsatz unbedingt ändern"
    - Standard-Orthanc-Zugangsdaten: `orthanc/orthanc` — **müssen geändert werden**
    - Kein TLS standardmäßig — HTTPS via Reverse Proxy hinzufügen
    - Keine Authentifizierung/RBAC — Benutzer haben vollen Zugriff auf alle Studien

### Produktions-Sicherheits-Checkliste

- [ ] TLS am NGINX oder Ingress Reverse Proxy terminiert (HTTPS)
- [ ] HSTS für die UI-Domain aktiviert
- [ ] Orthanc-Zugangsdaten geändert und rotiert
- [ ] JWT-Secrets rotiert (keine Defaults)
- [ ] PostgreSQL-Passwort geändert (keine Defaults)
- [ ] Interne Dienste (DB, Redis, Orthanc) nicht auf öffentlichen Interfaces exponiert
- [ ] Firewall-Regeln: nur Ports 80/443 (oder 5173/8000 in Dev) von Clients offen
- [ ] Rate-Limiting in NGINX konfiguriert
- [ ] PHI nicht in Anwendungs-Logs gespeichert
- [ ] DICOM-Anonymisierung konfiguriert, wenn Studien das Krankenhaus-Netzwerk verlassen

Vollständige Security-Baseline: [Security-Dokumentation](../operations/security.md)

---

## Dienst-Health-Checks

| Dienst | Prüfung |
|---|---|
| Frontend | `curl http://localhost:5173` |
| Backend API | `curl http://localhost:8000/api/v1/health` |
| Orthanc | `curl -u orthanc:orthanc http://localhost:8042/api/system` |
| GPU / vLLM | `curl http://localhost:8001/v1/models` |
| Whisper | `curl http://localhost:9000/asr` |

Alle Dienste auf einmal prüfen:

```bash
docker compose ps
docker compose logs --tail 50
```

---

## DICOM-Integration

### Studien laden

DICOM-Daten an Orthanc senden via:

- **DICOM C-STORE** — Modalität oder PACS konfigurieren, an `<host>:4242` zu senden
- **DICOMweb STOW-RS** — `POST http://<host>:8042/dicom-web/studies`
- **Orthanc Web UI** — per Drag & Drop unter `http://<host>:8042`
- **Automatischer Seed** — `ORTHANC_SEED_URLS` in `.env` für öffentliche DICOM-Datensätze beim Start

### Orthanc-Konfiguration

Die Orthanc-Konfiguration ist in `docker-compose.yml` eingebettet. Für Produktion eine eigene `orthanc.json` einbinden:

```yaml
volumes:
  - ./config/orthanc.json:/etc/orthanc/orthanc.json
```

---

## Monitoring

Wichtige Metriken:

- **Prometheus-Metriken** (vLLM): `http://localhost:8001/metrics`
- **Drift-Monitoring**: `GET /api/v1/monitoring/drift`
- **Audit-Events**: `GET /api/v1/audit` (nur Admin-Zugriff)

Vollständiges Observability-Setup: [Observability-Leitfaden](../operations/observability.md)

---

## Backup

Drei Komponenten erfordern regelmäßige Backups:

| Komponente | Daten | Backup-Befehl |
|---|---|---|
| PostgreSQL | Berichte, Audit-Events | `pg_dump -U postgres radiolyze > backup.sql` |
| Orthanc | DICOM-Studien | Docker-Volume `orthanc-data` sichern |
| `.env` / Configs | Umgebungsvariablen | Sicher außerhalb des Repositories speichern |

Wiederherstellungen mindestens monatlich testen. Aufbewahrungsfristen gemäß lokalen regulatorischen Anforderungen dokumentieren.

---

## Starten und Stoppen

```bash
# Im Hintergrund starten
docker compose up -d

# Stoppen (Daten-Volumes bleiben erhalten)
docker compose down

# Stoppen und Volumes löschen (LÖSCHT ALLE DATEN)
docker compose down -v

# Einzelnen Dienst neu starten
docker compose restart backend
```

---

## Betriebs-Runbook

Für den täglichen Betrieb, Vorfälle und häufige Troubleshooting-Szenarien:
[Betriebs-Runbook](../operations/runbook.md)

---

*Detaillierte Leitfäden für GPU-Setup, Backup/Recovery, Monitoring-Alerting und Incident-Response sind für Phase 2 der Dokumentation geplant.*
