# Risikomanagement (Art. 9)

EU-KI-Verordnung Artikel 9 erfordert ein dokumentiertes, iteratives Risikomanagement-System für den gesamten Lebenszyklus eines Hochrisiko-KI-Systems. Diese Seite beschreibt den Risikomanagement-Rahmen für Radiolyze und stellt die FMEA-Tabellen-Vorlage bereit.

---

## Regulatorische Grundlage

| Regulierung | Anforderung |
|---|---|
| EU-KI-Verordnung Art. 9 | Risikomanagementsystem: Identifikation, Analyse, Schätzung, Bewertung, Minderung |
| ISO 14971:2019 | Internationaler Standard für Risikomanagement bei Medizinprodukten |
| MDR 2017/745 | Post-Market-Surveillance- und Risikoanforderungen für Medizinprodukte |

Radiolyze ist als **Hochrisiko-KI-System** unter EU-KI-Verordnung Anhang III eingestuft (medizinische KI in der klinischen Entscheidungsunterstützung).

---

## Risikoschätzungs-Kriterien

**Schweregrad (S):**

| Stufe | Beschreibung |
|---|---|
| 1 — Vernachlässigbar | Kein Patienteneinfluss; geringfügige Unannehmlichkeit |
| 2 — Gering | Verzögerte Befundung; kein direkter Patientenschaden |
| 3 — Mäßig | Falscher Bericht erreicht Kliniker; könnte Behandlung beeinflussen |
| 4 — Schwerwiegend | Falsche Diagnose wird gehandelt; Patientenschaden möglich |
| 5 — Kritisch | Schwerer Patientenschaden oder Tod |

**Wahrscheinlichkeit (W):**

| Stufe | Beschreibung |
|---|---|
| 1 — Entfernt | < 1 von 10.000 Berichten |
| 2 — Unwahrscheinlich | 1 von 1.000–10.000 Berichten |
| 3 — Gelegentlich | 1 von 100–1.000 Berichten |
| 4 — Wahrscheinlich | 1 von 10–100 Berichten |
| 5 — Häufig | > 1 von 10 Berichten |

**Risiko-Prioritätszahl (RPZ) = S × W**

| RPZ | Erforderliche Maßnahme |
|---|---|
| 1–4 | Akzeptieren; überwachen |
| 5–9 | Mindern oder akzeptieren mit dokumentierter Begründung |
| 10–15 | Mindern; Wirksamkeit verifizieren |
| 16–25 | Nicht akzeptabel; vor Deployment reduzieren |

---

## FMEA-Tabelle

| ID | Fehlerart | Auswirkung | S | Ursache | W | RPZ | Minderung | Rest-S | Rest-W | Rest-RPZ |
|---|---|---|---|---|---|---|---|---|---|---|
| R-01 | KI-Impression enthält falsche Seitenangabe | Radiologe genehmigt falschen Befund | 4 | Modell-Halluzination; Bildausrichtungs-Metadaten-Fehler | 3 | 12 | QA-Warnung bei Seitenangaben; Radiologe muss vor Freigabe prüfen | 4 | 1 | 4 |
| R-02 | KI-Impression übersieht kritischen Befund (z.B. Pneumothorax) | Befund fehlt im signierten Bericht | 5 | Modelleinschränkung; Niedrig-Konfidenz-Befund nicht angezeigt | 2 | 10 | Radiologe prüft Bilder unabhängig; KI-Output ist nur Unterstützung; Warnhinweis in UI | 5 | 1 | 5 |
| R-03 | ASR transkribiert falsches Organ | Falsche Diktat-Transkription im Bericht | 3 | Akustische Ähnlichkeit; Hintergrundgeräusche | 3 | 9 | Radiologe prüft Transkript vor Speichern; bearbeitbares Transkript-Feld | 3 | 2 | 6 |
| R-04 | Falsche Voruntersuchung geladen | Vergleich mit unverwandter Studie | 3 | Worklist-Match nach Name/Geburtsdatum-Mehrdeutigkeit | 2 | 6 | UI zeigt Name + Geburtsdatum + Untersuchungsdatum der Voruntersuchung; Radiologe bestätigt | 3 | 1 | 3 |
| R-05 | Bericht unter falschem Patienten-Datensatz gespeichert | Falscher Patient erhält Bericht | 5 | UI-Verwirrung; Sitzungswechsel | 1 | 5 | Patienten-Banner immer sichtbar; Freigabe-Dialog zeigt Patientendetails | 5 | 1 | 5 |
| R-06 | PHI erscheint in Anwendungs-Logs | Datenpanne; DSGVO-Verletzung | 4 | Entwicklerfehler; Logging-Fehlkonfiguration | 2 | 8 | Log-Sanitisierungsrichtlinie; Kein-PHI-in-Logs-Prüfung; Sicherheits-Audit | 4 | 1 | 4 |
| R-07 | Audit-Log-Lücke (Events fehlen) | Unvollständige Rückverfolgbarkeit; Art.-12-Verletzung | 3 | Datenbankfehler; Worker-Absturz mitten im Job | 2 | 6 | Audit-Writes mit DB-Transaktionen; Worker-Retry bei Fehler; DB-Backup | 3 | 1 | 3 |
| R-08 | Nutzer akzeptiert KI-Entwurf ohne Prüfung | Ungeprüfter Bericht signiert | 5 | Workflow-Druck; Übervertrauen in KI | 3 | 15 | Pflicht-Freigabe-Dialog mit expliziter Bestätigung; Warnung in UI; Schulung | 5 | 2 | 10 |
| R-09 | System während dringender Befundung nicht verfügbar | Verzögerte Diagnose | 3 | Docker-Service-Absturz; Infrastrukturausfall | 2 | 6 | Gesundheits-Check-Monitoring; Runbook-Neustart-Verfahren | 3 | 1 | 3 |
| R-10 | Modell-Update ändert Output-Charakteristika | Unerwarteter Berichtsstil oder Genauigkeitsänderung | 3 | Unkontrollierter Modellversionswechsel | 2 | 6 | Modellversion in ENV fixiert; Version im Audit-Log; gestufter Rollout | 3 | 1 | 3 |

