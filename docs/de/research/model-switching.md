# Modell-Wechsel-Leitfaden

Schritt-für-Schritt-Anleitung zum Ersetzen oder Aktualisieren des KI-Inferenz-Backends in Radiolyze.

---

## Unterstützte Backends

Radiolyze verwendet eine OpenAI-kompatible Chat-Completions-API. Jedes Backend, das diese API implementiert, kann verwendet werden.

| Backend | Beschreibung | Anwendungsfall |
|---|---|---|
| **vLLM + MedGemma** | Standard — GPU-beschleunigte lokale Inferenz | Produktion (GPU-Server) |
| **vLLM + anderes Modell** | Beliebiges HuggingFace-Modell via vLLM | Forschung / Experimente |
| **Ollama** | Lokale CPU/GPU-Inferenz, einfachere Einrichtung | Entwicklung / ressourcenarme Umgebungen |
| **OpenAI API** | Cloud-Inferenz (GPT-4o, GPT-4V) | Evaluierung / keine GPU verfügbar |

!!! warning "Datenschutz: Cloud-Backends"
    Cloud-Backends (OpenAI, Groq, Together AI) senden DICOM-Bilddaten und Befundtext an externe Server. Dies ist **nicht mit dem klinischen Einsatz vereinbar**, sofern keine explizite Patienteneinwilligung und ein Auftragsverarbeitungsvertrag vorliegen. Cloud-Backends nur für Evaluierung mit anonymisierten oder synthetischen Daten verwenden.

---

## Backend-Konfiguration

Alle Backend-Einstellungen sind in `.env`:

```bash
# Welches Modell in vLLM geladen wird
VLLM_MODEL=google/medgemma-4b-it

# Basis-URL des OpenAI-kompatiblen Endpunkts
VLLM_BASE_URL=http://vllm:8000

# Inferenz-Parameter
VLLM_TEMPERATURE=0.1
VLLM_MAX_TOKENS=512
```

---

## MedGemma 4B → 27B wechseln

**Anforderungen:** GPU mit ≥ 40 GB VRAM (z.B. A100 80 GB, zwei A100 40 GB).

```bash
# 1. .env bearbeiten
VLLM_MODEL=google/medgemma-27b-it

# 2. Hugging Face Bedingungen für medgemma-27b-it akzeptieren (falls noch nicht)

# 3. Für Multi-GPU: docker/compose/gpu.yml bearbeiten
#    --tensor-parallel-size 2 zu vllm-Befehlsargumenten hinzufügen

# 4. vLLM neu starten
docker compose restart vllm

# 5. VRAM überwachen
watch -n 2 nvidia-smi

# 6. Modell-Ladung verifizieren
curl http://localhost:8001/v1/models
```

---

## Auf anderes HuggingFace-Modell wechseln

**Kompatibilitätsanforderungen:**
- Muss `image_url`-Inhalt in Nachrichten unterstützen
- Muss `guided_json`-Parameter (oder äquivalente strukturierte Ausgabe) unterstützen
- Muss das in `backend/app/inference_clients.py` verwendete Prompt-Format akzeptieren

```bash
# 1. .env bearbeiten
VLLM_MODEL=ihre-org/ihr-modell-name

# 2. HuggingFace-Token setzen falls Modell zugangsbeschränkt
HUGGINGFACE_HUB_TOKEN=hf_xxxxxxxxxxxxxxxxxx

# 3. vLLM neu starten
docker compose restart vllm

# 4. Modell-Ladung prüfen
curl http://localhost:8001/v1/models
docker compose logs vllm --tail=50
```

---

## Auf Ollama wechseln

```bash
# 1. Ollama installieren
curl -fsSL https://ollama.com/install.sh | sh

# 2. Vision-Modell herunterladen
ollama pull llava

# 3. .env bearbeiten:
VLLM_BASE_URL=http://host.docker.internal:11434
VLLM_MODEL=llava

# 4. Backend neu starten
docker compose restart backend worker

# 5. Testen
curl http://host.docker.internal:11434/v1/models
```

---

## Nach dem Wechsel: Prompt-Kompatibilität testen

```bash
curl -X POST http://localhost:8000/api/v1/inference/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "study_id": "IHRE_TEST-STUDIE-ID",
    "modality": "CXR"
  }'
```

Prüfen:
- `impression`-Feld mit kohärentem Text befüllt
- `key_findings` ist gültiges JSON-Array
- `evidence_indices` ist gültiges Integer-Array

---

## Nach dem Wechsel: Drift-Monitoring

Nach jedem Modellwechsel mindestens 2 Wochen lang überwachen:

```bash
# QA-Akzeptanzrate prüfen
curl http://localhost:8000/api/v1/monitoring/drift

# Audit-Log auf Inferenz-Fehler prüfen
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/audit?event_type=inference_failed&limit=20"
```

---

## Vorheriges Modell wiederherstellen

```bash
# .env bearbeiten — vorherigen VLLM_MODEL-Wert wiederherstellen
VLLM_MODEL=google/medgemma-4b-it

# vLLM neu starten
docker compose restart vllm
```

Alle Audit-Events zeichnen die Modellversion zum Zeitpunkt der Inferenz auf — historische Berichte bleiben vollständig rückverfolgbar.

---

## Verwandte Seiten

- [MedGemma-Tiefeneinblick](medgemma.md) — Modell-Architektur, Benchmarks, Konfiguration
- [Validierungsleitfaden](validation.md) — neues Modell nach Wechsel benchmarken
- [GPU-Setup](../admin/gpu-setup.md) — Hardware-Anforderungen
- [Audit Logging](../compliance/audit-logging.md) — Modellversions-Rückverfolgbarkeit
