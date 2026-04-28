# MedGemma — Modell-Tiefeneinblick

Detaillierte Dokumentation des in Radiolyze verwendeten MedGemma-KI-Modells: Architektur, Trainingsdaten, Benchmarks, Inferenz-Konfiguration und Audit-Trail-Integration.

---

## Modell-Übersicht

| Feld | Wert |
|---|---|
| Modellfamilie | MedGemma (Google DeepMind) |
| Standard-Variante | `google/medgemma-4b-it` |
| Alternative | `google/medgemma-27b-it` (konfigurierbar) |
| Modalität | Multimodal: Text + medizinische Bilder (JPEG/PNG) |
| Serving-Framework | vLLM (OpenAI-kompatibler Chat-Completions-Endpunkt) |
| Rolle in Radiolyze | Radiologie-Reporting-Assistent — Impressions-Generierung, Bildanalyse |

MedGemma ist ein **allgemeines medizinisches multimodales Modell** von Google DeepMind. Es ist kein reines Radiologie-Modell — es deckt Radiologie, Pathologie, Ophthalmologie und medizinische Fragebeantwortung ab. Radiolyze nutzt es spezifisch für Thorax-Röntgen- und CT-Impressions-Generierung via radiologiespezifischem Prompt.

---

## Architektur

| Komponente | Technologie |
|---|---|
| Sprachbasis | Gemma 2 (Transformer-Decoder, 4B oder 27B Parameter) |
| Vision-Encoder | SigLIP (Vision-Language Contrastive Encoder) |
| Eingabe | Bild (bis 896×896 px) + Text-Prompt |
| Ausgabe | Text (strukturiertes JSON oder Freitext) |
| Kontextfenster | 8.192 Token (vLLM Standard; konfigurierbar via `--max-model-len`) |

**Bildverarbeitungs-Pfad in Radiolyze:**

1. DICOM-Frames werden via Orthanc WADO-RS nach JPEG gerendert
2. Frames Base64-kodiert und als `image_url`-Inhalt in die vLLM-Chat-Completion-Anfrage eingebettet
3. Modell verarbeitet Bild + strukturierten Befundtext-Prompt
4. Ausgabe: JSON mit `impression`, `key_findings`, `evidence_indices`
5. Evidence-Indices verweisen auf spezifische DICOM-Frames im Viewer

---

## Trainingsdaten

MedGemma ist ein vortrainiertes Modell von Google DeepMind. Radiolyze führt **kein Fine-Tuning oder Vortraining** durch. Die folgenden Informationen basieren auf öffentlich verfügbarer Modell-Dokumentation.

| Datensatz | Typ | Hinweise |
|---|---|---|
| Gemma-2-Basis | Web-Text, Bücher, Code | Allgemeines Sprachverständnis |
| MIMIC-CXR | Thorax-Röntgen-Berichte + Bilder | Primäres Radiologie-Trainingssignal |
| Pathologie-Schnitte | Whole-Slide-Images | Digitale Pathologie-Fähigkeit |
| Ophthalmologie-Bilder | Fundusfotografie | Augenheilkunde-Fähigkeit |
| MedQA | Medizinische Prüfungs-QA | Klinisches Denken |
| PubMedQA | Biomedizinische Forschungs-QA | Wissenschaftliches Literaturverständnis |

!!! note "Regulatorischer Hinweis"
    Für EU-KI-Verordnung Art.-11-Technische-Dokumentation: aktuellen MedGemma Technical Report von Google DeepMind anfordern. Dieser liefert die autoritative Trainingsdaten-Herkunft für Ihre Annex-IV-Dokumentation.

---

## Benchmark-Leistung

Veröffentlichte Benchmark-Ergebnisse aus dem MedGemma Technical Report (Google, 2025). Lokale Validierung auf Ihre spezifische Deployment-Umgebung ist separat erforderlich.

| Benchmark | Aufgabe | Metrik | MedGemma-4B | MedGemma-27B |
|---|---|---|---|---|
| CheXpert | Thorax-Röntgen-Klassifikation (14 Befunde) | AUC | ~0,85 | ~0,89 |
| MIMIC-CXR Report Generation | Radiologischer Report-Generierung | RadGraph F1 | ~0,42 | ~0,46 |
| VQA-RAD | Radiologisches Visual Q&A | Accuracy | ~0,68 | ~0,73 |
| MedQA (USMLE) | Medizinische Prüfung | Accuracy | ~0,67 | ~0,74 |

