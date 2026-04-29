# Radiolyze – Dokumentationsverbesserungsplan

> **Status:** Entwurf · Stand: 2026-04-28  
> **Branch:** `claude/improve-documentation-GOxjY`

---

## 1. Ausgangslage und Problembeschreibung

Die bestehende Dokumentation (119 Markdown-Dateien, EN + DE) ist **technisch-domänenorientiert** strukturiert:
Architektur → Komponenten → API → Workflows → Compliance → Operations → Development.

Diese Gliederung ist für Entwickler intuitiv, lässt aber alle anderen Nutzergruppen im Stich:

| Problem | Auswirkung |
|---|---|
| Kein rollenbasierter Einstieg | Arzt, Admin, Compliance-Beauftragter müssen selbst raten, welche Seite relevant ist |
| Inhalte viel zu knapp | FAQ: 4 Fragen · Runbook: 31 Zeilen · Workflow-Overview: 9 Zeilen |
| Klinische Sprache fehlt | Workflows beschreiben UI-Komponenten statt klinische Schritte |
| Compliance-Lücken undokumentiert | Checkliste zeigt offene Haken, gibt aber keine Anleitungen zum Schließen |
| Kein Onboarding für Neueinsteiger | README setzt Docker- und Python-Kenntnisse voraus |
| KI-Grenzen und -Risiken fehlen | Keine Seite erklärt, was MedGemma kann/nicht kann |
| Sprach-Inkonsistenz | `docs/index.md` ist Deutsch, mkdocs.yml deklariert EN als Default |

---

## 2. Nutzergruppen (Personas)

### P1 – Radiologin / Arzt

**Kontext:** Klinischer Alltag, wenig Zeit, kein IT-Hintergrund.  
**Ziel:** Studien effizient befunden, KI-Vorschläge prüfen und freigeben.  
**Sprache:** Klinisch, präzise, handlungsorientiert.

**Was fehlt:**
- Schritt-für-Schritt-Anleitung auf Klinikebene (nicht UI-Komponentenebene)
- Erklärung: Was kann die KI, was kann sie nicht?
- Umgang mit abweichenden KI-Vorschlägen
- Tastenkürzel-Referenz
- Fehlerbehebung: „ASR erkennt mich nicht", „KI liefert kein Ergebnis"

---

### P2 – Neueinsteiger (erstmaliger Kontakt mit dem Projekt)

**Kontext:** Studierender, Praktikant, technisch interessierter Arzt, Open-Source-Neugieriger.  
**Ziel:** Verstehen, was Radiolyze ist, und es lokal ausprobieren.

**Was fehlt:**
- Plain-Language-Erklärung in 2–3 Sätzen, was das Projekt macht
- Visueller Überblick / Screenshots
- „In 5 Minuten loslegen"-Anleitung (mit Demo-Daten, die bereits enthalten sind)
- Klare Unterscheidung: Was ist Demo, was ist Produktion?

---

### P3 – Forscher / KI-Spezialist

**Kontext:** Evaluiert MedGemma, will das Modell ersetzen oder benchmarken.  
**Ziel:** Modelldetails, Grenzen, Datenfluss, Erweiterbarkeit verstehen.

**Was fehlt:**
- Researcher-seitige Zusammenfassung der Model Card (klinische Limits, bekannte Fehler)
- Anleitung zum Austausch des Inferenz-Backends
- Datenfluss für Datenschutz-/Privacy-Analyse
- Hinweise zu Benchmarking und Validierung
- Beitrag zu KI-Verbesserungen (Prompt-Engineering, Modellwechsel)

---

### P4 – IT-Administrator / DevOps

**Kontext:** Installiert, wartet und überwacht das System im Krankenhaus.  
**Ziel:** Stabiler, sicherer Betrieb; klare Verfahren für Backup, Update, Incident.

**Was fehlt:**
- Vollständige Deployment-Anleitung (inkl. Voraussetzungen, DNS, TLS, Firewall)
- Schritt-für-Schritt GPU-Setup mit Fehlerdiagnose
- Backup- und Restore-Verfahren (PostgreSQL, Orthanc, Audit-Logs)
- Update/Upgrade-Verfahren
- Monitoring-Setup (Prometheus, Grafana, Alerting)
- DICOM-Konfiguration (Orthanc-Routing, DICOMweb, C-STORE)
- Checkliste: „Bereit für Produktion?" (Security-Hardening)
- Incident-Response-Verfahren (detailliert, nicht nur 5-Punkte-Liste)

---

### P5 – Entwickler / Contributor

