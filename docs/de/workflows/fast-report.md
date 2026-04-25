# Fast Reporting (CXR, <10 Minuten)

## Ziel

Einfacher Einzelfall mit schneller Befundung und automatischer Impression.

## Ablauf

1. **Queue Auswahl**: Radiologe startet Report aus Warteschlange.
2. **Viewer Load**: CXR wird geladen.
3. **Diktat**: Mic starten, Findings per ASR.
4. **AI Draft**: Impression wird automatisch erzeugt.
5. **QA Check**: Status anzeigen, ggf. Warnung.
6. **Freigabe**: Approval Dialog, Signatur.

## UI Komponenten

- FindingsPanel (ASR, Confidence)
- ImpressionPanel (AI Draft)
- ProgressOverlay (ASR/AI/QA)
