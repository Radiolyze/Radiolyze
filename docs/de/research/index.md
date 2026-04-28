# Leitfaden für Forscher und KI-Spezialisten

Dieser Abschnitt behandelt das KI-Subsystem von Radiolyze: das MedGemma-Modell, die Inferenz-Pipeline,
den Austausch des KI-Backends und die Validierung von Outputs.

---

## KI-System-Übersicht

Radiolyze verwendet eine **multimodale KI-Pipeline**, um radiologische Befundsentwürfe aus DICOM-Bildern zu generieren:

```
DICOM-Frames (JPEG)
        │
        ▼
  Inference-Client          backend/app/inference_clients.py
  (OpenAI-kompatibel)
        │
        ▼
    vLLM-Server             GPU-Docker-Container
  + MedGemma-Modell         google/medgemma-4b-it (Standard)
        │
        ▼
  Findings + Impression     Strukturierter Text zurück an die UI
  Textentwurf
```

**Wichtige Eigenschaften:**
- Der Inferenz-Endpoint ist **OpenAI-API-kompatibel** (`/v1/chat/completions`)
- Bilder werden als Base64-kodierte JPEG-Frames gesendet (aus DICOM-Stacks gesampelt)
- Anzahl der Frames konfigurierbar: `VITE_INFERENCE_MAX_FRAMES_CURRENT` (Standard: 16)
- Alle Prompts anpassbar in `backend/app/prompts.py`

---

## MedGemma-Modell

### Was es ist

