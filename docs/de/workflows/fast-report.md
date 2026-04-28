# Fast-Reporting-Workflow

**Geeignet für:** Routine-Einzelserien-Studien (Röntgen-Thorax, Übersichtsaufnahmen)  
**Typische Dauer:** 5–10 Minuten von der Arbeitsliste bis zum signierten Bericht

---

## Wann diesen Workflow verwenden

Fast Reporting verwenden, wenn:

- Die Studie eine oder zwei Bildserien hat (z.B. PA + lateral bei CXR)
- Kein systematischer Vorvergleich benötigt wird
- Die klinische Fragestellung unkompliziert ist
- Sie eine Arbeitsliste ähnlicher Fälle abarbeiten

Für CT/MR-Studien mit mehreren Serien oder erforderlichem Vorvergleich → [Komplexer-Fall-Workflow](complex-case.md).

---

## Schritt für Schritt

### 1. Aus der Arbeitsliste wählen

Studie in der linken Sidebar-Arbeitsliste anklicken. Der Viewer lädt die Studie automatisch.

**Prüfen:**
- Richtiger Patientenname und Untersuchungsdatum im Viewer-Header sichtbar
- Bildqualität akzeptabel

---

### 2. Bild systematisch prüfen

Vor dem Diktieren systematisch prüfen:

1. **Orientierung** — PA vs. AP, Lateralaufnahme korrekt beschriftet
2. **Technische Qualität** — Rotation, Inspiration, Belichtung
3. **Lungenfelder** — beide sichtbar; Infiltrat, Erguss, Pneumothorax prüfen
4. **Herz** — Herzsilhouette, Mediastinumbreite
5. **Knochen** — Rippen, Klavikel, sichtbare Wirbelkörper
6. **Weichteile und Sonden** — sichtbare Leitungen oder Sonden

Fensterungs-Presets verwenden:

| Preset | Anwendung |
|---|---|
| Thorax / Lunge | Lungenparenchym-Beurteilung |
| Knochen | Rippen- oder Klavikelbruch |
| Weichteile | Mediastinum, Pleura |

---

### 3. Findings diktieren

**Mikrofon-Schaltfläche** klicken oder `Ctrl + M` drücken.

Findings nach anatomischer Region sprechen:

> *„Lungen: Keine Infiltrate. Kein Pleuraerguss. Kein Pneumothorax. Herz: Normal groß. Mediastinum: Keine Verbreiterung. Knochen: Keine akute Fraktur erkennbar. Weichteile: Unauffällig."*

Diktat mit `Ctrl + M` stoppen. Transkription prüfen und korrigieren.

!!! tip "Tipps für bessere ASR-Genauigkeit"
    - In normalem Tempo sprechen — nicht zu schnell
    - Ausgeschriebene Wörter statt Abkürzungen verwenden
    - Abschnittsweise diktieren mit kurzer Pause zwischen Regionen
    - Fehler sofort korrigieren

---

### 4. KI-Impression generieren

**„Impression generieren"** im Impression-Panel klicken.

10–30 Sekunden warten. Der KI-Entwurf erscheint im Impression-Textfeld.

---

### 5. KI-Entwurf prüfen

Impression sorgfältig lesen:

- Stimmt sie mit Ihrem Diktat und den Bildern überein?
- Sind Befunde korrekt seitig (links/rechts)?
- Wurden Befunde hinzugefügt, die Sie nicht gesehen haben?
- Ist der Schweregrad korrekt charakterisiert?

Bei Bedarf bearbeiten. Häufige Korrekturen:

| Problem | Maßnahme |
|---|---|
| Falsche Seitenangabe | Direkt im Text korrigieren |
| KI hat nicht gesehenen Befund hinzugefügt | Löschen |
| Schweregrad überschätzt | Formulierung anpassen |
| Fehlender klinischer Kontext | Manuell ergänzen |
| Nicht-standardisierte Terminologie | Im Hausstil umschreiben |

---

### 6. QA prüfen

QA-Panel (rechte Spalte, unterhalb der Impression) auf Warnungen prüfen. Rote Warnungen vor der Freigabe beheben.

---

### 7. Bericht freigeben

**„Freigeben"** klicken oder `Ctrl + Enter` drücken. Im Freigabe-Dialog den finalen Bericht prüfen und bestätigen.

---

## Tipps für Geschwindigkeit

- **Sprachdiktat verwenden** — nach einigen Sitzungen schneller als Tippen
- **Fensterungs-Presets** — `P`, `M`, `Z` statt Toolbar-Klicks
- **Tastenkürzel für Freigabe** — `Ctrl + Enter` spart Mausklick
- **Ähnliche Fälle bündeln** — CXRs nach CXRs; KI bleibt zwischen Aufrufen „warm"

---

## Bei Problemen

| Problem | Lösung |
|---|---|
| ASR startet nicht | Mikrofon-Berechtigung prüfen; siehe [Fehlerbehebung](../doctors/troubleshooting.md) |
| KI liefert keinen Output | Impression manuell schreiben; Administrator informieren |
| Bericht wird nicht gespeichert | Netzwerk prüfen; `Ctrl + S` für Entwurf-Speichern |
| Bild lädt nicht | Seite neu laden; bei Persistenz Administrator kontaktieren |
