# Compliance-Checkliste

Mit dieser Checkliste lässt sich die Compliance-Bereitschaft vor dem klinischen Einsatz von Radiolyze verfolgen. Jeder Punkt verweist auf die relevante Dokumentation mit Nachweisvorlagen und Anleitungen.

!!! tip "Verwendung"
    Diese Checkliste gemeinsam mit Compliance-Beauftragtem, Datenschutzbeauftragtem und klinischer Leitung durcharbeiten. Mit ✅ markierte Punkte sind in der Referenzimplementierung umgesetzt. Mit 🔲 markierte Punkte erfordern Betreiber-Maßnahmen vor dem Produktiveinsatz.

---

## EU-KI-Verordnung (Hochrisiko-KI-System)

### Art. 9 — Risikomanagement

- [x] **Risikomanagementplan vorhanden** — siehe [Risikomanagement](risk-management.md)
- [ ] **Formale FMEA mit klinischem Input abgeschlossen** — FMEA-Tabelle in [Risikomanagement](risk-management.md) verwenden; Werte benötigen klinische Validierung  
  *Maßnahme: Radiologieleitung und Risikomanagement-Experten einbeziehen und Freigabe einholen.*
- [x] **Mitigationsmaßnahmen implementiert** — Pflicht-Freigabe-Dialog, QA-Engine, Audit-Trail, UI-Transparenz
- [ ] **Restrisiko formal akzeptiert** — Akzeptanz mit Unterschriften von Ärztlichem Direktor und Compliance-Beauftragtem dokumentieren  
  *Maßnahme: risk-management.md § Restrisiko ausdrucken; Unterschriften einholen.*
- [ ] **Risikoüberprüfungs-Zeitplan festgelegt** — mindestens: bei Modell-Update, bei Vorfall, jährlich  
  *Maßnahme: In Betriebskalender eintragen.*

### Art. 10 — Daten-Governance

- [x] **PHI-Ausschluss aus Anwendungs-Logs implementiert** — Log-Sanitisierungsrichtlinie aktiv (siehe [Security Hardening](../admin/security-hardening.md))
- [x] **Audit-Events verwenden Input-Hashing, nicht rohes PHI** — SHA-256-Hash von Befundtext / Audio (siehe [Audit Logging](audit-logging.md))
- [ ] **DSGVO Art.-30-Verarbeitungsverzeichnis ausgefüllt** — Vorlage in [Datenschutz](datenschutz.md) verwenden  
  *Maßnahme: Organisationsspezifische Felder ausfüllen (Verantwortlicher, DSB, Rechtsgrundlage, Aufbewahrungsfristen).*
- [ ] **Rechtsgrundlage für Verarbeitung von Gesundheitsdaten bestätigt** — Art. 9(2)(h) oder 9(2)(j) je nach Anwendungsfall  
  *Maßnahme: Mit DSB bestätigen und im Art.-30-Verzeichnis dokumentieren.*