**Kontext:** Will Code beitragen, Bugs fixen, neue Features bauen.  
**Ziel:** Schnell produktiv werden, Konventionen verstehen, sicher contributen.

**Was besser sein könnte:**
- Contributing-Guide inhaltlich ausgebaut (PR-Prozess, Issue-Labels, Review-Kriterien)
- Komponentenarchitektur tiefer erklärt (State-Flow, Hook-Muster)
- Anleitung: Neuen ASR-Provider hinzufügen
- Anleitung: Neue QA-Regel implementieren
- Anleitung: Inferenz-Backend wechseln (OpenAI-kompatible API)
- End-to-End-Testing-Guide
- Lokale Demo-Daten zurücksetzen

---

### P6 – Compliance-Beauftragter / MDR-Verantwortlicher

**Kontext:** Bewertet regulatorische Konformität (EU AI Act, MDR, DSGVO).  
**Ziel:** Nachweis-Artefakte finden, Lücken identifizieren, Zertifizierung vorbereiten.

**Was fehlt:**
- Geführte Übersicht: „Alle Nachweis-Artefakte auf einen Blick"
- Anleitung: Risikomanagementplan erstellen (Art. 9)
- Anleitung: Datenschutzkonzept/TOM-Dokumentation (Art. 10, DSGVO Art. 30)
- Konformitätsbewertungsverfahren (Annex IV § 1 – Notified Body)
- Incident-Response aus Compliance-Sicht (Art. 72 Post-Market)
- Detaillierter Audit-Log-Export-Guide (was ist wo, wie exportieren, wie archivieren)
- Glossar: Regulatorische Begriffe (nicht nur technische)

---

## 3. Bestandsaufnahme nach Persona

### Abdeckungsmatrix (aktueller Stand)

| Thema | P1 Arzt | P2 Neu | P3 Forscher | P4 Admin | P5 Entwickler | P6 Compliance |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Was ist Radiolyze? | ⚠️ | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ |
| Schnelleinstieg | ❌ | ⚠️ | ⚠️ | ⚠️ | ✅ | ❌ |
| Klinische Workflows | ⚠️ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| KI-Fähigkeiten & Grenzen | ❌ | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| Deployment | ❌ | ⚠️ | ❌ | ⚠️ | ✅ | ❌ |
| Security/Hardening | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| Backup/Recovery | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Monitoring/Alerting | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |
| Compliance-Nachweis | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| API-Referenz | ❌ | ❌ | ⚠️ | ❌ | ✅ | ❌ |
| Troubleshooting | ❌ | ❌ | ❌ | ⚠️ | ⚠️ | ❌ |
| Beitragen/Erweitern | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |

**Legende:** ✅ vorhanden · ⚠️ teilweise/veraltet · ❌ fehlt

---

## 4. Vorgeschlagene Dokumentationsstruktur

### 4.1 Neue Navigation (mkdocs.yml)

Die Navigation wird von domänenorientiert auf **rollenorientiert** umgestellt. Jede Nutzergruppe findet einen eigenen Einstiegspunkt:

```
Startseite
├── 🏠 Über Radiolyze          ← Alle Personas: Was ist das, für wen?
│
├── 👨‍⚕️ Für Ärzte & Radiologen   ← P1
│   ├── Erste Schritte
│   ├── Studien befunden (Workflow)
│   ├── KI-Vorschläge prüfen
│   ├── Sprachdiktat nutzen
│   ├── Fehler & Hilfe
│   └── Tastenkürzel
│
├── 🚀 Erste Schritte           ← P2
│   ├── Installation (5 Minuten)
│   ├── Demo-Daten erkunden
│   └── Nächste Schritte
│
├── 🔬 Für Forscher             ← P3
│   ├── KI-Modell (MedGemma)
│   ├── Modell austauschen
│   ├── Validierung & Benchmarking
│   └── Datenfluss & Privacy
│
├── 🖥️ Administration           ← P4
│   ├── Systemanforderungen
│   ├── Deployment (Schritt für Schritt)
│   ├── GPU-Setup (NVIDIA/AMD)
│   ├── DICOM/PACS-Konfiguration
│   ├── Security-Hardening
│   ├── Backup & Recovery
│   ├── Monitoring & Alerting
│   ├── Updates & Upgrades
│   └── Incident Response
│
├── 💻 Entwicklung              ← P5
│   ├── Entwicklungsumgebung
│   ├── Architekturübersicht
│   ├── Beitragen
│   ├── Erweiterungen
│   │   ├── ASR-Provider hinzufügen
│   │   ├── QA-Regeln hinzufügen
│   │   └── Inferenz-Backend wechseln
│   ├── Testing
│   ├── Code-Stil
│   └── Architectural Decision Records
│
├── ⚖️ Compliance               ← P6
│   ├── Nachweis-Artefakte (Übersicht)
│   ├── EU AI Act – Artikel-Mapping
│   ├── Risikomanagement (Art. 9)
│   ├── Datenschutz & DSGVO (Art. 10)
│   ├── Technische Dokumentation (Annex IV)
│   ├── Audit-Logging & Export
│   ├── Post-Market-Monitoring
│   └── Offene Punkte bis Konformitätsbewertung
│
├── 📖 Referenz
│   ├── API-Endpunkte
│   ├── WebSocket-Events
│   ├── Schemas
│   ├── Umgebungsvariablen
│   └── Glossar
│
└── ❓ FAQ                      ← Alle Personas
```

