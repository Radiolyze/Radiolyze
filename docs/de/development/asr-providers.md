# ASR-Provider-Leitfaden

Konfiguration, Wechsel und Erweiterung des Spracherkennungs-Providers (ASR) in Radiolyze.

---

## Architektur-Übersicht

Die ASR-Pipeline befindet sich vollständig in `backend/app/asr_providers.py`. Das Backend exponiert eine Funktion — `transcribe_audio()` — die den richtigen Provider anhand von Umgebungsvariablen auswählt und Audio an einen OpenAI-kompatiblen `/v1/audio/transcriptions`-Endpunkt sendet.

```
Frontend-Mikrofon → WebSocket → API /audio/transcribe
  → transcribe_audio()
    ├── ASR_ENABLED=false → Mock (gibt vorgefertigten Text zurück)
    ├── ASR_PROVIDER=medasr → MedASR-Service (Standard)
    └── ASR_PROVIDER=whisper → Whisper-kompatibler Service
```

Audio wird **ausschließlich im Arbeitsspeicher** verarbeitet. Kein Audio wird auf Disk geschrieben oder in der Datenbank gespeichert. Das Audit-Log zeichnet nur einen SHA-256-Hash des Audio-Blobs und dessen Länge auf.

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `ASR_ENABLED` | `false` | Hauptschalter — aktiviert echte ASR (überschreibt `MEDASR_ENABLED`) |
| `ASR_PROVIDER` | `medasr` | Provider-Auswahl: `medasr` oder `whisper` |
| `MEDASR_ENABLED` | `false` | Legacy-Schalter (wird verwendet wenn `ASR_ENABLED` nicht gesetzt) |
| `MEDASR_BASE_URL` | `http://medasr:8001` | MedASR-Service-URL |
| `MEDASR_MODEL` | `google/medasr` | Modellname in der Anfrage |
| `MEDASR_REQUEST_TIMEOUT` | `60` | Anfrage-Timeout in Sekunden |
| `MEDASR_API_KEY` | *(keiner)* | Optionaler Bearer-Token für MedASR |
| `MEDASR_FALLBACK_TO_MOCK` | `true` | Bei ASR-Fehler auf Mock-Transkript zurückfallen |
| `ASR_OPENAI_BASE_URL` | *(nutzt MEDASR_BASE_URL)* | Überschreibt Basis-URL für Whisper/OpenAI-kompatiblen Provider |
| `ASR_OPENAI_MODEL` | *(nutzt MEDASR_MODEL)* | Überschreibt Modellname für OpenAI-kompatiblen Provider |
| `ASR_OPENAI_API_KEY` | *(nutzt MEDASR_API_KEY)* | Überschreibt API-Schlüssel |
| `ASR_SEND_LANGUAGE` | `true` | Ob das `language`-Feld in der Anfrage gesendet wird |
| `MEDASR_DEFAULT_CONFIDENCE` | `0.0` | Konfidenz-Score wenn Provider keinen zurückgibt |

---

## Provider: Mock (Standard für Entwicklung)

Wenn `ASR_ENABLED=false` (Standard), gibt `transcribe_audio()` einen vorgefertigten Transkript aus `backend/app/mock_logic.py` zurück. Kein ASR-Service erforderlich.

---

## Provider: MedASR (Medizin-optimiertes GPU-ASR)

MedASR ist ein medizinisches Vokabular-optimierter Spracherkennungs-Service mit OpenAI-kompatibler API. Erfordert eine GPU.

```bash
# .env
ASR_ENABLED=true
ASR_PROVIDER=medasr
MEDASR_BASE_URL=http://medasr:8001

# Mit MedASR starten
docker compose --profile gpu up --build
```

**MedASR verifizieren:**

```bash
curl http://localhost:8001/v1/models
docker compose logs medasr --tail=20
```

---

## Provider: Whisper (CPU oder GPU, mehrsprachig)

Faster-Whisper ist ein Open-Source mehrsprachiges ASR-Modell. Unterstützt CPU-Inferenz — ohne GPU nutzbar.

```bash
# .env
ASR_ENABLED=true
ASR_PROVIDER=whisper
ASR_OPENAI_BASE_URL=http://whisper-asr:9000
ASR_OPENAI_MODEL=whisper-1

# Mit Whisper-Overlay starten
docker compose \
  -f docker-compose.yml \
  -f docker/compose/whisper.yml \
  up --build
```

**Modellauswahl:**

```bash
WHISPER_MODEL=base        # 74M Parameter — schnell
WHISPER_MODEL=small       # 244M — bessere Genauigkeit
WHISPER_MODEL=medium      # 769M — mehrsprachige Qualität
WHISPER_MODEL=large-v3    # 1,5B — beste Genauigkeit
```

---

## Benutzerdefinierten ASR-Provider hinzufügen

Jeder Service, der den OpenAI `/v1/audio/transcriptions`-Endpunkt implementiert, kann verwendet werden:

```bash
ASR_ENABLED=true
ASR_PROVIDER=openai_audio
ASR_OPENAI_BASE_URL=http://ihr-service:PORT
ASR_OPENAI_MODEL=ihr-modell-name
```

Keine Code-Änderungen erforderlich für standard OpenAI-kompatible Provider.

---

## Fallback-Verhalten

Bei ASR-Fehler (Netzwerkfehler, Service nicht verfügbar, Timeout):

1. Warnung mit Fehlerdetails wird geloggt
2. Fallback auf Mock-Transkript (wenn `MEDASR_FALLBACK_TO_MOCK=true`)
3. Mock-Text an Frontend zurückgegeben

Der Workflow wird durch ASR-Ausfall nie blockiert.

---

## ASR-Integration testen

```bash
# Backend-Provider-Konfiguration prüfen
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool

# ASR-Provider Unit-Tests ausführen
cd backend && python -m pytest tests/test_asr_providers.py -v

# Manueller Audio-Test
curl -X POST http://localhost:8000/api/v1/audio/transcribe \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.wav" \
  -F "language=de"
```

---

## Verwandte Seiten

- [GPU-Setup](../admin/gpu-setup.md) — NVIDIA/AMD-Voraussetzungen für MedASR
- [Modell-Wechsel-Leitfaden](../research/model-switching.md)
- [Entwicklungssetup](setup.md)
- [Tests](testing.md)
