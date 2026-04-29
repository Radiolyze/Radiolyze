# Erste Schritte mit Radiolyze

## Was ist Radiolyze?

Radiolyze ist ein Open-Source-Radiologie-Workflow-System, das Folgendes kombiniert:

- einen **DICOM-Viewer** zum Anzeigen und Navigieren medizinischer Bilder
- **KI-gestützte Befundung** (MedGemma), die aus Bildern Findings und Impressions entwirft
- **Sprachdiktat** (MedASR oder Whisper), damit Radiologen Findings freihändig diktieren können
- **strukturierte Qualitätsprüfungen**, die unvollständige oder inkonsistente Berichte markieren
- **Audit-Logging**, das jede KI-Interaktion für die EU-AI-Act-Konformität protokolliert

Das System läuft vollständig On-Premises — Patientendaten verlassen Ihre Infrastruktur nicht.

![Radiolyze UI (Screenshot)](../../assets/screenshot-radiolyze.png)

---

## Für wen ist Radiolyze?

| Rolle | Wie Radiolyze hilft |
|---|---|
| **Radiologe / Arzt** | Schnellere Befundung: KI entwirft Findings, Sprache ersetzt Tippen, QA erkennt Fehler |
| **IT-Administrator** | Docker-basiertes Deployment, GPU-Unterstützung (NVIDIA/AMD), DICOM-Integration via Orthanc |
| **Forscher / KI-Spezialist** | Austauschbares Inferenz-Backend, Audit-Trail, Prompt-Anpassung |
| **Compliance-Beauftragter** | EU-AI-Act Art. 12–15 Logging, Human Oversight, Annex-IV-Dokumentation |
| **Entwickler / Contributor** | TypeScript + React Frontend, FastAPI Backend, offen und erweiterbar |

---

## Was Radiolyze NICHT ist

- **Kein zugelassenes Medizinprodukt.** Klinische Validierung und regulatorische Zulassung liegen in der Verantwortung der betreibenden Einrichtung.
- **Nicht produktionsreif ohne weitere Konfiguration.** Authentifizierung, TLS und Security-Hardening müssen vor dem klinischen Einsatz konfiguriert werden.
- **Kein Ersatz für die ärztliche Beurteilung.** KI-Outputs sind Entwürfe, die von einem qualifizierten Arzt geprüft und freigegeben werden müssen.

---

## Ihre ersten 10 Minuten (ohne KI)

Wenn Sie den Workflow schnell verstehen möchten, machen Sie zuerst Folgendes:

1. Stack mit Demo-Daten starten: dem [Schnellstart-Leitfaden](quickstart.md) folgen.
2. UI unter `http://localhost:5173` öffnen und eine Studie aus der Arbeitsliste auswählen.
3. Durch Frames scrollen, ein Fensterungs-Preset testen und rechts ein kurzes Finding eingeben.
4. Bericht freigeben (Radiolyze ist auch ohne GPU/KI-Inferenz vollständig nutzbar).

Wenn das sitzt, können Sie GPU-Inferenz und/oder Sprachdiktat-Overlays nach Bedarf aktivieren.

---

## Systemanforderungen (Überblick)

| Komponente | Minimum | Empfohlen |
|---|---|---|
| CPU | 4 Kerne | 8+ Kerne |
| RAM | 8 GB | 16–32 GB |
| GPU | Nicht erforderlich (CPU-Modus) | NVIDIA mit ≥16 GB VRAM (für MedGemma) |
| Speicher | 20 GB (OS + Stack) | 100+ GB (DICOM-Archiv) |
| Betriebssystem | Linux (aktuell) | Ubuntu 22.04 LTS |
| Docker | 24.x + Compose v2 | Aktuellste stabile Version |

---

## Ihren Einstieg wählen

=== "Radiologe"
    **Ziel:** Das System für die tägliche Befundung nutzen.

    1. Bitten Sie Ihren Administrator, Radiolyze zu installieren und DICOM-Studien zu laden.
    2. Lesen Sie den [Arzt-Leitfaden](../doctors/index.md) für den Befundungs-Workflow.
    3. Probieren Sie den [Fast-Reporting-Workflow](../workflows/fast-report.md) für Röntgen-Thorax-Befunde.

=== "Neu beim Projekt"
    **Ziel:** Radiolyze in 5 Minuten mit Demo-Daten sehen.

    1. Docker und Docker Compose installieren.
    2. Dem [Schnellstart-Leitfaden](quickstart.md) folgen.
    3. Die automatisch geladenen Demo-Studien erkunden.

=== "Administrator"
    **Ziel:** Radiolyze in einem Krankenhausnetz deployen.

    1. [Systemanforderungen](../admin/index.md#systemanforderungen) prüfen.
    2. Dem [Deployment-Leitfaden](../admin/index.md) folgen.
    3. Vor dem Go-Live [Security-Hardening](../admin/index.md#sicherheit) konfigurieren.

=== "Forscher"
    **Ziel:** KI-Fähigkeiten evaluieren oder erweitern.

    1. Den [MedGemma-Modell-Leitfaden](../research/index.md) lesen.
    2. Den [Datenfluss](../architecture/data-flow.md) für die Datenschutzanalyse prüfen.
    3. Anleitung zum [Austausch des Inferenz-Backends](../research/index.md#inferenz-backend-wechseln) folgen.

=== "Entwickler"
    **Ziel:** Lokale Entwicklungsumgebung einrichten und beitragen.

    1. Dem [Entwicklungs-Setup](../development/setup.md) folgen.
    2. Die [Contributing-Richtlinien](../development/contributing.md) lesen.
    3. Die [Architekturübersicht](../architecture/overview.md) erkunden.