### 4.2 Inhalts-Prinzipien pro Persona

| Persona | Ton | Format | Länge | Muss enthalten |
|---|---|---|---|---|
| P1 Arzt | Klinisch, direkt | Schritte mit Bildern | Kurz | Was tun bei KI-Fehler |
| P2 Neu | Einladend, ermunternd | Copy-Paste-Commands | Kompakt | Screenshot der UI |
| P3 Forscher | Präzise, akademisch | Tabellen, Code | Mittel–Lang | Limitationen, Bias |
| P4 Admin | Technisch, vollständig | Checklisten, Code | Lang | Troubleshooting |
| P5 Dev | Peer-to-Peer | Code, Diagramme | Mittel | Architektur-Kontext |
| P6 Compliance | Formal, normativ | Tabellen, Verweise | Lang | Norm-Referenzen |

---

## 5. Konkrete Lieferobjekte (priorisiert)

### Priorität 1 – Kritischer Fehlbedarf (sofort)

| ID | Dokument | Persona | Aufwand |
|---|---|---|---|
| D-01 | `docs/getting-started/index.md` – „Was ist Radiolyze, für wen?" | P1, P2, alle | 2h |
| D-02 | `docs/getting-started/quickstart.md` – 5-Minuten-Installation mit Demo | P2 | 3h |
| D-03 | `docs/doctors/index.md` – Arzt-Einstieg mit Lernpfad | P1 | 2h |
| D-04 | `docs/doctors/workflow-befundung.md` – Klinischer Workflow Schritt für Schritt | P1 | 4h |
| D-05 | `docs/doctors/ki-grundlagen.md` – Was KI kann, was sie nicht kann, wie prüfen | P1 | 3h |
| D-06 | `docs/admin/deployment.md` – Vollständige Deployment-Anleitung | P4 | 5h |
| D-07 | `docs/admin/security-hardening.md` – Produktions-Checkliste Security | P4 | 4h |
| D-08 | `docs/compliance/evidence-overview.md` – Alle Nachweis-Artefakte auf einen Blick | P6 | 2h |
| D-09 | `docs/faq.md` – Erweitert auf ≥20 Fragen, nach Persona gruppiert | Alle | 3h |

**Summe Priorität 1:** ~28h

---

### Priorität 2 – Wichtig (nächster Sprint)

| ID | Dokument | Persona | Aufwand |
|---|---|---|---|
| D-10 | `docs/admin/gpu-setup.md` – GPU-Setup inkl. Troubleshooting | P4 | 4h |
| D-11 | `docs/admin/backup-recovery.md` – Backup/Restore (DB, Orthanc, Audit-Logs) | P4 | 3h |
| D-12 | `docs/admin/monitoring.md` – Prometheus/Grafana-Setup, Alerting | P4 | 4h |
| D-13 | `docs/admin/dicom-config.md` – Orthanc, DICOMweb, C-STORE konfigurieren | P4 | 3h |
| D-14 | `docs/doctors/tastenkuerzel.md` – Tastenkürzel-Referenz | P1 | 1h |
| D-15 | `docs/doctors/troubleshooting.md` – Häufige Probleme im klinischen Alltag | P1 | 2h |
| D-16 | `docs/research/medgemma.md` – Modell-Guide für Forscher (Limits, Bias) | P3 | 4h |
| D-17 | `docs/research/modell-wechseln.md` – Inferenz-Backend austauschen | P3 | 3h |
| D-18 | `docs/compliance/risk-management.md` – Art. 9 Risikomanagement-Anleitung | P6 | 4h |
| D-19 | `docs/compliance/datenschutz.md` – DSGVO Art. 10/30, TOM-Dokumentation | P6 | 4h |

**Summe Priorität 2:** ~32h

---

### Priorität 3 – Qualitätsverbesserung (bestehende Docs überarbeiten)