Diese Metriken sind **kein Ersatz für standortspezifische Validierung.** Leistung auf Ihrer Patientenpopulation, Scanner-Typen und im klinischen Workflow kann abweichen.

---

## Bekannte Einschränkungen und Biases

| Einschränkung | Beschreibung | Mitigation in Radiolyze |
|---|---|---|
| Sprachbias | Vorwiegend auf Englisch vortrainiert; deutsche Befunde werden korrekt verarbeitet, aber Nuancen können abweichen | Prompts in Englisch gesendet; deutsche Übersetzung im Frontend |
| Populationsbias | Trainingsdaten primär aus US/westlichen Kliniken | Lokale Validierung vor klinischem Einsatz empfohlen |
| Modalitätsbias | Stärkste Leistung bei Thorax-Röntgen; schwächer bei seltenen Modalitäten (PET, Nuklearmedizin) | Modellname und -version in UI angezeigt |
| Halluzinationen | Wie alle LLMs kann MedGemma Befunde generieren, die nicht im Bild vorhanden sind | Menschliche Aufsicht obligatorisch; QA-Checks; Freigabe-Dialog |
| Bildqualitäts-Empfindlichkeit | Schlechte DICOM-Qualität reduziert Genauigkeit | Bildqualitäts-QA-Checks; Radiologe prüft Viewer |
| 2D-Frame-Einschränkung | Inferenz verwendet 2D-Frames, keine volumetrische 3D-Analyse | Frame-Anzahl konfigurierbar; Radiologe prüft vollständige Serie im Viewer |

---

## Inferenz-Konfiguration

| Parameter | Umgebungsvariable | Standard | Hinweise |
|---|---|---|---|
| Modell-ID | `VLLM_MODEL` | `google/medgemma-4b-it` | Auf `medgemma-27b-it` wechseln für höhere Qualität (erfordert ≥40 GB VRAM) |
| vLLM-Endpunkt | `VLLM_BASE_URL` | `http://vllm:8000` | Interne Docker-Dienst-URL |
| Temperatur | `VLLM_TEMPERATURE` | `0.1` | Niedrige Temperatur = deterministischer |
| Max. Token | `VLLM_MAX_TOKENS` | `512` | Maximale Impressionslänge |
| Max. aktuelle Frames | `VITE_INFERENCE_MAX_FRAMES_CURRENT` | `16` | Frames der aktuellen Studie |
| Max. Voruntersuchungs-Frames | `VITE_INFERENCE_MAX_FRAMES_PRIOR` | `8` | Frames der Voruntersuchung |

---

## Strukturierter Output

Radiolyze verwendet den `guided_json`-Parameter von vLLM zur Durchsetzung strukturierter JSON-Ausgabe:

```json
{
  "impression": "Keine akuten kardiopulmonalen Befunde. Herzgröße normal.",
  "key_findings": [
    {
      "finding": "Beidseitig freie Lungen",
      "region": "Lungen",
      "laterality": "beidseits"
    }
  ],
  "evidence_indices": [2, 5, 7]
}
```

- `impression`: Freitext-Impression für den Bericht
- `key_findings`: Strukturierte Befundliste für die QA-Engine
- `evidence_indices`: Frame-Indices (0-basiert), auf die sich der Modell-Output bezieht

---

## Audit-Trail-Integration

Jeder Inferenz-Aufruf erzeugt einen `InferenceJob`-Audit-Datensatz mit Modellversion, Input-Hash und Zeitstempeln. Der `input_hash` ist ein SHA-256-Hash der DICOM-Metadaten + Befundtext — kein PHI im Audit-Datensatz.

---

## Modell-Varianten wechseln

```bash
# In .env
VLLM_MODEL=google/medgemma-27b-it

# vLLM-Dienst neu starten
docker compose restart vllm

# VRAM-Nutzung überwachen
watch -n 2 nvidia-smi
```

MedGemma-27B erfordert eine GPU mit ≥40 GB VRAM. Für Multi-GPU: `--tensor-parallel-size 2` in `docker/compose/gpu.yml` setzen.

---

## Verwandte Seiten

- [Modell-Wechsel-Leitfaden](model-switching.md) — Schritt-für-Schritt Backend-Austausch
- [Validierungsleitfaden](validation.md) — Benchmarking und Leistungsmessung
- [GPU-Setup](../admin/gpu-setup.md) — Hardware-Anforderungen und Konfiguration
- [Audit Logging](../compliance/audit-logging.md) — Audit-Trail-Schema
- [Risikomanagement](../compliance/risk-management.md) — KI-Risikoanalyse
