# Klinischer Befundungs-Workflow

Diese Seite führt Schritt für Schritt durch den vollständigen Befundungs-Workflow — von der Studienauswahl bis zur signierten Freigabe.

---

## Überblick

Eine Standard-Befundungssitzung folgt dieser Reihenfolge:

```
Arbeitsliste → Bilder → Findings → KI-Impression → QA → Freigabe
```

Typische Zeit für einen Routine-Röntgen-Thorax: ca. 5–10 Minuten.

---

## Schritt 1: Studie aus der Arbeitsliste wählen

Die linke Sidebar zeigt die Studienwarteschlange. Jeder Eintrag zeigt:

- Patientenname und -ID
- Modalität (CXR, CT, MR …)
- Untersuchungsdatum
- Prioritätsindikator (dringende Studien sind hervorgehoben)

**Klicken Sie auf eine Studie**, um sie zu laden. Der DICOM-Viewer im mittleren Panel öffnet sich automatisch.

---

## Schritt 2: Bilder prüfen

Sobald die Studie lädt:

1. **Serien navigieren** — die Serienliste in der Sidebar wechselt zwischen Sequenzen (z.B. axial / koronar / sagittal bei CT, PA / lateral bei CXR).
2. **Durch Schichten scrollen** — Mausrad oder Pfeiltasten `↑`/`↓`.
3. **Fensterung anpassen** — Preset in der Toolbar klicken (Lunge, Knochen, Weichteile …) oder rechtsklicken und ziehen.
4. **Messen** — `M` drücken für das Lineal-Werkzeug.
5. **Mit Voruntersuchungen vergleichen** — Prior Studies Panel (unten links) anklicken für Split-View.

---

## Schritt 3: Findings diktieren oder tippen

**Findings-Panel** im rechten Panel öffnen.

### Option A: Sprachdiktat (ASR)

1. **Mikrofon-Schaltfläche** klicken oder `Ctrl + M` drücken.
2. Findings deutlich in normaler Geschwindigkeit sprechen.
3. Transkription erscheint in Echtzeit im Textfeld.
4. Mikrofon erneut klicken oder `Ctrl + M` drücken zum Stoppen.
5. Transkription prüfen und korrigieren.

### Option B: Getippte Eingabe

Direkt in das Findings-Textfeld klicken und tippen.

### Findings-Struktur

Findings nach Organsystem oder anatomischer Region gliedern, z.B.:

```
Lungen: Keine Infiltrate, kein Pleuraerguss.
Herz: Herzsilhouette normal groß.
Mediastinum: Keine Verbreiterung.
Knochen: Keine akute Fraktur.
```

---

## Schritt 4: KI-Impression anfordern

**„Impression generieren"** im Impression-Panel klicken.

Das System sendet Ihren Findings-Text und Bildausschnitte an das KI-Modell. Ein Fortschrittsindikator erscheint während der Verarbeitung (typisch 10–30 Sekunden mit GPU).

Der KI-Entwurf erscheint im Impression-Textfeld.

!!! warning "KI-Output immer prüfen"
    Lesen Sie jeden Satz der KI-Impression vor der Bestätigung. KI kann plausibel klingende, aber falsche Texte generieren. Sie sind für den endgültigen Bericht verantwortlich.

---

## Schritt 5: KI-Entwurf prüfen und bearbeiten

1. **Gesamte Impression lesen** — mit Ihren Findings und den Bildern vergleichen.
2. **Bei Bedarf bearbeiten** — in das Textfeld klicken und beliebige Teile des Entwurfs ändern.
3. **Bei Bedarf löschen** — wenn der Entwurf ungeeignet ist, Feld leeren und Impression manuell schreiben.
4. **Auf Halluzinationen prüfen** — KI kann Findings beschreiben, die nicht auf den Bildern sichtbar sind.

Häufige KI-Fehler, auf die zu achten ist:

| KI-Verhalten | Was prüfen |
|---|---|
| Beschreibt einen Befund, den Sie nicht gesehen haben | Entsprechende Bildregion nochmals prüfen |
| Übersieht einen offensichtlichen Befund | Manuell in die Impression aufnehmen |
| Verwechselt Seitenangaben (links/rechts) | Sorgfältig gegen Bilder verifizieren |
| Überschätzt den Schweregrad | Auf tatsächlichen Bildgebungsbefund anpassen |
| Verwendet nicht-standardisierte Terminologie | In hausinternem Stil umschreiben |

---

## Schritt 6: QA-Panel prüfen

Das **QA-Panel** (rechte Spalte, unterhalb der Impression) führt automatische Prüfungen durch:

| Prüfung | Was getestet wird |
|---|---|
| Findings vorhanden | Mindestens ein Befund dokumentiert |
| Impression vorhanden | Impression-Text nicht leer |
| Seitenangaben konsistent | Links/Rechts-Begriffe in Findings und Impression übereinstimmend |
| Berichtslänge | Impression nicht verdächtig kurz |

**Grün:** Alle Prüfungen bestanden.  
**Gelb:** Warnung — markiertes Element prüfen.  
**Rot:** Blockierendes Problem — vor Freigabe beheben.

---

## Schritt 7: Bericht freigeben

Wenn Sie mit dem Bericht zufrieden sind:

1. **„Freigeben"** klicken — oder `Ctrl + Enter` drücken.
2. Ein Freigabe-Dialog zeigt den finalen Berichtstext.
3. Identität bestätigen (falls Authentifizierung konfiguriert).
4. **„Freigabe bestätigen"** klicken.

Der Bericht wird in der Datenbank gespeichert und im Audit-Trail protokolliert — mit Ihrer Identität, Zeitstempel und der verwendeten KI-Modell-Version.

---

## Workflow-Unterschiede nach Modalität

| Modalität | Besonderheiten |
|---|---|
| **Röntgen-Thorax (CXR)** | Meist eine Serie; PA/lateral-Toggle wenn beide Projektionen geladen |
| **CT (Abdomen, Thorax)** | Axial/Koronar/Sagittal navigieren; Fensterungs-Presets nutzen; Größenvergleich mit Voruntersuchungen |
| **MR** | Mehrere Sequenzen navigieren; FLAIR, DWI, T1, T2 nach klinischer Fragestellung prüfen |
| **Batch-Modus** | Siehe [Batch-Reporting-Workflow](../workflows/batch-reporting.md) |

---

## Tastenkürzel für diesen Workflow

| Aktion | Tastenkürzel |
|---|---|
| Mikrofon ein/aus | `Ctrl + M` |
| Entwurf speichern | `Ctrl + S` |
| Bericht freigeben | `Ctrl + Enter` |
| Ansicht zurücksetzen | `R` |
| Messwerkzeug | `M` |

Vollständige Referenz: [Tastenkürzel](tastenkuerzel.md)
