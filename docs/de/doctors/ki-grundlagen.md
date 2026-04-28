# KI in Radiolyze — Was jeder Radiologe wissen sollte

Diese Seite erklärt, wie die KI funktioniert, was sie kann und nicht kann, und wie man sicher mit ihr arbeitet.
Technische Vorkenntnisse sind nicht erforderlich.

---

## Was die KI tut

Radiolyze verwendet ein KI-Modell namens **MedGemma** — ein System, das auf Millionen medizinischer Bilder und Berichte trainiert wurde. Wenn Sie eine KI-Impression anfordern, passiert Folgendes:

1. **Bildanalyse** — ein Ausschnitt der DICOM-Bilder wird in Fotos umgewandelt und an die KI gesendet.
2. **Textgenerierung** — die KI liest Ihre diktierten Findings und die Bilder und verfasst einen Impressionsentwurf in natürlicher Sprache.

Die KI hat **keinen Zugang** zum Krankenhausinformationssystem, zur Patientenanamnese, zu Laborwerten oder klinischen Notizen. Sie sieht nur, was Sie in das Findings-Feld geschrieben haben, und den Bildausschnitt.

---

## Was die KI ausgibt

| Output | Was es ist | Wo es erscheint |
|---|---|---|
| **Impressionsentwurf** | Ein oder mehrere Absätze mit Zusammenfassung der Studienbefunde | Impression-Panel (rechte Spalte) |
| **Konfidenz-Level** | Wie sicher die KI in ihrer Ausgabe ist (Prozentsatz oder Label) | Unterhalb des Impression-Textes |
| **Modell-Version** | Welches KI-Modell den Output generiert hat | Hover über den Konfidenz-Indikator |

---

## Konfidenz-Level verstehen

Der Konfidenz-Indikator spiegelt die eigene Unsicherheitsschätzung der KI wider — **nicht** die klinische Genauigkeit.

| Level | Bedeutung | Was tun |
|---|---|---|
| Hoch (>80%) | KI ist intern konsistent in ihrer Ausgabe | Trotzdem sorgfältig prüfen — hohe Konfidenz bedeutet nicht korrekt |
| Mittel (50–80%) | KI fand die Aufgabe mäßig klar | Mit besonderer Aufmerksamkeit prüfen |
| Niedrig (<50%) | KI war unsicher — Output kann unvollständig sein | Entwurf nur als Ausgangspunkt behandeln; bei Bedarf neu schreiben |

!!! warning "Konfidenz ≠ Korrektheit"
    Die KI kann zu 95% konfident und trotzdem falsch liegen. Der Konfidenz-Score spiegelt die interne Modell-Gewissheit wider, nicht die diagnostische Genauigkeit für Ihren spezifischen Patienten.

---

## Was die KI gut kann

- Routine-Findings für häufige Präsentationen entwerfen (Pneumonie, Erguss, Kardiomegalie, normaler CXR)
- Eine Impression in standardisierter radiologischer Sprache strukturieren
- Messvergleiche vorschlagen, wenn Prior-Studies in den Findings referenziert werden
- Einen grammatikalisch korrekten, lesbaren Berichtsentwurf schnell erstellen

---

## Was die KI nicht kann

| Einschränkung | Warum das wichtig ist |
|---|---|
| **Kein Zugang zur Anamnese** | KI kennt keine Vordiagnosen, Allergien oder klinische Fragestellung |
| **Kein Abgleich mit Laborwerten** | KI kann Bildgebung nicht im Kontext erhöhter Troponin-Werte etc. interpretieren |
| **Begrenzte Performance bei seltenen Befunden** | Ungewöhnliche Pathologien können übersehen oder falsch benannt werden |
| **Kein echtes 3D-Verständnis** | KI erhält flache Bildausschnitte, nicht den vollständigen Volumendatensatz |
| **Sprache standardmäßig Englisch** | Mehrsprachige Ausgabequalität ist reduziert |
| **Populationsbias** | Modell wurde auf spezifischen Datensätzen trainiert; Performance variiert nach Patientendemographie |

