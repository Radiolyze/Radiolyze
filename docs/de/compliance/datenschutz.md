# Datenschutz & Privatsphäre (DSGVO / Art. 10)

Diese Seite dokumentiert den Umgang von Radiolyze mit personenbezogenen Daten gemäß DSGVO und EU-KI-Verordnung Artikel 10 (Daten-Governance-Anforderungen für Hochrisiko-KI-Systeme).

---

## Regulatorische Grundlage

| Regulierung | Anforderung |
|---|---|
| DSGVO Art. 5 | Datensparsamkeit, Zweckbindung, Speicherbegrenzung |
| DSGVO Art. 9 | Besondere Kategorien (Gesundheitsdaten) — explizite Rechtsgrundlage erforderlich |
| DSGVO Art. 30 | Verzeichnis der Verarbeitungstätigkeiten (Verantwortlichen-Pflicht) |
| DSGVO Art. 32 | Technische und organisatorische Maßnahmen (TOMs) |
| EU-KI-Verordnung Art. 10 | Daten-Governance für Trainings-, Validierungs- und Testdaten |

!!! warning "Betreiber-Verantwortung"
    Radiolyze ist ein Software-System. Die deployende Gesundheitsorganisation ist der **Verantwortliche** gemäß DSGVO. Dieses Dokument beschreibt die eingebauten Datenschutzkontrollen; der Betreiber muss die organisationsspezifischen Abschnitte (Rechtsgrundlage, DSB-Kontakt, Art.-30-Einträge) vor Inbetriebnahme vervollständigen.

---

## Kategorien verarbeiteter personenbezogener Daten

| Datenkategorie | DSGVO-Klassifikation | Wo verarbeitet | Aufbewahrung |
|---|---|---|---|
| DICOM-Bilddaten (radiologische Aufnahmen) | Besondere Kategorie (Gesundheit) Art. 9 | Orthanc PACS | Gemäß klinischer Richtlinie |
| Patientendemografie (Name, Geburtsdatum, Patienten-ID) | Personenbezogene + Gesundheitsdaten | Orthanc + Berichts-DB | Gemäß klinischer Richtlinie |
| Radiologische Berichte (Befunde, Impression) | Besondere Kategorie (Gesundheit) Art. 9 | PostgreSQL | Gemäß klinischer Richtlinie |
| Audit-Event-Metadaten | Personenbezogene Daten (actor_id) | PostgreSQL | ≥ Lebensdauer des KI-Systems (Art. 12) |
| ASR-Audio-Eingaben | Potenziell personenbezogen | Nur RAM — nicht gespeichert | Nicht gespeichert |
| Anwendungs-Logs | Pseudonymisiert (Kein-PHI-Richtlinie) | Docker-Logs | Gemäß Log-Aufbewahrungsrichtlinie |

---

## Rechtsgrundlage für die Verarbeitung

Gemäß DSGVO Art. 9(2) erfordert die Verarbeitung besonderer Gesundheitsdaten eine der folgenden Grundlagen:

- **Art. 9(2)(h)**: Verarbeitung für medizinische Diagnose, Behandlung oder Gesundheitsversorgung durch oder unter Verantwortung eines der Schweigepflicht unterliegenden Fachmanns
- **Art. 9(2)(j)**: Verarbeitung für wissenschaftliche Forschung (für Forschungsnutzung)

Die deployende Organisation muss die zutreffende Rechtsgrundlage im Art.-30-Verzeichnis dokumentieren.

---

## DSGVO Art. 30 — Verarbeitungsverzeichnis (Vorlage)

Diese Tabelle für Ihre Organisation ausfüllen:

| Feld | Wert |
|---|---|
| Verantwortlicher | *(Organisationsname)* |
| Kontakt Verantwortlicher | *(Name, Adresse, E-Mail)* |
| DSB-Kontakt | *(Name, E-Mail — falls DSB erforderlich)* |
| Verarbeitungszweck | KI-gestützte radiologische Befundung; klinische Workflow-Unterstützung |
| Rechtsgrundlage | Art. 9(2)(h) — Gesundheitsversorgung *(mit DSB bestätigen)* |
| Betroffene Personen | Patienten, deren radiologische Studien mit Radiolyze befundet werden |
| Datenkategorien | Radiologische Bilder; Berichte; Patientendemografie; Audit-Logs |
| Empfänger | Radiologen, QA-Personal, IT-Admins (intern); keine externe Datenübertragung |
| Drittlandübertragungen | Keine — On-Premises-Deployment; kein Cloud-Egress |
| Aufbewahrung | Klinische Daten: gemäß nationalem Krankenaktengesetz; Audit-Logs: gemäß Art. 12 |
| TOMs | Siehe Technische und Organisatorische Maßnahmen unten |

---

## Technische und Organisatorische Maßnahmen (TOMs)

### Technische Maßnahmen

