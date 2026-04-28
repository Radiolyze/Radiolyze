# Validierungs- & Benchmarking-Leitfaden

Anleitung zur Messung, Dokumentation und Berichterstattung der KI-System-Leistung in Ihrer Radiolyze-Deployment-Umgebung. Erforderlich für EU-KI-Verordnung Art. 9 und Art. 11-Compliance.

---

## Warum lokal validieren

Upstream-Benchmark-Ergebnisse (CheXpert AUC, MIMIC-CXR RadGraph F1) wurden auf standardisierten englischsprachigen Datensätzen aus US-Krankenhäusern gemessen. Ihre Deployment-Umgebung kann abweichen in:

- Scanner-Hersteller und -Modell (unterschiedliche Bildqualitätseigenschaften)
- Patientenpopulations-Demografie
- Berichtssprache (Deutsch, Französisch etc.)
- Institutionsspezifische Befundungskonventionen
- DICOM-Frame-Auswahl und Fensterungs-Einstellungen

**Lokale Validierung ist für den klinischen Einsatz nicht optional.** Sie liefert die Nachweise gemäß EU-KI-Verordnung Art. 9 (Risikomanagement) und Art. 11 (Technische Dokumentation).

---

## Validierungsdaten-Anforderungen

| Anforderung | Richtlinie |
|---|---|
| Stichprobengröße | ≥ 100 Fälle pro Modalität (≥ 200 für Primärmodalität) |
| Goldstandard | Radiologisch erstellte Berichte (nicht KI-assistiert); idealerweise Doppelbefundung |
| Fallauswahl | Zufällige Stichprobe aus Routine-Warteschlange; Randfälle einbeziehen |
| Zeitraum | Prospektiv bevorzugt; retrospektiv akzeptabel wenn kein Selektionsbias |
| Datenteilung | Validierungsset muss von Trainings-/Fine-Tuning-Daten getrennt sein |
| Anonymisierung | DICOM-De-Identifizierung vor externer Verarbeitung anwenden |

---

## Schritt-für-Schritt-Validierungsprozess

### 1. Datensatz vorbereiten

```bash
# Studien-IDs für Validierung exportieren
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT study_id FROM reports WHERE modality = 'CXR' 
      AND created_at BETWEEN '2026-01-01' AND '2026-03-31'
      ORDER BY RANDOM() LIMIT 200;" \
  -t -A > validierung_studien_ids.txt
```

### 2. Batch-Inferenz ausführen

```bash
# Inferenz für alle Validierungs-Studien auslösen
while read STUDY_ID; do
  curl -s -X POST http://localhost:8000/api/v1/inference/queue \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"study_id\": \"$STUDY_ID\", \"validation\": true}"
done < validierung_studien_ids.txt
```

### 3. Ergebnisse exportieren

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/v1/training/export?format=json&include_inference=true" \
  > validierung_ergebnisse.json
```

### 4. NLP-Metriken berechnen

```python
import json
import evaluate

with open("validierung_ergebnisse.json") as f:
    data = json.load(f)

references = [fall["gold_impression"] for fall in data["cases"]]
predictions = [fall["ai_impression"] for fall in data["cases"]]

# ROUGE-Scores (lexikalische Überschneidung)
rouge = evaluate.load("rouge")
ergebnisse = rouge.compute(predictions=predictions, references=references)
print("ROUGE-1:", ergebnisse["rouge1"])
print("ROUGE-L:", ergebnisse["rougeL"])

