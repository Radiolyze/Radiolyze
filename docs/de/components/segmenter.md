# 3D-Segmentierung & Mesh-Viewer

Radiolyze kann ein CT-Volumen in navigierbare 3D-Modelle mit auswählbaren
Gewebeschichten umwandeln. Die Pipeline läuft als separater Microservice
(`segmenter`) – analog zu vLLM und MedASR – damit Segmentierung niemals den
Haupt-Workflow im Orchestrator blockiert.

!!! warning "Research-/Demo-Phase"
    Die aktuelle Pipeline trägt ein `Not for diagnostic use`-Banner. Vollständige
    MDR Class IIa Validierung und formale Risikomanagement-Artefakte sind erst
    nachgelagert vorgesehen.

## Kurzüberblick

- **Frontend**: vtk.js MeshViewer lädt GLB/VTP-Meshes „lazy“ (nur bei Bedarf)\n+- **Backend**: FastAPI orchestriert Jobs, Audit-Events und Mesh-Downloads\n+- **Worker**: führt den Job aus, pollt den Segmenter\n+- **Segmenter-Service**: erzeugt Masken + Meshes und schreibt Artefakte in ein Shared Volume

## Details

Diese Seite ist derzeit nur als **DE-Kurzfassung** verfügbar. Die vollständige
technische Beschreibung (Architektur, Manifest, Audit-Events, DICOM SEG Export,
Performance-Budget) steht in der englischen Version:

- [3D Segmentation & Mesh Viewer (EN)](../../en/components/segmenter.md)