[MedGemma](https://huggingface.co/google/medgemma) ist ein multimodales Sprachmodell von Google,
das auf medizinischen Bilddaten feinabgestimmt wurde. Es empfängt Bilder und Textanweisungen
und erzeugt strukturierten medizinischen Text.

### Fähigkeiten

- Findings-Beschreibungen aus Röntgen-Thorax, CT und MR generieren
- Radiologische Impressions aus strukturierten Findings entwerfen
- Strukturierte Ausgabeformate gemäß Prompt-Templates einhalten

### Einschränkungen und bekannte Probleme

!!! warning "Klinische Validierung erforderlich"
    MedGemma ist ein Forschungsmodell. Seine Ausgaben wurden **nicht klinisch validiert** für die
    spezifische Patientenpopulation, Bildqualität und Anwendungsfälle Ihrer Einrichtung.
    KI-Outputs dürfen nicht ohne Radiologen-Prüfung verwendet werden.

| Einschränkung | Details |
|---|---|
| Halluzinationen | Das Modell kann plausibel klingende, aber falsche Findings generieren |
| Bildqualitäts-Sensitivität | Schlechte oder nicht-standardisierte Aufnahmen reduzieren die Genauigkeit |
| Modalitäts-Abdeckung | Beste Performance bei Röntgen-Thorax; CT/MR variiert je nach Sequenz |
| Sprache | Standard-Outputs auf Englisch; mehrsprachiges Prompting reduziert Qualität |
| Seltene Befunde | Ungewöhnliche Pathologien können übersehen oder falsch charakterisiert werden |
| Keine Anamnese | Das Modell hat keinen Zugang zu klinischem Kontext außer Bildern und Prompt |

### Bias-Überlegungen

- Demographische Merkmale der Trainingsdaten können von Ihrer Patientenpopulation abweichen
- Performance kann je nach Patientenalter, Geschlecht und Körperbau variieren
- Lokale klinische Validierung ist vor klinischem Deployment unerlässlich

Vollständige Model Card: [MedGemma Model Card](../compliance/model-card-medgemma.md)

---

## Inferenz-Backend wechseln

Der Inference-Client verwendet eine **OpenAI-kompatible REST-API**. Für ein anderes Modell:

### 1. Umgebungsvariablen ändern

```bash
# In .env
INFERENCE_BASE_URL=http://localhost:8001/v1   # Ihr vLLM / Ollama Endpoint
INFERENCE_MODEL=ihr-modell-name               # Modell-Bezeichner
```

### 2. Unterstützte Backends

| Backend | Hinweise |
|---|---|
| **vLLM** (Standard) | Beste Performance für große Modelle, NVIDIA GPU |
| **Ollama** | Einfaches Setup, breitere Hardware-Unterstützung, geringerer Durchsatz |
| **OpenAI API** | Cloud-Fallback; sendet Bilder extern — PHI-Implikationen beachten |
| **Jeder OpenAI-kompatibler Server** | LM Studio, llama.cpp server etc. |

### 3. Verbindung prüfen

```bash
curl http://localhost:8001/v1/models
```

---

## Prompts anpassen

Alle Prompt-Templates befinden sich in `backend/app/prompts.py`:

| Template | Zweck |
|---|---|
| `FINDINGS_SYSTEM_PROMPT` | System-Rolle für Findings-Generierung |
| `FINDINGS_USER_TEMPLATE` | Per-Request Findings-Prompt mit Bild-Injection |
| `IMPRESSION_SYSTEM_PROMPT` | System-Rolle für Impression-Entwurf |
| `IMPRESSION_USER_TEMPLATE` | Impression-Generierung aus Findings-Text |

Änderungen wirken sofort beim nächsten Inferenz-Aufruf — kein Neustart erforderlich.

---

## Datenfluss für Datenschutz-Analyse

```
Browser (React)
  │  JPEG-Frames (Base64, aus DICOM gesampelt)
  │  HTTP POST /api/v1/inference/findings
  ▼
FastAPI Backend
  │  Job in Redis (RQ) einreihen
  │  Keine PHI im Queue-Payload (DICOM-Tags entfernt)
  ▼
RQ Worker
  │  Frames + Prompt an vLLM senden (internes Docker-Netzwerk)
  │  Aufzeichnen: job_id, model_version, duration, image_hash → audit_events
  ▼
vLLM / MedGemma
  │  Bilder lokal verarbeiten (keine externen Aufrufe)
  ▼
Backend → Browser: Inferenz-Ergebnis (nur Text)
```

**PHI-Behandlung:**
- DICOM-Pixeldaten werden als JPEG nur an den lokalen vLLM-Dienst gesendet
- Patienten-Metadaten (Name, Geburtsdatum, ID) werden nie in Inferenz-Payloads eingeschlossen
- Audit-Logs speichern Hashes, keine Rohdaten
- Keine Daten verlassen das Docker-Netzwerk während der Inferenz

---

## Validierung & Benchmarking

Zur Validierung der Modell-Performance für Ihren Anwendungsfall:

1. **Referenz-Datensatz erstellen** — Studien mit bekannten Ground-Truth-Befunden (anonymisiert).
2. **Inferenz ausführen** — `POST /api/v1/inference/findings` für jede Studie.
3. **Outputs vergleichen** — NLP-Metriken (BLEU, ROUGE, BERTScore) oder klinische Bewertung.
4. **Ergebnisse protokollieren** — Findings und Audit-Events sind in PostgreSQL für die Analyse gespeichert.

Audit-Daten exportieren:

```bash
GET /api/v1/audit?export=json
```

---

## Zu KI-Verbesserungen beitragen

Um Prompt-Verbesserungen, Modell-Evaluierungen oder neue Inferenz-Backends beizutragen:

1. [Contributing-Richtlinien](../development/contributing.md) lesen.
2. GitHub-Issue eröffnen mit Beschreibung der vorgeschlagenen Änderung.
3. Für Prompt-Änderungen: `backend/app/prompts.py` bearbeiten und Vorher/Nachher-Beispiele im PR einschließen.
4. Für neue Inferenz-Backends: Client-Interface in `backend/app/inference_clients.py` implementieren.

---

*Detaillierte Leitfäden für neue Inferenz-Backends, Benchmarking-Methodik und RAG-Integration sind für Phase 3 der Dokumentation geplant.*