# BERTScore (semantische Ähnlichkeit)
bertscore = evaluate.load("bertscore")
bert = bertscore.compute(
    predictions=predictions,
    references=references,
    lang="de"  # für deutsche Berichte
)
print("BERTScore F1 (Mittel):", sum(bert["f1"]) / len(bert["f1"]))
```

### 5. Klinische Qualitätsbewertung

| Metrik | Messmethode |
|---|---|
| **Klinische Genauigkeitsrate** | Radiologen-Prüfung: War die Impression klinisch korrekt? (Ja/Nein/Teilweise) |
| **Kritischer-Befund-Erkennungsrate** | Von Studien mit kritischen Befunden: Wie viel % erkannte die KI? |
| **Falsch-Positiv-Rate** | Wie oft generierte KI nicht im Bild vorhandene Befunde? |
| **Seitenangaben-Fehlerrate** | Links/Rechts-Fehler pro 100 Berichte |
| **QA-Pass-Rate** | % der KI-Impressionen, die QA ohne Modifikation passierten |
| **Radiologen-Akzeptanzrate** | % der KI-Impressionen, die ohne Bearbeitung genehmigt wurden |

---

## NLP-Metriken-Referenz

| Metrik | Was gemessen wird | Guter Schwellwert |
|---|---|---|
| ROUGE-1 | Unigram Recall/Precision | > 0,40 |
| ROUGE-L | Longest Common Subsequence | > 0,35 |
| BERTScore F1 | Semantische Ähnlichkeit | > 0,85 |
| RadGraph F1 | Entitäts-Relations-Graph-Überschneidung | > 0,35 |

---

## Compliance-Verbindung

| Compliance-Anforderung | Validierungsnachweis |
|---|---|
| EU-KI-Verordnung Art. 9 (Risikomanagement) | Validierungsergebnisse quantifizieren Restrisiko R-02 |
| EU-KI-Verordnung Art. 11 (Technische Dokumentation) | Validierungsbericht = Annex IV § 7 (Leistungsmetriken & Validierung) |
| EU-KI-Verordnung Art. 72 (Post-Market-Monitoring) | Baseline-Metriken für Drift-Erkennung |
| ISO 14971 Risikomanagement | Klinische Genauigkeitsrate informiert Wahrscheinlichkeitsschätzungen in FMEA |

---

## Laufendes Monitoring

```bash
curl http://localhost:8000/api/v1/monitoring/drift
```

**Empfohlene Alarm-Schwellwerte:**

| Metrik | Alarm-Schwellwert |
|---|---|
| QA-Pass-Rate-Abfall | > 5 PP unter Validierungs-Baseline |
| KI-Akzeptanzrate-Abfall | > 10 PP unter Validierungs-Baseline |
| Inferenz-Fehlerrate | > 5% |
| Inferenz-Latenz | > 2× Validierungs-Baseline |

---

## Validierungsbericht — Mindestinhalt

1. **Getestetes System**: Modellversion, Inferenz-Konfiguration, vLLM-Version, Datum
2. **Datensatz**: Fallanzahl, Modalitätsaufschlüsselung, Zeitraum, Anonymisierungsmethode
3. **Methodik**: Goldstandard-Erstellung, Qualifikationen der Prüfer, Verblindungsansatz
4. **Ergebnisse**: NLP-Metriken-Tabelle + klinische Qualitätstabelle + Untergruppen-Analyse
5. **Vergleich mit Upstream-Benchmarks**: Wie lokale Ergebnisse im Vergleich zu MedGemma-Benchmarks liegen
6. **Einschränkungen**: Bekannte Lücken, ausgeschlossene Fälle, Populationsunterschiede
7. **Schlussfolgerung**: Für klinischen Einsatz akzeptabel? Bedingungen / Monitoring-Anforderungen?
8. **Freigabe**: Klinische Leitung + Compliance-Beauftragter + Datum

---

## Verwandte Seiten

- [MedGemma-Tiefeneinblick](medgemma.md) — Upstream-Benchmark-Details
- [Modell-Wechsel-Leitfaden](model-switching.md) — neues Modell nach Wechsel benchmarken
- [Risikomanagement](../compliance/risk-management.md) — wie Validierung in FMEA einfließt
- [Nachweise-Übersicht](../compliance/evidence-overview.md) — wo Validierungsergebnisse gespeichert werden
- [Observability](../operations/observability.md) — laufendes Monitoring-Setup