- [ ] **DICOM-Anonymisierungsverfahren dokumentiert** — erforderlich wenn Daten für Forschung/Training genutzt werden  
  *Maßnahme: Siehe [Datenschutz § Anonymisierung](datenschutz.md#dicom-anonymisierung).*
- [ ] **Auftragsverarbeitungsverträge abgeschlossen** — für externe Auftragsverarbeiter (Cloud-Backup, Monitoring)  
  *Maßnahme: Rechtliche Prüfung externer Datenverarbeiter.*

### Art. 11 — Technische Dokumentation

- [x] **Annex-IV-Vorlage ausgefüllt** — siehe [Annex IV](annex-iv.md)
- [x] **Architektur dokumentiert** — siehe [Architektur-Übersicht](../architecture/overview.md)
- [x] **Datenfluss dokumentiert** — siehe [Datenfluss](../architecture/data-flow.md)
- [x] **MedGemma-Modellkarte** — siehe [Model Card – MedGemma](model-card-medgemma.md)
- [ ] **Standortspezifische Validierungsergebnisse dokumentiert** — erforderlich vor klinischem Einsatz  
  *Maßnahme: Validierungsstudie mit lokalen Daten durchführen; im [Validierungsleitfaden](../research/validation.md) dokumentieren.*
- [ ] **Offene Punkte aus Annex IV § 15 gelöst** — FMEA, Modellkarten, RBAC, Monitoring  
  *Maßnahme: Annex IV § 15 prüfen; Verantwortliche und Fristen zuweisen.*

### Art. 12 — Automatische Logs (Audit-Trail)

- [x] **Audit-Logger aktiv** — alle 7 Logging-Punkte implementiert (siehe [Audit Logging](audit-logging.md))
- [x] **Audit-Events in PostgreSQL mit Pflichtfeldern gespeichert** — event_type, actor_id, study_id, report_id, timestamp, model_version, input_hash
- [ ] **Audit-Log-Aufbewahrung konfiguriert** — mindestens: Lebensdauer des KI-Systems  
  *Maßnahme: Aufbewahrungsrichtlinie festlegen; Backup konfigurieren (siehe [Backup & Recovery](../admin/backup-recovery.md)).*
- [ ] **Audit-Log-Zugriff eingeschränkt** — nur Admin- und Compliance-Rollen  
  *Maßnahme: RBAC-Konfiguration verifizieren; Nicht-Admin-Zugriff auf `/api/v1/audit` blockiert.*
- [ ] **Audit-Export getestet** — `curl /api/v1/audit?export=json` gibt vollständige Datensätze zurück  
  *Maßnahme: Siehe [Nachweise-Übersicht § Art. 12](evidence-overview.md) für Export-Befehle.*

### Art. 13 — Transparenz

- [x] **KI-Status in UI angezeigt** — Modellname, -version und Inferenz-Status im Befundungs-Workspace sichtbar
- [x] **KI-Haftungsausschluss für Nutzer angezeigt** — Warnhinweis-Admonition in Befundungs-UI
- [x] **Benutzer-Dokumentation erklärt KI-Fähigkeiten und -Einschränkungen** — siehe [KI-Leitfaden](../doctors/ki-grundlagen.md)
- [ ] **Patienten-seitiger Transparenzhinweis** — erforderlich wenn Patienten direkt mit dem System interagieren  
  *Maßnahme: Mit Rechtsabteilung klären ob Patienten-seitiger Hinweis erforderlich.*

### Art. 14 — Menschliche Aufsicht

- [x] **Jeder Bericht erfordert explizite Radiologen-Freigabe** — Freigabe-Dialog implementiert; kein Auto-Signatur-Pfad
- [x] **Alle KI-Outputs sind bearbeitbar** — Impressionstext-Feld vollständig bearbeitbar vor und nach KI-Generierung
- [x] **Fallback bei KI-Ausfall** — System bleibt nutzbar wenn KI-Inferenz scheitert (manuelle Diktat-/Tipp-Eingabe möglich)
- [x] **QA-Prüfung vor Freigabe** — automatisierte QA-Engine läuft; Warnungen werden dem Radiologen angezeigt
- [ ] **Personal zu Menschliche-Aufsicht-Anforderungen geschult** — Radiologen müssen verstehen, dass sie für jeden signierten Bericht verantwortlich sind  
  *Maßnahme: In Einarbeitung einbeziehen; [KI-Leitfaden § Verantwortung](../doctors/ki-grundlagen.md) referenzieren.*

### Art. 15 — Robustheit & Cybersicherheit

- [ ] **TLS für alle Endpunkte aktiviert** — erforderlich für Produktion  
  *Maßnahme: Siehe [Security Hardening § TLS](../admin/security-hardening.md).*
- [ ] **Standard-Anmeldedaten geändert** — Orthanc, PostgreSQL, JWT-Secret  
  *Maßnahme: Siehe [Security Hardening § Standard-Anmeldedaten ändern](../admin/security-hardening.md).*
- [x] **Rate Limiting konfiguriert** — Upload- und Inferenz-Endpunkte rate-limitiert
- [x] **Netzwerksegmentierung** — DB/Redis/Orthanc nicht über Docker-Netzwerk hinaus exponiert
- [ ] **Penetrationstest abgeschlossen** — empfohlen vor Produktiveinsatz  
  *Maßnahme: Qualifizierten Sicherheitsdienstleister beauftragen.*
- [ ] **Abhängigkeits-Schwachstellen-Scan durchgeführt** — `pip-audit` + `npm audit`  
  *Maßnahme: Siehe [Nachweise-Übersicht § Art. 15](evidence-overview.md) für Befehle.*
- [ ] **Security-Hardening-Checkliste abgeschlossen** — siehe [Security Hardening](../admin/security-hardening.md)

### Art. 72 — Post-Market-Monitoring

- [x] **Drift-Monitoring-Endpunkt aktiv** — `/api/v1/monitoring/drift` gibt QA-Akzeptanzrate und Metriken zurück
- [ ] **Monitoring-Dashboard konfiguriert** — Alarme bei QA-Ausfallrate, Inferenz-Fehlerrate  
  *Maßnahme: Siehe [Observability](../operations/observability.md); Alarm-Schwellwerte setzen.*
- [ ] **Incident-Response-Verfahren etabliert** — formaler Prozess für KI-Fehler oder Sicherheitsereignisse  
  *Maßnahme: [Runbook § Incident Response](../operations/runbook.md) für Ihre Organisation anpassen.*
- [ ] **Post-Market-Monitoring-Zeitplan festgelegt** — mindestens: vierteljährliche Überprüfung der Drift-Metriken; jährliche Vollüberprüfung  
  *Maßnahme: In Betriebskalender eintragen.*

---

## Security Baselines

- [ ] **TLS für alle Endpunkte** — siehe [Security Hardening](../admin/security-hardening.md)
- [ ] **Starke Authentifizierung konfiguriert** — JWT-Secret ≥ 32 Bytes; Sitzungsablauf gesetzt
- [ ] **RBAC-Rollen definiert und zugewiesen** — Radiologe, QA, Admin-Rollen
- [ ] **Rate Limiting aktiv und getestet**
- [x] **Keine PHI in Anwendungs-Logs** — Richtlinie durchgesetzt; mit Log-Überprüfung verifizieren
- [x] **Security-Hardening-Dokumentation vollständig** — siehe [Security Hardening](../admin/security-hardening.md)
- [ ] **Backup-Verfahren getestet** — Wiederherstellung aus Backup auf Testinstanz verifiziert  
  *Maßnahme: Siehe [Backup & Recovery](../admin/backup-recovery.md) § Verifizierungsplan.*
- [ ] **Zugriff auf Backup-Dateien eingeschränkt** — Backup-Verzeichnis nur für root / Backup-Service-Account

---

## Mindestanforderungen vor Inbetriebnahme

Diese Punkte **müssen** vor dem ersten klinischen Einsatz vollständig sein:

1. ✅ Freigabe-Dialog aktiv (menschliche Aufsicht)
2. 🔲 Standard-Anmeldedaten geändert (Orthanc, PostgreSQL, JWT)
3. 🔲 TLS aktiviert
4. 🔲 Audit-Log-Aufbewahrung konfiguriert und getestet
5. 🔲 DSGVO Art.-30-Verzeichnis ausgefüllt
6. 🔲 Rechtsgrundlage für Gesundheitsdaten-Verarbeitung bestätigt
7. 🔲 Radiologisches Personal zu KI-Verantwortlichkeiten geschult
8. 🔲 Backup-Verfahren verifiziert

---

## Verwandte Seiten

- [Nachweise-Übersicht](evidence-overview.md) — alle Artefakte mit Export-Befehlen
- [Risikomanagement](risk-management.md) — FMEA und Mitigationsmaßnahmen
- [Datenschutz](datenschutz.md) — DSGVO-Compliance
- [Annex IV](annex-iv.md) — vollständige Technische Dokumentationsvorlage
- [Audit Logging](audit-logging.md) — Audit-Event-Schema und Export
- [Security Hardening](../admin/security-hardening.md) — Produktions-Sicherheitsschritte