| Maßnahme | Implementierung |
|---|---|
| Verschlüsselung bei Übertragung | TLS 1.2+ für alle HTTP-Endpunkte (NGINX Reverse Proxy) |
| Verschlüsselung im Ruhezustand | Durch Host-OS / Speicherschicht (Betreiber-Verantwortung) |
| Authentifizierung | JWT-basierte Sitzungsauth; Passwortstärke-Anforderungen |
| Autorisierung | RBAC — Radiologe, QA, Admin-Rollen; Least-Privilege-Prinzip |
| PHI-Ausschluss aus Logs | Keine Patientennamen, Geburtsdaten oder rohe Studiendaten in Logs |
| Audit-Trail | Unveränderliches Audit-Event-Log in PostgreSQL mit Input-Hashes |
| Netzwerksegmentierung | DB, Redis, Orthanc nicht über Docker-internem Netzwerk hinaus exponiert |
| Rate Limiting | Upload- und Inferenz-Endpunkte rate-limitiert |

### Organisatorische Maßnahmen

| Maßnahme | Erforderliche Betreiber-Aktion |
|---|---|
| Datenschutzbeauftragter | DSB bestellen wenn erforderlich; Kontakt registrieren |
| Mitarbeiterschulung | Personal zu PHI-Handling und Radiolyze-Datenschutzkontrollen schulen |
| Zugangskontroll-Überprüfung | Periodische Überprüfung von Benutzerkonten und Rollenzuweisungen |
| Incident Response | DSGVO-Datenpanne-Meldeverfahren pflegen (72-Stunden-Meldung) |
| Auftragsverarbeitungsvertrag | AV-Vertrag mit Auftragsverarbeitern abschließen (Cloud-Backup, Monitoring) |
| Backup-Verschlüsselung | Alle Backups at-rest verschlüsseln; Zugang zu Backup-Medien kontrollieren |

---

## PHI-Handhabung in Radiolyze

### Was Radiolyze NICHT speichert

- Rohe Audio-Aufnahmen aus ASR-Diktat (Im-Speicher-Verarbeitung; nur Audio-Hash im Audit-Log)
- Patienten-identifizierbare Daten in Anwendungs-Logs
- Patientendaten außerhalb der konfigurierten Orthanc- und PostgreSQL-Volumes

### Was Radiolyze speichert

- DICOM-Dateien in Orthanc (Standard-DICOM — enthält Patientendemografie in Tags)
- Radiologische Berichte in PostgreSQL (enthält Befundtext; mit Patient über study_id verknüpft)
- Audit-Events in PostgreSQL (actor_id + study_id + input_hash; kein roher Befundtext)

### Input-Hashing

Audit-Events speichern SHA-256-Hashes von KI-Inputs anstatt der Rohdaten — Rückverfolgbarkeit ohne PHI-Duplikation.

---

## DICOM-Anonymisierung

Für Forschungsnutzung, Trainingsdaten-Vorbereitung oder Export an Dritte müssen DICOM-Dateien vor Verlassen der klinischen Umgebung anonymisiert werden.

Empfohlene Werkzeuge:

| Werkzeug | Anwendungsfall |
|---|---|
| [Orthanc-Anonymisierung](https://book.orthanc-server.com/users/anonymization.html) | Anonymisierung via Orthanc REST API |
| `pydicom` + DICOM PS3.15 Anhang E | Skript-basierte Batch-Anonymisierung |
| CTP (Clinical Trials Processor) | Krankenhaus-grade DICOM-De-Identifizierung |

---

## Betroffenenrechte

| Recht | Mechanismus in Radiolyze |
|---|---|
| Auskunft | Radiologische Berichte via Standard-HIS/RIS; Audit-Logs via Admin-API |
| Berichtigung | Berichtskorrektur via Bearbeitungs-Workflow |
| Löschung | DICOM aus Orthanc löschen + Bericht aus DB löschen + Audit-Events bereinigen — erfordert Admin-Verfahren |
| Portabilität | DICOM-Export aus Orthanc; Berichts-Export via API |

!!! danger "Löschungsverfahren"
    Das Löschen von Patientendaten für Löschungsanträge muss mit der Rechts- und Klinikdokumentation-Abteilung koordiniert werden. Es können widersprechende Pflichten bestehen (Krankenakten-Aufbewahrungsgesetze).

---

## Datenpanne-Meldung

Relevante Szenarien für Radiolyze:

- PHI in Anwendungs-Logs gefunden (Log-Aggregator sofort prüfen)
- Unbefugter Zugriff auf PostgreSQL oder Orthanc
- Backup-Medien verloren oder gestohlen
- Ransomware auf dem Radiolyze-Server

In jedem Szenario: betroffene Systeme isolieren, Audit-Logs sichern, DSB sofort benachrichtigen.

---

## Verwandte Seiten

- [Security Hardening](../admin/security-hardening.md)
- [Audit Logging](audit-logging.md)
- [Risikomanagement](risk-management.md)
- [Nachweise-Übersicht](evidence-overview.md)