| ID | Aktion | Betroffene Datei | Problem | Aufwand |
|---|---|---|---|---|
| R-01 | Inhalt verdreifachen | `docs/workflows/overview.md` | 9 Zeilen – zu dünn | 2h |
| R-02 | Klinische Sprache ergänzen | `docs/workflows/fast-report.md` | Nur UI-Komponenten, kein klinischer Kontext | 2h |
| R-03 | Runbook ausbauen | `docs/operations/runbook.md` | 31 Zeilen – viel zu kurz | 4h |
| R-04 | Checkliste mit Anleitungen ergänzen | `docs/compliance/checklist.md` | Offene Punkte ohne Handlungsanweisung | 3h |
| R-05 | Sprache korrigieren | `docs/index.md` | Ist Deutsch, mkdocs.yml setzt EN als Default | 1h |
| R-06 | Auf ≥20 Fragen erweitern | `docs/faq.md` | Nur 4 Fragen | 3h |
| R-07 | Glossar ausbauen | `docs/glossary.md` | Regulatorische Begriffe fehlen | 2h |
| R-08 | Inhalt ergänzen | `docs/workflows/complex-case.md` | Unklar wie „Priors" klinisch genutzt werden | 2h |

**Summe Priorität 3:** ~19h

---

### Priorität 4 – Erweiterungs-Guides für Entwickler

| ID | Dokument | Inhalt | Aufwand |
|---|---|---|---|
| E-01 | `docs/development/asr-provider-add.md` | Neuen ASR-Provider implementieren | 3h |
| E-02 | `docs/development/qa-regeln.md` | Neue QA-Regel hinzufügen | 2h |
| E-03 | `docs/development/inferenz-backend.md` | OpenAI-kompatibles Backend anschließen | 3h |
| E-04 | `docs/development/e2e-testing.md` | End-to-End-Tests schreiben und ausführen | 2h |
| E-05 | `docs/development/contributing.md` | PR-Prozess, Labels, Review-Kriterien ausbauen | 2h |
| E-06 | `docs/research/validierung.md` | Benchmarking-Anleitung für Forscher | 3h |
| E-07 | `docs/admin/updates.md` | Update/Upgrade-Verfahren | 2h |
| E-08 | `docs/admin/incident-response.md` | Detaillierter Incident-Response-Plan | 3h |

**Summe Priorität 4:** ~20h

---

## 6. Strukturelle Änderungen an mkdocs.yml

### 6.1 Neue Verzeichnisstruktur (zu erstellen)

```
docs/
├── getting-started/          ← NEU
│   ├── index.md
│   └── quickstart.md
├── doctors/                  ← NEU
│   ├── index.md
│   ├── workflow-befundung.md
│   ├── ki-grundlagen.md
│   ├── tastenkuerzel.md
│   └── troubleshooting.md
├── research/                 ← NEU
│   ├── index.md
│   ├── medgemma.md
│   ├── modell-wechseln.md
│   └── validierung.md
├── admin/                    ← NEU (fasst operations/ + deployment zusammen)
│   ├── index.md
│   ├── deployment.md
│   ├── gpu-setup.md
│   ├── dicom-config.md
│   ├── security-hardening.md
│   ├── backup-recovery.md
│   ├── monitoring.md
│   ├── updates.md
│   └── incident-response.md
├── compliance/               ← ERWEITERN
│   ├── evidence-overview.md  ← NEU
│   ├── risk-management.md    ← NEU
│   ├── datenschutz.md        ← NEU
│   ├── checklist.md          ← ERWEITERN
│   ├── audit-logging.md
│   ├── eu-ai-act-mapping.md
│   └── annex-iv.md
├── development/              ← ERWEITERN
│   ├── asr-provider-add.md   ← NEU
│   ├── qa-regeln.md          ← NEU
│   ├── inferenz-backend.md   ← NEU
│   ├── e2e-testing.md        ← NEU
│   └── ... (bestehende)
├── architecture/             ← BLEIBT (technische Referenz)
├── api/                      ← BLEIBT (technische Referenz)
├── workflows/                ← ÜBERARBEITEN (klinischere Sprache)
└── ... (bestehende)
```

### 6.2 Rollen-basiertes „Start Here"-Banner

Auf der Startseite (`docs/index.md`) wird ein Auswahl-Grid ergänzt:

