# Model Card – MedGemma (via vLLM)

**Erstellt:** 2026-04-25  
**Bezug:** EU AI Act Annex IV § 6 / § 11

---

## 1. Modell-Identifikation

| Feld | Wert |
|------|------|
| Modell-Familie | MedGemma (Google DeepMind) |
| Varianten | `google/medgemma-4b-it`, `google/medgemma-27b-it` (konfigurierbar via `VLLM_MODEL`) |
| Modalitaet | Multimodal: Text + Bild (Radiologie-JPEG/PNG) |
| Serving-Framework | vLLM (OpenAI-kompatibler Chat-Completions-Endpunkt) |
| Einsatzmodus | Radiologie-Reporting-Assistent (Impression, Localization) |

---

## 2. Intended Use

### 2.1 Vorgesehene Verwendung

- Generierung von radiologischen Befund-Impressionen aus strukturierten Findings + DICOM-Bildern.
- Bounding-Box-Lokalisierung auffaelliger Regionen in Einzelframes.
- Assistenz bei der Berichterstellung – **kein autonomer Diagnose-Ersatz**.

### 2.2 Nicht vorgesehene Verwendung (Out-of-scope)

- Autonome Befundentscheidungen ohne Arzt-Freigabe.
- Einsatz ausserhalb der radiologischen Bildgebung (Histologie, Endoskopie, etc.).
- Primaere Diagnose bei Notfaellen ohne parallele klinische Bewertung.
- Paedriatrische oder schwangerschaftsbezogene Befundung ohne spezifische Validierung.

---

## 3. Trainingsdaten (Upstream)

MedGemma ist ein von Google DeepMind veroeffentlichtes Basismodell. Radiolyze
betreibt **kein eigenes Vortraining**. Die nachfolgenden Informationen basieren
auf der oeffentlichen Modell-Dokumentation (Stand: 2025).

| Kategorie | Details |
|-----------|---------|
| Architektur | Gemma 2 (Transformer Decoder) + SigLIP Vision Encoder |
| Basis-Vortraining | Umfangreiche Webdaten (Common Crawl, Buchs, Code) via Gemma 2 |
| Medizinisches Fine-Tuning | Radiology reports (MIMIC-CXR), Pathologie-Slides, ophthalmologische Bilder, medizinische Fragestellungen (MedQA, MedMCQA, PubMedQA) |
| Lizenz | Gemma Terms of Use + Health AI Developer Foundations Terms |
| Quelle | https://ai.google.dev/gemma/docs/medgemma |

> **Hinweis:** Vollstaendige Informationen zu Trainingsdaten, Datenquellen und
> Evaluierungsmetriken des Upstream-Modells sind im Google MedGemma Technical
> Report dokumentiert. Fuer regulatorische Pruefzwecke wird empfohlen, den
> aktuellen Technical Report von Google DeepMind anzufordern.

---

## 4. Evaluationsmetriken (Upstream)

Gemaess oeffentlichem MedGemma Technical Report (Google, 2025):

| Benchmark | Aufgabe | Metrik | MedGemma-4B | MedGemma-27B |
|-----------|---------|--------|-------------|--------------|
| CheXpert | Chest X-Ray Klassifikation | AUC | ~0.85 | ~0.89 |
| MIMIC-CXR Report Gen. | Radiologie-Report-Generierung | RadGraph F1 | ~0.42 | ~0.46 |
| VQA-RAD | Radiologisches Visual Q&A | Accuracy | ~0.68 | ~0.73 |
| MedQA (USMLE) | Medizinisches QA | Accuracy | ~0.67 | ~0.74 |

> Die Metriken sind Richtwerte aus oeffentlich verfuegbaren Benchmarks.
> Lokale Validierungsmessungen fuer den spezifischen Einsatzkontext (DE, klinische
> Praxis) muessen vom Betreiber separat erhoben werden (Art. 9 EU AI Act).

---

## 5. Bekannte Einschraenkungen & Biases

| Einschraenkung | Beschreibung | Mitigation in Radiolyze |
|---------------|-------------|------------------------|
| Sprachbias | Vortraining ueberwiegend auf Englisch; DE-Befunde werden korrekt prozessiert, aber Nuancen koennen abweichen | Prompts in EN; DE-Uebersetzung im Frontend |
| Populationsbias | Trainingsdaten stammen primaer aus US-/westlichen Kliniken | Lokale Validierung empfohlen |
| Modalitaetsbias | Staerker bei Chest X-Ray als bei seltenen Modalitaeten (PET, Nuklearmedizin) | Modell-Version und Konfidenz im UI sichtbar |
| Halluzinationen | Wie alle LLMs kann MedGemma Befunde generieren, die nicht im Bild vorhanden sind | Human-Oversight obligatorisch; QA-Checks |
| Bildqualitaet | Schlechte DICOM-Qualitaet (Bewegungsartefakte, Rauschen) reduziert Genauigkeit | Bildqualitaets-QA-Checks; Radiologe prueft Overlay |

---

## 6. Inference-Konfiguration in Radiolyze

| Parameter | ENV-Variable | Standardwert |
|-----------|-------------|--------------|
| Modell-ID | `VLLM_MODEL` | `google/medgemma-4b-it` |
| Endpunkt | `VLLM_BASE_URL` | `http://vllm:8000` |
| Temperatur | `VLLM_TEMPERATURE` | 0.1 (deterministisch) |
| Max Tokens | `VLLM_MAX_TOKENS` | 512 |
| Guided JSON | Automatisch via `guided_json` Parameter | Aktiviert fuer strukturierte Outputs |

---

## 7. Audit-Trail

Jeder Inference-Aufruf erzeugt einen `InferenceJob`-Eintrag mit:
- `model_version` (aus `VLLM_MODEL`)
- `input_hash` (SHA-256 der DICOM-Metadaten + Findings-Text)
- `queued_at`, `started_at`, `completed_at`
- `metadata_json` mit `image_refs` (InstanceUIDs, Frame-Indices)

---

## 8. Versionierung & Update-Prozess

1. Modell-Update: `VLLM_MODEL` ENV-Variable aendern + Container-Neustart.
2. Alle neuen Model-Versionen erzeugen einen neuen Audit-Event-Trail.
3. Nach Modell-Update: Drift-Monitoring fuer 2 Wochen engmaschig beobachten.
4. Signifikante Versionsaenderungen erfordern interne Validierung vor Prod-Deployment.

---

## 9. Kontakt & Verantwortung

- **Modell-Hersteller:** Google DeepMind (google/medgemma)
- **Systembetreiber / Inverkehrbringer:** (TBD Organisation – Annex IV § 1)
- **Technischer Ansprechpartner:** (TBD)
