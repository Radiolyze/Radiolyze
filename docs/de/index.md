---
hide:
  - toc
  - navigation
---

<div class="rl-hero" markdown>

# Radiolyze

**Radiologie-Workflow-System mit KI-gestützter Befunderstellung, DICOM-Viewer,
Spracherkennung und EU-AI-Act-konformem Audit-Logging.**

<span class="rl-badge rl-badge--research">:material-flask: Nur Forschung &amp; Lehre</span>
&nbsp;
<span class="rl-badge rl-badge--open-source">:material-open-source-initiative: Open Source</span>

<div class="rl-hero-actions" markdown>
[Schnellstart &nbsp; :material-rocket-launch:](getting-started/quickstart.md){ .md-button .md-button--primary }
[Arzt-Leitfaden &nbsp; :material-stethoscope:](doctors/index.md){ .md-button }
[GitHub &nbsp; :fontawesome-brands-github:](https://github.com/radiolyze/radiolyze){ .md-button }
</div>

</div>

!!! danger "Nur Forschung & Lehre — kein Medizinprodukt"
    Radiolyze ist **KEIN zugelassenes Medizinprodukt** und **nicht für klinischen Einsatz oder diagnostische Zwecke** bestimmt.
    Nutzung **ausschließlich für Forschung und Lehre** (nur anonymisierte oder synthetische Daten).

    Vollständiger Disclaimer: [Disclaimer](legal/disclaimer.md)

![Radiolyze UI (Screenshot)](../assets/screenshot-radiolyze.png)

---

## Wo möchten Sie starten?

<div class="grid cards" markdown>

-   :material-stethoscope: **Ich bin Radiologin / Arzt**

    Lernen Sie, wie Sie Radiolyze für die tägliche Befundung nutzen: DICOM-Viewer, KI-gestützte Findings, Sprachdiktat und Freigabe-Workflow.

    [:octicons-arrow-right-24: Arzt-Leitfaden](doctors/index.md)

-   :material-rocket-launch: **Ich bin neu hier**

    In 5 Minuten startklar mit Docker und den integrierten Demo-Daten.

    [:octicons-arrow-right-24: Schnellstart](getting-started/quickstart.md)

-   :material-flask: **Ich bin Forscher / KI-Spezialist**

    KI-Modell (MedGemma) verstehen, Inferenz-Backend austauschen, Outputs validieren und die Datenpipeline erkunden.

    [:octicons-arrow-right-24: Forscher-Leitfaden](research/index.md)

-   :material-server: **Ich bin IT-Administrator**

    Radiolyze in einer Krankenhausumgebung oder Private Cloud deployen, konfigurieren, absichern und überwachen.

    [:octicons-arrow-right-24: Administrations-Leitfaden](admin/index.md)

-   :material-code-braces: **Ich bin Entwickler**

    Entwicklungsumgebung einrichten, Architektur verstehen und zum Projekt beitragen.

    [:octicons-arrow-right-24: Entwicklungs-Setup](development/setup.md)

-   :material-scale-balance: **Ich bin Compliance-Beauftragter**

    Nachweis-Artefakte finden, EU-AI-Act-Mappings, Risikomanagement-Vorlagen und den Weg zur Konformitätsbewertung.

    [:octicons-arrow-right-24: Compliance-Übersicht](compliance/checklist.md)

</div>

---

## Kernfunktionen

<div class="grid cards" markdown>

-   :material-monitor: **DICOM-Viewer**

    Cornerstone.js-basierter Stack-Viewer mit Tools (Zoom, Pan, Fensterung, Messungen), Seriennavigation und Prior-Studies-Vergleich.

    [:octicons-arrow-right-24: Viewer-Dokumentation](components/viewer.md)

-   :material-brain: **KI-gestützte Befundung**

    MedGemma multimodale Bildanalyse für automatisierte Findings und Impressions mit obligatorischen Human-Oversight-Dialogen.

    [:octicons-arrow-right-24: Workflows](workflows/overview.md)

-   :material-microphone: **Sprachdiktat (ASR)**

    MedASR oder selbst-gehostetes Whisper für medizinisches Diktat mit Live-Transkription direkt ins Findings-Panel.

    [:octicons-arrow-right-24: Fast-Reporting-Workflow](workflows/fast-report.md)

-   :material-shield-check: **EU-AI-Act-Konformität**

    Vollständiges Audit-Logging (Art. 12), Transparenzindikatoren (Art. 13), Human-Oversight-Dialoge (Art. 14), Robustheit-Fallbacks (Art. 15).

    [:octicons-arrow-right-24: Compliance-Dokumentation](compliance/checklist.md)

</div>

---

## Schnellstart

```bash
# Kompletten Stack starten (CPU-Modus, inkl. Demo-DICOM-Daten)
docker compose up --build
```

Dann [http://localhost:5173](http://localhost:5173) im Browser öffnen.

Für GPU-Beschleunigung, Produktions-Deployment und weitere Optionen → [Schnellstart-Leitfaden](getting-started/quickstart.md)

---

!!! warning "Nicht produktionsreif ohne weitere Konfiguration"
    Radiolyze ist eine Referenzimplementierung. Ohne zusätzliche Konfiguration **nicht produktionsreif**:
    Authentifizierung/RBAC, TLS, Security-Hardening und Validierung sind erforderlich.
    Siehe [Administrations-Leitfaden](admin/index.md) und [Compliance-Checkliste](compliance/checklist.md).