```
Wähle deinen Einstieg:
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  👨‍⚕️ Arzt     │  🚀 Neu hier  │  🔬 Forscher  │  🖥️ Admin    │  💻 Entwickler│  ⚖️ Compliance│
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

---

## 7. Qualitätsstandards

Jedes neue Dokument muss folgende Mindestanforderungen erfüllen:

### Für alle Dokumente
- [ ] Klar definierte Zielgruppe im ersten Absatz
- [ ] Aktuelle Versions-/Statusangabe
- [ ] Links zu verwandten Seiten am Ende
- [ ] Keine undefinierten Akronyme (oder Verweis auf Glossar)

### Für klinische Dokumente (P1)
- [ ] Kein Jargon aus Software-Entwicklung
- [ ] Jeder Schritt in max. 2 Sätzen
- [ ] Explizite „Was tun wenn..." Abschnitte
- [ ] Klinische Haftungshinweise (KI ist Unterstützung, keine Diagnose)

### Für technische Dokumente (P4, P5)
- [ ] Alle Code-Beispiele getestet und reproduzierbar
- [ ] Voraussetzungen (Prerequisites) am Anfang
- [ ] Erwartetes Ergebnis nach jedem Schritt
- [ ] Troubleshooting-Sektion am Ende

### Für Compliance-Dokumente (P6)
- [ ] Normreferenz (EU AI Act Artikel, MDR Annex) bei jeder Anforderung
- [ ] Klare Aussage: implementiert / teilweise / ausstehend
- [ ] Verlinkung auf Nachweis-Artefakt (Datei, API-Endpoint, Code)

---

## 8. Umsetzungsplan (Phasen)

### Phase 1 – Fundament (Woche 1–2)
**Ziel:** Kein Nutzer landet auf einer leeren oder irrelevanten Seite.

1. `docs/index.md` in EN übersetzen + Rollen-Auswahl-Grid ergänzen (R-05, D-01)
2. `docs/getting-started/quickstart.md` erstellen (D-02)
3. `docs/faq.md` auf ≥20 Fragen erweitern (D-09, R-06)
4. `mkdocs.yml` Navigation auf neue Struktur umstellen
5. Neue Verzeichnisse `doctors/`, `admin/`, `research/` anlegen

### Phase 2 – Arzt & Admin (Woche 3–4)
**Ziel:** Primäre Endnutzer und IT-Betrieb vollständig abgedeckt.

1. Arzt-Docs: D-03, D-04, D-05, D-14, D-15
2. Admin-Docs: D-06, D-07, D-10, D-11
3. Bestehende Workflows klinisch überarbeiten: R-01, R-02, R-08
4. Runbook ausbauen: R-03

### Phase 3 – Compliance & Forscher (Woche 5–6)
**Ziel:** Regulatorische Nachweisführung und Forschungserweiterung möglich.

1. Compliance-Docs: D-08, D-18, D-19, R-04
2. Forscher-Docs: D-16, D-17, E-06
3. Glossar ausbauen: R-07

### Phase 4 – Entwickler-Extensions (Woche 7–8)
**Ziel:** Contributions vereinfachen, Erweiterbarkeit dokumentieren.

1. Dev-Guides: E-01, E-02, E-03, E-04, E-05
2. Admin-Ergänzungen: E-07, E-08
3. Übersetzungen DE synchronisieren

---

## 9. Erfolgskriterien

| Metrik | Jetzt | Ziel |
|---|---|---|
| Dokumente mit klarer Zielgruppe | ~5 % | 100 % |
| FAQ-Einträge | 4 | ≥ 20 |
| Rollen-Einstiegspunkte | 0 | 6 |
| Abdeckungsmatrix „✅" | 5/66 (8 %) | ≥ 45/66 (68 %) |
| Runbook-Länge (Zeilen) | 31 | ≥ 200 |
| Neue Dokumente (Priorität 1+2) | 0 | 19 |
| Compliance-Punkte mit Anleitung | 0/8 | 8/8 |

---

## 10. Offene Fragen / Entscheidungsbedarf

1. **Sprache der Arzt-Docs:** Primär Deutsch (Zielgruppe DACH) oder Englisch mit DE-Übersetzung?
2. **Screenshots:** Sollen in CI automatisch generiert werden (Playwright), oder manuell?
3. **Haftungshinweis:** Welcher genaue Disclaimer soll in alle klinischen Seiten?
4. **Compliance-Verantwortlicher:** Wer prüft Compliance-Docs inhaltlich (rechtlich)?
5. **Versionierung:** Sollen Docs versioniert werden (mkdocs-versioning Plugin)?
6. **Changelog der Docs:** Soll ein `CHANGELOG.md` für die Dokumentation geführt werden?

---

*Erstellt auf Basis von Projektstatus April 2026 · Branch `claude/improve-documentation-GOxjY`*
