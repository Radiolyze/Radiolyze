# Häufig gestellte Fragen (FAQ)

Fragen sind nach Nutzergruppe gegliedert:

- [Für Radiologen und Ärzte](#fur-radiologen-und-arzte)
- [Für Administratoren](#fur-administratoren)
- [Für Forscher und KI-Spezialisten](#fur-forscher-und-ki-spezialisten)
- [Für Compliance-Beauftragte](#fur-compliance-beauftragte)
- [Allgemein](#allgemein)

---

## Für Radiologen und Ärzte

**Brauche ich technische Kenntnisse für die Nutzung?**

Nein. Die tägliche Nutzung (Studien öffnen, Findings diktieren, KI-Vorschläge prüfen, Berichte freigeben) erfordert keine technischen Kenntnisse. Konfiguration und Deployment werden von Ihrem IT-Administrator übernommen.

---

**Wie starte ich die Befundung einer Studie?**

Klicken Sie in der linken Sidebar auf eine Studie aus der Arbeitsliste. Der DICOM-Viewer lädt die Bilder in der Mitte. Öffnen Sie das Findings-Panel rechts, starten Sie das Sprachdiktat oder tippen Sie Ihre Findings, klicken Sie dann auf „Impression generieren", um einen KI-Entwurf zu erhalten. Entwurf prüfen, ggf. bearbeiten, und „Freigeben" klicken.

Vollständige Anleitung: [Fast-Reporting-Workflow](workflows/fast-report.md)

---

**Der KI-Entwurf ist falsch. Was soll ich tun?**

Prüfen und korrigieren Sie den KI-Entwurf immer vor der Freigabe. Radiolyze erfordert Ihre ausdrückliche Zustimmung — kein Bericht wird ohne sie gespeichert. Bearbeiten Sie den Impression-Text einfach im Panel. Ihre Korrektur wird im Audit-Trail protokolliert. Die KI ist ein Schreib-Assistent, keine diagnostische Autorität.

---

**Erstellt die KI die Diagnose für mich?**

Nein. Die KI generiert einen Textentwurf basierend auf der Bildanalyse. Der Radiologe ist immer für den endgültigen Bericht verantwortlich. Alle KI-Outputs sind als Entwürfe gekennzeichnet, und der Freigabe-Schritt ist obligatorisch.

---

**Kann ich eigene Berichtsvorlagen verwenden?**

Ja. Institutionelle Berichtsvorlagen können im Vorlagen-Panel konfiguriert werden. Wenden Sie sich an Ihren Administrator. Eigene Vorlagen werden auf die Findings- und Impression-Panels während der Befundung angewendet.

---

**Sprachdiktat erkennt mich nicht. Was tun?**

Prüfen Sie:
1. Mikrofon ist verbunden und Browser-Berechtigung wurde erteilt.
2. Das richtige Mikrofon ist in Ihrem Browser oder Betriebssystem ausgewählt.
3. Wenn Whisper verwendet wird: der Whisper-Dienst läuft (`docker compose ps`).
4. Deutlich und in normaler Geschwindigkeit sprechen.

---

**Kann ich mit Voruntersuchungen vergleichen?**

Ja. Das Prior-Studies-Panel in der linken Sidebar zeigt frühere Studien desselben Patienten. Ein Klick öffnet sie in der Split-View neben der aktuellen Studie, mit synchronem Scrolling.

---

## Für Administratoren

**Was sind die minimalen Hardware-Anforderungen?**

| Komponente | Minimum | Empfohlen (mit KI) |
|---|---|---|
| CPU | 4 Kerne | 8+ Kerne |
| RAM | 8 GB | 16–32 GB |
| GPU | Nicht erforderlich | NVIDIA, ≥16 GB VRAM |
| Speicher | 20 GB (Stack) | 100+ GB (DICOM-Archiv) |
| OS | Linux | Ubuntu 22.04 LTS |
| Docker | 24.x + Compose v2 | Aktuellste stabile Version |

---

**Braucht Radiolyze eine Internetverbindung?**

Nein — nach der Ersteinrichtung kann es vollständig air-gapped betrieben werden. Eine Internetverbindung wird bei der Einrichtung benötigt, um Docker-Images zu laden und ggf. MedGemma von Hugging Face herunterzuladen. Danach läuft alles lokal.

Siehe [Internetnutzungs-Strategie](operations/internet-usage.md).

---

**Wie aktiviere ich GPU-Beschleunigung?**

NVIDIA Container Toolkit installieren und das GPU Docker Compose Overlay verwenden:

```bash
sudo ./scripts/setup-nvidia-docker.sh
docker compose -f docker-compose.yml -f docker/compose/gpu.yml --profile gpu up --build
```

---

**Ist Radiolyze produktionsreif?**

Nein. Das Standard-Setup ist eine Referenzimplementierung für Evaluation und Entwicklung. Vor klinischem Einsatz müssen konfiguriert werden: TLS, Authentifizierung/RBAC, Firewall, Backup/Recovery und Security-Hardening. Siehe [Administrations-Leitfaden](admin/index.md).

---

**Kann ich Radiolyze On-Premises betreiben?**

Ja. Die Architektur ist für On-Premises- oder Private-Cloud-Deployment ausgelegt. Alle Dienste laufen in Docker-Containern; während des Betriebs verlassen keine Daten Ihr Netzwerk.

---

**Wie lade ich eigene DICOM-Studien?**

Studien an Orthanc senden via DICOM C-STORE (Port 4242), DICOMweb STOW-RS oder per Drag & Drop im Orthanc Web-UI (`http://<host>:8042`).

---

**Wie erstelle ich Backups?**

Drei Komponenten erfordern Backups: PostgreSQL (Berichte, Audit-Events), Orthanc (DICOM-Studien) und Konfigurationsdateien. Wiederherstellungen regelmäßig testen. Details: [Administrations-Leitfaden](admin/index.md#backup).

---

## Für Forscher und KI-Spezialisten

**Welches KI-Modell verwendet Radiolyze?**

Das Standard-KI-Modell ist [MedGemma](https://huggingface.co/google/medgemma) von Google — ein multimodales Modell, das auf medizinischen Bilddaten feinabgestimmt wurde. Es wird über [vLLM](https://github.com/vllm-project/vllm) mit einer OpenAI-kompatiblen API bereitgestellt.

---

**Kann ich MedGemma durch ein anderes Modell ersetzen?**

Ja. Der Inference-Client verwendet eine OpenAI-kompatible API. Jedes Modell, das über vLLM, Ollama oder einen kompatiblen Endpoint bereitgestellt wird, kann durch Änderung von `INFERENCE_BASE_URL` und `INFERENCE_MODEL` substituiert werden.

Siehe [Inferenz-Backend wechseln](research/index.md#inferenz-backend-wechseln).

---

**Wo finde ich Performance-Daten des Modells?**

Die [MedGemma Model Card](compliance/model-card-medgemma.md) dokumentiert Fähigkeiten, Einschränkungen und Bias-Überlegungen.

---

**Wie sind Patientendaten während der KI-Inferenz geschützt?**

Bilder werden an den lokal laufenden vLLM-Dienst gesendet — keine externen API-Aufrufe. Patienten-Metadaten werden nicht in Inferenz-Payloads eingeschlossen. Audit-Logs speichern Hashes, keine Rohdaten. Details: [Forscher-Leitfaden](research/index.md).

---

**Kann ich die Prompts anpassen?**

Ja. Prompt-Templates sind in `backend/app/prompts.py` definiert. Änderungen wirken sofort beim nächsten Inferenz-Aufruf.

---

## Für Compliance-Beauftragte

**Wie erfüllt Radiolyze den EU AI Act?**

| Artikel | Anforderung | Umsetzung |
|---|---|---|
| Art. 9 | Risikomanagement | FMEA-Tabelle (Annex IV § 8.1), QA-Checks |
| Art. 10 | Data Governance | On-Prem DICOM (Orthanc), Anonymisierungsmodul |
| Art. 12 | Logging & Rückverfolgbarkeit | Audit-Logger, PostgreSQL `audit_events` |
| Art. 13 | Transparenz | KI-Konfidenz-Labels, Modellversion in der UI |
| Art. 14 | Human Oversight | Obligatorischer Freigabe-Dialog, alle Outputs bearbeitbar |
| Art. 15 | Robustheit | Fallback-UI, Fehlerbehandlung, TLS (ausstehend) |
| Art. 72 | Post-Market-Monitoring | Drift-Snapshot-Scheduler, KPI-Dashboard |

Vollständiges Mapping: [EU AI Act Mapping](compliance/eu-ai-act-mapping.md)

---

**Wo sind die Audit-Logs gespeichert?**

Audit-Events werden in der PostgreSQL-Tabelle `audit_events` gespeichert. Jedes Event enthält: Zeitstempel, Benutzer, Session, Event-Typ, Bericht-ID, KI-Modell-Version, Inferenz-Dauer und einen Hash der Eingabedaten.

---

**Können Audit-Logs exportiert werden?**

Ja. Über die REST-API:

```bash
GET /api/v1/audit?export=json
```

Zugriff auf Admin-/Compliance-Rollen beschränken. Siehe [Audit Logging](compliance/audit-logging.md).

---

**Ist Radiolyze ein Medizinprodukt nach MDR?**

Das hängt vom Intended Use der betreibenden Einrichtung ab. Bei Einsatz zur Diagnoseunterstützung kann eine Klassifizierung als Klasse IIa oder IIb unter EU MDR 2017/745 erforderlich sein. Eine formale Konformitätsbewertung mit einer Benannten Stelle ist für den klinischen Betrieb erforderlich.

---

**Welche technische Dokumentation steht für Regulatoren zur Verfügung?**

- [Annex IV Technische Dokumentation](compliance/annex-iv.md)
- [Model Card (MedGemma)](compliance/model-card-medgemma.md)
- [EU AI Act Mapping](compliance/eu-ai-act-mapping.md)
- [Audit-Logging-Implementierung](compliance/audit-logging.md)
- [Architektur-Übersicht](architecture/overview.md)

---

## Allgemein

**Welche Sprachen unterstützt die Dokumentation?**

Englisch und Deutsch. Sprach-Umschalter in der oberen Navigationsleiste verwenden.

---

**Wo melde ich Fehler oder schlage Features vor?**

Issue auf [GitHub](https://github.com/radiolyze/radiolyze/issues) öffnen. Siehe [Contributing-Richtlinien](development/contributing.md).

---

**Welche Lizenz hat Radiolyze?**

Proprietär — alle Rechte vorbehalten. Siehe `LICENSE`-Datei im Repository-Root.
