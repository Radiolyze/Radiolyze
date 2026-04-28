# Batch-Reporting-Workflow

**Geeignet für:** Abarbeitung einer hochvolumigen Studien-Warteschlange  
**Typische Dauer:** 2–5 Minuten pro Fall

---

## Wann diesen Workflow verwenden

Batch Reporting verwenden, wenn:

- Sie in einer Sitzung eine Warteschlange mehrerer Studien abarbeiten
- Die meisten Studien Routine-Fälle sind (ähnlicher Typ, begrenzte Komplexität)
- Sie die Zeit zwischen Fällen minimieren möchten
- KI-Entwürfe für Studien in der Warteschlange bereits vorliegen

---

## Zugang zum Batch-Dashboard

Zu `/batch` navigieren (oben auf **Batch** klicken). Das Dashboard zeigt:

- Alle Studien in der Befundungs-Warteschlange mit Status, Priorität und Modalität
- Massenaktionen für die Auswahl mehrerer Studien
- Analytics-Panel mit Durchsatz und Warteschlangenlänge

---

## Schritt für Schritt

### 1. Warteschlange öffnen

Die Warteschlange listet ausstehende Studien. Spalten zeigen:

| Spalte | Bedeutung |
|---|---|
| Priorität | Dringend / Routine |
| Modalität | CXR, CT, MR, US … |
| Patient / Untersuchungsdatum | Identifikation |
| Status | Ausstehend / In Bearbeitung / Abgeschlossen |
| Wartezeit | Wie lange die Studie in der Warteschlange ist |

Nach Priorität oder Wartezeit sortieren, um dringendste Fälle zuerst abzuarbeiten.

---

### 2. Studie öffnen

Studienzeile anklicken. DICOM-Viewer und Befundungs-Panels laden.

Im Batch-Modus versucht das System, vor dem Öffnen eine KI-Impression vorab zu generieren. Falls abgeschlossen, liegt der Impressionsentwurf bereits bereit.

---

### 3. Schnellprüfung

KI-Entwurf effizient prüfen:

1. **Bilder überfliegen** — schnell durch die Serien scrollen; Fensterungs-Presets nutzen.
2. **KI-Impression lesen** — auf offensichtliche Fehler, falsche Seitenangaben oder fehlende Schlüsselbefunde prüfen.
3. **Bei Bedarf korrigieren** — Impressionstext direkt bearbeiten.
4. **QA prüfen** — Warnungen beheben.

Für Routine-Normalstudien kann dieser Schritt unter 2 Minuten dauern.

!!! warning "Tempo reduziert nicht die Verantwortung"
    Auch im Batch-Modus muss jeder Bericht geprüft werden. Keinen Bericht freigeben, den Sie nicht gelesen haben. Der KI-Entwurf kann falsch sein.

---

### 4. Freigeben

`Ctrl + Enter` drücken, Freigabe-Dialog bestätigen. Das System lädt automatisch die **nächste Studie** aus der Warteschlange.

---

### 5. Warteschlange abarbeiten

Studien sequenziell abarbeiten. Das Warteschlangen-Dashboard aktualisiert sich in Echtzeit.

**Tastaturorientierter Workflow:**

| Aktion | Tastenkürzel |
|---|---|
| Mikrofon ein/aus | `Ctrl + M` |
| Entwurf speichern | `Ctrl + S` |
| Freigeben und weiter | `Ctrl + Enter` |

---

## Massenaktionen

Vom Batch-Dashboard (nicht vom Befundungs-Workspace) aus:

- **Mehrere Studien auswählen** — Checkbox links jeder Zeile
- **Massenzuweisung** — Gruppe von Studien einem Radiologen zuweisen
- **Massenpriorisierung** — Priorität für eine Gruppe ändern
- **Warteschlange exportieren** — aktuelle Warteschlange als CSV herunterladen

---

## Tipps für effizientes Batch-Reporting

- **Modalität für Modalität abarbeiten** — CXRs zusammen, dann CT-Serien; Kontextwechsel reduziert Geschwindigkeit
- **KI vorwärmen** — der erste KI-Aufruf nach dem Start ist langsamer; vor der Hauptsitzung eine Studie öffnen
- **`Ctrl + Enter` durchgehend nutzen** — kein Mauswechsel zwischen Fällen nötig
- **QA-Panel sichtbar halten** — Muster in QA-Warnungen über ähnliche Studien erkennen
- **Komplexe Fälle markieren** — wenn ein Fall mehr Zeit benötigt, „Halten"-Aktion verwenden statt Prüfung zu überstürzen

---

## Analytics

Das Batch-Dashboard enthält ein Analytics-Panel:

- Abgeschlossene Berichte pro Stunde/Tag
- Durchschnittliche Zeit pro Fall
- Warteschlangenlängen-Trend
- KI-Entwurf-Akzeptanzrate (Fälle ohne Bearbeitung genehmigt vs. geändert)

Die Akzeptanzrate nutzen, um Falltypen zu identifizieren, bei denen KI-Entwürfe häufiger korrigiert werden müssen.

---

## Verwandte Seiten

- [Fast-Reporting-Workflow](fast-report.md) — für einzelne Fälle
- [Komplexer-Fall-Workflow](complex-case.md) — wenn ein Warteschlangen-Fall sich als komplex herausstellt
- [Tastenkürzel](../doctors/tastenkuerzel.md) — vollständige Tastenkürzel-Referenz