!!! note "Tabelle vervollständigen"
    Die obigen Werte sind Richtwerte für die Referenzimplementierung. Deployende Organisationen müssen eine formale FMEA mit klinischem Input von Radiologen und Risikomanagement-Experten durchführen.

---

## Restrisiko

Nach Anwendung aller Mitigationen ist die höchste verbleibende RPZ **10** (R-08: Nutzer akzeptiert KI-Entwurf ohne Prüfung).

**Akzeptanz-Begründung für R-08:** Eine Rest-RPZ von 10 wird akzeptiert, weil: (1) der Freigabe-Dialog einen expliziten Bestätigungsschritt vorsieht, (2) Radiologen die berufliche Verantwortung für alle signierten Berichte tragen, und (3) das KI-System klar als Unterstützung ausgewiesen ist. Dies entspricht dem ISO-14971-ALARP-Prinzip.

**Nicht akzeptable Restrisiken (RPZ ≥ 16): Keine.**

---

## Mitigationsmaßnahmen

### M-1: Pflicht-Menschliche-Freigabe

Jeder KI-Output muss einen expliziten Freigabe-Dialog durchlaufen. Der Radiologe muss „Freigeben" klicken — es gibt keinen Auto-Signatur-Pfad.

### M-2: QA-Engine

Automatisierte regelbasierte QA-Prüfungen laufen auf jedem Bericht vor der Freigabe. Aktuelle Regeln kennzeichnen: Seitenangaben-Inkonsistenzen, fehlende Pflichtabschnitte, verbleibender Platzhaltertext.

### M-3: Audit-Trail

Alle Inferenz-, Bearbeitungs- und Freigabe-Events werden in `audit_events` mit Modellversion, Input-Hash und Zeitstempel geschrieben.

### M-4: UI-Transparenz

Das KI-Panel zeigt immer: aktuellen Modellnamen und -version, Inferenz-Status, ob die Impression nach Generierung bearbeitet wurde.

### M-5: Log-Sanitisierung

Alle Logging-Aufrufe werden geprüft, um sicherzustellen, dass kein PHI in Anwendungs-Logs geschrieben wird.

---

## Periodische Überprüfung

| Überprüfungsauslöser | Maßnahme |
|---|---|
| Modellversionsänderung | R-02, R-10 neu bewerten; FMEA aktualisieren |
| Neue QA-Regel hinzugefügt oder entfernt | R-01, R-03 neu bewerten |
| Vorfall oder Beinaheunfall | Zu FMEA hinzufügen; RPZ anpassen; zusätzliche Mitigation implementieren |
| Jährliche Überprüfung | Vollständige FMEA-Neubewertung mit klinischem Input |

---

## Verwandte Seiten

- [Compliance-Checkliste](checklist.md)
- [Nachweise-Übersicht](evidence-overview.md)
- [Annex IV Technische Dokumentation](annex-iv.md)
- [Audit Logging](audit-logging.md)