---

## KI-Vorschläge sicher verwenden

### Den vollständigen Entwurf immer lesen

Genehmigen Sie niemals eine Impression, die Sie nicht Wort für Wort gelesen haben. KI-Text kann autoritativ klingen, während er falsch ist.

### Befunde mit Bildern vergleichen

Für jeden in der KI-Impression genannten Befund: lokalisieren Sie ihn in den Bildern. Wenn Sie ihn nicht sehen können, entfernen Sie ihn aus der Impression.

### Auf Seitenangaben achten

Links/Rechts-Fehler sind ein bekanntes KI-Versagensmuster. Verifizieren Sie jede genannte Seite.

### Korrigieren, nicht anhängen

Wenn der KI-Entwurf einen Fehler enthält, beheben Sie ihn — fügen Sie keine Korrekturnotiz am Ende hinzu. Der final signierte Bericht muss als Ihre eigene professionelle Aussage lesbar sein.

### Klinischen Kontext ergänzen, den die KI nicht kennt

Fügen Sie Informationen hinzu, die die KI nicht wissen kann: „Im Kontext von neu aufgetretenem Fieber und erhöhtem CRP…", „Im Vergleich zum post-operativen Ausgangsbefund…", „Die klinische Fragestellung war…"

---

## KI-Korrekturen dokumentieren

Wenn Sie einen KI-Vorschlag korrigieren oder ablehnen:

- Einfach das Impression-Feld bearbeiten oder löschen.
- Ihre Änderungen werden automatisch im Audit-Trail protokolliert.
- Keine weitere Aktion erforderlich — der Audit-Trail zeichnet sowohl den KI-Entwurf als auch Ihren final genehmigten Text auf.

Dies unterstützt die Konformität mit EU AI Act Artikel 14 (Human Oversight).

---

## Wer ist für den Bericht verantwortlich?

**Sie.** Der Radiologe, der „Freigeben" klickt, ist für den gesamten Inhalt des signierten Berichts verantwortlich. Die KI ist ein Werkzeug zur Unterstützung beim Entwurf; sie kann keine klinische oder rechtliche Verantwortung tragen.

Dieses Prinzip spiegelt sich im Design von Radiolyze wider:

- Freigabe ist immer manuell und erfordert Ihre ausdrückliche Aktion.
- Der KI-Output ist als Entwurf gekennzeichnet.
- Der Audit-Trail zeichnet Ihre Identität, den Zeitstempel und die KI-Modell-Version auf.

---

## Was tun, wenn KI-Output systematisch falsch ist?

Wenn Sie bemerken, dass die KI bei Ihren Institutionsstudien konsistent denselben Fehlertyp macht:

1. Das Muster dokumentieren (welcher Fehlertyp, bei welcher Modalität/Präsentation).
2. An Ihren Administrator und das Radiolyze-Projekt via [GitHub Issue](https://github.com/radiolyze/radiolyze/issues) melden.
3. In der Zwischenzeit KI-Output für dieses Muster als unzuverlässig behandeln und manuell befunden.

---

## Kurzreferenz

| Situation | Was tun |
|---|---|
| KI-Entwurf sieht korrekt aus | Jeden Satz lesen, dann freigeben |
| KI-Entwurf hat einen Fehler | Den spezifischen Fehler korrigieren, dann freigeben |
| KI-Entwurf ist vollständig falsch | Feld löschen, Impression manuell schreiben |
| KI liefert keine Ausgabe | Mit Administrator klären; manuell befunden |
| Konfidenz ist niedrig | Als Ausgangspunkt behandeln; jeden Befund verifizieren |
| Befund auf Bildern nicht sichtbar | Aus der Impression entfernen |
| Seitenangabe erscheint falsch | Sorgfältig in Bildern verifizieren vor der Übernahme |
