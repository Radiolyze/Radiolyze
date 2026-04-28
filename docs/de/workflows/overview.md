# Workflows-Übersicht

Radiolyze ist auf drei Kern-Workflows für die Befundung optimiert. Wählen Sie den passenden für Ihren Fall:

| Workflow | Geeignet für | Typische Dauer |
|---|---|---|
| [Fast Reporting](fast-report.md) | Einzelne Routinestudie (CXR, Übersichtsaufnahme) | 5–10 Minuten |
| [Komplexer Fall](complex-case.md) | CT/MR mit mehreren Serien und Vorvergleich | 15–30 Minuten |
| [Batch Reporting](batch-reporting.md) | Hochvolumen-Warteschlangen-Abarbeitung | 2–5 Minuten pro Fall |

---

## Gemeinsames Workflow-Muster

Alle drei Workflows folgen demselben Grundmuster:

```
1. Studie wählen      ← Arbeitsliste-Sidebar
2. Bilder prüfen      ← DICOM-Viewer (mittleres Panel)
3. Findings erfassen  ← Findings-Panel (rechts, Sprache oder getippt)
4. KI-Impression      ← KI-Entwurf aus Findings + Bildern
5. QA-Prüfung         ← Automatische Qualitätsprüfungen
6. Freigabe           ← Obligatorische Prüfung und Signatur
```

Das rechte Panel führt mit einem Fortschrittsindikator durch Schritte 3–6.

---

## Welchen Workflow soll ich verwenden?

```
Start
 │
 ├─ Ist es ein Röntgen-Thorax oder eine Übersichtsaufnahme?
 │   └─ JA → Fast Reporting
 │
 ├─ Hat die Studie mehrere Serien oder benötigt Vorvergleich?
 │   └─ JA → Komplexer Fall
 │
 └─ Bearbeite ich mehrere Studien hintereinander aus einer Warteschlange?
     └─ JA → Batch Reporting
```

---

## KI-Unterstützung in allen Workflows

In jedem Workflow steht das KI-Modell (MedGemma) zur Verfügung, um:

- **Bilder zu analysieren** und Findings vorzuschlagen
- **Eine Impression zu entwerfen** aus Ihren dokumentierten Findings
- Mögliche Inkonsistenzen via **QA-Checks** zu markieren

Die KI ist optional — Findings und Impressions können immer manuell geschrieben werden. Alle KI-Outputs erfordern Ihre ausdrückliche Freigabe, bevor der Bericht gespeichert wird.

---

## Tastenkürzel in allen Workflows

| Tastenkürzel | Aktion |
|---|---|
| `Ctrl + M` | Sprachdiktat-Mikrofon ein-/ausschalten |
| `Ctrl + S` | Entwurf speichern |
| `Ctrl + Enter` | Bericht freigeben |
| `?` | Tastenkürzel-Hilfe anzeigen |

Vollständige Referenz: [Tastenkürzel](../doctors/tastenkuerzel.md)

---

## Audit und Compliance

Jeder abgeschlossene Bericht wird im Audit-Trail protokolliert mit:

- Radiologen-Identität und Zeitstempel
- KI-Modell-Version und Konfidenz
- Alle Bearbeitungen zwischen KI-Entwurf und final genehmigtem Text
- QA-Prüf-Ergebnisse

Dies erfüllt EU AI Act Artikel 12 (Logging und Rückverfolgbarkeit) und Artikel 14 (Human Oversight).
