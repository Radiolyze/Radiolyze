# Leitfaden für Radiologen und Ärzte

Dieser Abschnitt behandelt alles, was Sie für die tägliche radiologische Befundung mit Radiolyze benötigen.
Technische Vorkenntnisse sind nicht erforderlich.

![Radiolyze UI (Screenshot)](../../assets/screenshot-radiolyze.png)

---

## Was Sie mit Radiolyze tun können

- **DICOM-Studien öffnen und navigieren** aus der Arbeitsliste
- **Findings freihändig diktieren** mit Spracherkennung (ASR)
- **KI-Entwurf der Impression prüfen**, der aus den Bildern generiert wird
- **Mit Voruntersuchungen vergleichen** in der Split-View mit synchronem Scrolling
- **Berichtsvorlagen anwenden** für konsistente, strukturierte Befundung
- **Bericht freigeben** mit obligatorischem Prüfschritt

---

## Ihre Rolle im KI-Workflow

!!! info "Sie haben immer die Kontrolle"
    Radiolyze KI generiert ausschließlich **Textentwürfe**. Jedes KI-Output muss von Ihnen geprüft und
    explizit freigegeben werden, bevor der Bericht gespeichert wird. Das System ist als Assistent konzipiert,
    nicht als Ersatz für die ärztliche Beurteilung.

    Wenn Sie mit dem KI-Vorschlag nicht einverstanden sind, bearbeiten oder löschen Sie ihn einfach.

---

## Lernpfad

Wenn Sie neu bei Radiolyze sind, arbeiten Sie diese Themen der Reihe nach durch:

1. **[Fast-Reporting-Workflow](../workflows/fast-report.md)** — der Standard-Workflow für einen Röntgen-Thorax von der Warteschlange bis zur Freigabe in unter 10 Minuten.
2. **[Komplexer-Fall-Workflow](../workflows/complex-case.md)** — CT/MR-Studien mit Prior-Vergleichen und mehreren Serien.
3. **[Batch-Reporting](../workflows/batch-reporting.md)** — effizientes Abarbeiten mehrerer Studien aus einer Warteschlange.

---

## Ihr erster Bericht (Schritt für Schritt)

1. **Studie auswählen** (linke Arbeitsliste).
2. **Bilder prüfen** im Viewer (Frames/Serien scrollen, Fensterungs-Presets nutzen).
3. **Findings erfassen** (tippen oder diktieren, falls ASR aktiv).
4. **(Optional) KI-Impression generieren** und als Entwurf behandeln (prüfen, bearbeiten, freigeben).
5. **QA prüfen** (fehlende Abschnitte / Inkonsistenzen).
6. **Freigeben** zur Finalisierung.

Wenn KI nicht konfiguriert ist (kein GPU-Overlay), können Sie trotzdem normal befunden und freigeben.

---

## Der Befundungsbildschirm auf einen Blick

```
┌───────────────┬──────────────────────────┬─────────────────────┐
│  Linke Sidebar│      DICOM-Viewer         │    Rechtes Panel    │
│               │                          │                     │
│  Arbeitsliste │  Bilder / Serien         │  Findings           │
│  Patient-Info │  Viewer-Tools            │  Impression (KI)    │
│  Vorstudien   │  Fensterungs-Presets     │  QA-Status          │
│               │                          │  Vorlagen           │
└───────────────┴──────────────────────────┴─────────────────────┘
```

**Linke Sidebar** — Studien auswählen, Serien navigieren, Vorstudien zum Vergleich anzeigen.

**DICOM-Viewer** — interaktiver Bild-Viewer mit Zoom, Pan, Fensterung und Messwerkzeugen.

**Rechtes Panel** — der Befundungs-Arbeitsbereich: Findings diktieren, KI-Impression prüfen, QA prüfen, freigeben.

---

## Kurzreferenz: Viewer-Tools

| Aktion | Bedienung |
|---|---|
| Zoomen | Mausrad oder Pinch |
| Verschieben | Klicken und Ziehen |
| Fensterung/Helligkeit | Rechtsklick und Ziehen |
| Fensterungs-Presets | Toolbar-Presets (Lunge, Knochen, Weichteile…) |
| Nächste/Vorherige Serie | Pfeiltasten in der Viewer-Kopfzeile |
| Durch Frames scrollen | Mausrad (zuerst einmal klicken zum Fokussieren) |

---

## Kurzreferenz: Befundungs-Schritte

| Schritt | Was tun |
|---|---|
| 1. Studie wählen | Studie in der linken Arbeitsliste anklicken |
| 2. Bilder prüfen | Serien navigieren, Fensterungs-Presets anwenden |
| 3. Findings diktieren oder tippen | Mikrofon klicken oder in das Findings-Panel tippen |
| 4. KI-Impression anfordern | „Impression generieren" klicken |
| 5. KI-Entwurf prüfen | KI-Vorschlag lesen, bearbeiten oder löschen |
| 6. QA-Check | Warnungen im QA-Panel prüfen |
| 7. Freigeben | „Freigeben" klicken — der Bericht wird finalisiert |

---

## Häufige Fragen

**Die KI hat keine Impression generiert. Was ist passiert?**  
Der KI-Dienst ist möglicherweise nicht konfiguriert (kein GPU-Overlay) — in diesem Fall erscheint eine Mock-Antwort oder Fehlermeldung. Wenden Sie sich an Ihren Administrator. Sie können die Impression immer manuell schreiben.

**Sprachdiktat funktioniert nicht.**  
Prüfen Sie, ob der Browser Mikrofon-Berechtigung hat. Wenn Whisper verwendet wird, fragen Sie Ihren Administrator, ob der Dienst läuft.

**Ich finde meine Studie nicht.**  
Fragen Sie Ihren Administrator, ob die Studie an das Orthanc PACS gesendet wurde. Studien erscheinen in der Arbeitsliste erst nach dem Laden ins System.

---

!!! warning "Nicht für klinischen Einsatz ohne Validierung"
    Radiolyze ist eine Referenzimplementierung. Für den klinischen Betrieb sind Authentifizierung,
    TLS und lokale klinische Validierung erforderlich. Klären Sie dies mit Ihrer IT- und
    Compliance-Abteilung, bevor echte Patientendaten verwendet werden.

---

*Weitere Leitfäden folgen in Phase 2: Tastenkürzel, Fehlerbehebung und KI-spezifische Hinweise.*
