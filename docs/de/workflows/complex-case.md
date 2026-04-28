# Workflow Komplexer Fall

**Geeignet für:** CT- und MR-Studien mit mehreren Serien, Läsionsmessung und Vorvergleich  
**Typische Dauer:** 15–30 Minuten je nach Studienkomplexität

---

## Wann diesen Workflow verwenden

Wenn:

- Die Studie mehrere Serien hat (axial, koronar, sagittal)
- Vorvergleich erforderlich ist (Onkologie-Verlauf, post-therapeutische Beurteilung)
- Läsionsmessung oder Verlaufsdokumentation erforderlich ist
- Klinische Leitlinien referenziert werden sollen (RECIST, RADS-Kriterien)

---

## Schritt für Schritt

### 1. Studie wählen

Studie in der Arbeitsliste anklicken. Bei CT-Studien lädt typischerweise die axiale Serie zuerst.

**Vor dem Start bestätigen:**
- Richtiger Patient und Untersuchungsdatum
- Erwartete Modalität und Körperregion geladen
- Alle angeforderten Serien verfügbar

---

### 2. Serien navigieren

Serienliste in der linken Sidebar öffnen:

| Typische CT-Serien | Zweck |
|---|---|
| Axial | Primäre diagnostische Ansicht |
| Koronar | Organbeziehungen, Zwerchfell, Gefäße |
| Sagittal | Wirbelsäule, Retroperitoneum |
| Axial + Kontrastmittel | Phasenspezifisches Enhancement |
| MPR (automatisch generiert) | Reformatierte Rekonstruktionen |

**Fensterungs-Presets je nach Region verwenden:**

| Region | Preset |
|---|---|
| Thorax CT — Lungenparenchym | Lunge |
| Thorax CT — Mediastinum | Weichteile |
| Abdomen | Abdomen |
| Knochen | Knochen |
| Gehirn | Hirn |

---

### 3. MPR-Ansicht aktivieren (falls verfügbar)

Für volumetrische CT oder MR: **MPR-Schaltfläche** in der Viewer-Toolbar klicken.

- Drei Panels erscheinen: Axial · Sagittal · Koronar
- Fadenkreuz in einem Panel bewegen aktualisiert die anderen
- `1`, `2` oder `3` für einzelne Ebene maximieren; `Esc` für Drei-Panel-Ansicht
- MIP (Maximum-Intensitäts-Projektion) mit `M` für Gefäßstudien

---

### 4. Läsionen messen

`M` drücken für Messwerkzeug. Messlinie über die Läsion in der axialen Ebene ziehen.

Für RECIST-Messungen:
- **Längsten Durchmesser** der Läsion messen
- **Senkrechten Durchmesser** in derselben Ebene messen
- Maße in den Findings diktieren

---

### 5. Voruntersuchungen zum Vergleich laden

Im **Prior-Studies-Panel** (unten links) erscheinen frühere Studien desselben Patienten automatisch.

Voruntersuchung anklicken → **Split-View**:
- Aktuelle Studie links, Voruntersuchung rechts
- Synchrones Scrollen (ein-/ausschaltbar)

**Messungen vergleichen:**
1. Messwerkzeug (`M`) in der aktuellen Studie aktivieren
2. Aktuelle Läsionsgröße messen
3. In der Voruntersuchung dieselbe Läsion messen
4. Veränderung in den Findings diktieren

---

### 6. Findings nach System / Region diktieren

Findings-Panel öffnen und systematisch diktieren. Für Thorax-CT:

> *„Lungen: 1,2 cm Rundherd im rechten Unterlappen (Serie 3, Bild 45), zuvor 0,9 cm am 15.03.2025, entsprechend einer Größenzunahme von 3 mm (33%). Keine neuen Rundherde. Keine Infiltrate. Bilateraler Pleuraerguss, rechts mehr als links, geringes Ausmaß. Herz und Perikard: Herzgröße normal. Mediastinum: Keine Lymphknotenvergrößerung. Knochen: Keine lytischen oder sklerotischen Läsionen."*

Findings sollten enthalten:
- Befund mit Lokalisation, Größe und Dichte-/Signalcharakteristik
- Vergleichswerte wenn Voruntersuchung vorhanden
- Unauffällige Befunde explizit benennen

---

### 7. KI-Impression anfordern

**„Impression generieren"** klicken. Bei komplexen Fällen ist der KI-Entwurf ein Ausgangspunkt.

**Entwurf immer bearbeiten um:**
- Primärdiagnose zu bestätigen oder korrigieren
- Klinischen Kontext hinzuzufügen
- Empfehlungen im Hausstil zu formulieren

---

### 8. Leitlinien prüfen (falls konfiguriert)

Das Leitlinien-Panel (rechte Spalte) zeigt anwendbare Kriterien:
- RECIST 1.1 für Tumorgrößenmessung
- Fleischner Society für Lungenrundherde
- TIRADS, PIRADS, BIRADS für organspezifisches strukturiertes Reporting

Leitlinien sind nur informativ — sie verändern den Bericht nicht automatisch.

---

### 9. QA-Prüfung

Das QA-Panel prüft spezifisch für komplexe Berichte:
- Messungen vorhanden wenn Läsion/Rundherd erwähnt
- Vergleichssprache vorhanden wenn Voruntersuchung geladen
- Impression stimmt mit Befundzahl überein

Warnungen vor der Freigabe beheben.

---

### 10. Freigabe

**„Freigeben"** klicken oder `Ctrl + Enter`. Vollständigen Bericht im Freigabe-Dialog prüfen, dann bestätigen.

---

## Tipps für komplexe Fälle

- **Systematisch navigieren** — modalitätsspezifische Checkliste im Kopf vor dem Diktieren
- **Zuerst messen, dann diktieren** — alle Messungen abschließen, bevor diktiert wird
- **Voruntersuchung vor dem Diktieren laden** — Vergleichssprache in den Findings hilft der KI bei der Impression
- **Für Läsions-Charakterisierung MPR verwenden** — eine nur axial gemessene Läsion hat möglicherweise einen anderen tatsächlichen Längsdurchmesser koronar oder sagittal

---

## Modalitätsspezifische Hinweise

### CT Thorax
- Lungen- und Mediastinum-Fensterung beide verwenden
- Pulmonalarterien-Beurteilung: CTPA-Preset aktivieren falls vorhanden

### CT Abdomen/Becken
- Systematisch: Leber → Gallenwege → Pankreas → Milz → Nieren → Nebennieren → Gefäße → Retroperitoneum → Darm → Becken → Knochen
- Kontrastmittelphase für jede Serie notieren

### MR Gehirn
- DWI (akuter Schlaganfall), FLAIR (Marklager, Kortex), T1 (Anatomie, Enhancement), T2 (Ödem) prüfen
- Seitenangabe und Hemisphäre für jeden Befund notieren
