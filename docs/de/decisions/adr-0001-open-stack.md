# ADR-0001: Offener Radiologie-Stack

## Status

Accepted

## Kontext

Das Projekt benoetigt eine offene, EU-konforme Architektur mit hoher Kontrolle ueber
Daten und Modelle.

## Entscheidung

Wir setzen auf:

- Orthanc (DICOM + DICOMweb)
- FastAPI Orchestrator
- MedASR + MedGemma Inference
- RAG fuer Guidelines/Templates
- DICOM SR fuer finalen Report

## Konsequenzen

- Selbstbetrieb ist moeglich (On-Prem)
- Compliance muss aktiv gemanaged werden
- Zusatzauswand fuer Betrieb, Monitoring, QA
