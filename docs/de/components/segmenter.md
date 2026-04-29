# 3D-Segmentierung & Mesh-Viewer

Radiolyze kann ein CT-Volumen in navigierbare 3D-Modelle (Meshes) mit auswählbaren
Gewebeschichten umwandeln. Die Pipeline läuft als separater Microservice (`segmenter`),
analog zu vLLM und MedASR, damit Segmentierung niemals den Haupt-Workflow blockiert.

!!! danger "Nur Forschung & Lehre — nicht für Diagnostik"
    Diese 3D-Segmentierungs-/Mesh-Pipeline ist **nicht für klinischen Einsatz oder diagnostische Zwecke** bestimmt.
    Nutzung **ausschließlich für Forschung und Lehre** (anonymisierte oder synthetische Daten).

    Siehe: [Disclaimer](../legal/disclaimer.md)

## Architektur (Überblick)

```
Browser (vtk.js MeshViewer)
   │  POST /api/v1/segmentation/jobs
   ▼
FastAPI Orchestrator  ──RQ enqueue──▶  Worker
   │ (SegmentationJob + Audit)           │ HTTP
   │                                     ▼
   ◀──────────── shared volume ── services/segmenter
                 /data/segmentations/    (FastAPI + SimpleITK + trimesh)
                   └─ <job_id>/
                      manifest.json
                      masks/<id>_<name>.nii.gz
                      meshes/<id>.glb
                      meshes/<id>.vtp
```

- Backend und Segmenter mounten dasselbe Docker-Volume (`seg-data`). Mesh-Downloads
  werden vom Orchestrator direkt aus dem lokalen Artefakt-Verzeichnis gestreamt.
- `job_id`s werden vom Orchestrator erzeugt (Identity/Ownership liegt dort); der Segmenter nutzt
  sie nur als Verzeichnisnamen.

## UI: MeshViewer (Frontend)

Der MeshViewer ist ein eigener Viewer-Modus:

- Umschaltung über den **Mesh**-Button (aktuell **nur CT**, typischerweise **≥30 Frames**).
- Job-Start via Preset (`bone` / `total`) und **Generate**.
- Labels werden **lazy** nachgeladen (Top-N zuerst, Rest beim Aktivieren).
- Pro Label: Sichtbarkeit, Opacity, Farbe (mit Reset); Suche/Sortierung/Minimum-Volumen.
- **Clip-Plane**: globales Clipping entlang X/Y/Z, Position in mm.
- **An PACS senden**: erscheint nur, wenn ein DICOM SEG erzeugt wurde (`manifest.dicom_seg`).

## Milestones (Pipeline-Reife)

| Milestone | Status | Capability |
|---|---|---|
| **M1** | done | CT bone via HU thresholding (no ML, no GPU) |
| **M2** | done | TotalSegmentator multi-organ (~104 classes) |
| **M3** | done | Polish, lazy loading, ROCm overlay, audit detail |
| **M4** | done | DICOM SEG export back into Orthanc |

## Endpoints (Backend API)

| Route | Methode | Zweck |
|---|---|---|
| `/api/v1/segmentation/jobs` | POST | Job starten (`preset = bone | total`) |
| `/api/v1/segmentation/jobs/{id}` | GET | Status + Manifest (falls verfügbar) |
| `/api/v1/segmentation/jobs/{id}/manifest` | GET | Nur Manifest |
| `/api/v1/segmentation/jobs/{id}/mesh/{label_id}?format=glb|vtp` | GET | Mesh streamen (GLB/VTP) |
| `/api/v1/segmentation/jobs/{id}/mask/{label_id}` | GET | NIfTI Maske streamen |
| `/api/v1/segmentation/jobs/{id}/push-to-pacs` | POST | DICOM SEG in Orthanc hochladen (opt-in) |
| `/api/v1/segmentation/jobs/{id}` | DELETE | Job-Row + Artefakte löschen |

## Manifest (Artefakt-Index)

Der Worker schreibt `manifest.json` pro Job. Beispiel:

```json
{
  "job_id": "...",
  "preset": "bone",
  "source": { "study_uid": "...", "series_uid": "...", "modality": "CT" },
  "volume": {
    "spacing": [0.7, 0.7, 1.5],
    "origin":  [10.0, -5.0, 100.0],
    "direction": [1, 0, 0, 0, 1, 0, 0, 0, 1],
    "shape": [32, 32, 24]
  },
  "labels": [
    {
      "id": 1, "name": "bone",
      "color": [0.93, 0.87, 0.74],
      "volume_ml": 162.4, "voxel_count": 81234,
      "vertex_count": 2048, "face_count": 4090,
      "mask_url": "/jobs/<id>/mask/1",
      "mesh_url": "/jobs/<id>/mesh/1",
      "vtp_url":  "/jobs/<id>/mesh/1?format=vtp"
    }
  ]
}
```

`volume.{spacing, origin, direction}` spiegeln die DICOM-Geometrie, damit ein DICOM-SEG Writer
den Frame of Reference rekonstruieren kann, ohne die Originalserie erneut zu lesen.

## Koordinatenrahmen

Mesh-Vertices werden in **LPS World Coordinates** (DICOM-Standard) geschrieben.
Die Transformation entspricht dem ITK voxel-to-physical mapping:

```
physical = origin + direction · (i · sx, j · sy, k · sz)
```

## Audit-Events

Segmentierungsjobs emittieren Audit-Events über den bestehenden `add_audit_event` Helper:

| Event | Quelle | Wo |
|---|---|---|
| `segmentation_queued` | api | `POST /jobs` |
| `segmentation_started` | worker | RQ task started |
| `segmentation_completed` | worker | manifest written |
| `segmentation_failed` | worker | timeout / error |
| `segmentation_mesh_accessed` (optional) | api | mesh/mask GET (wenn aktiviert) |
| `segmentation_pushed_to_pacs` | api | `POST /push-to-pacs` ok |
| `segmentation_push_failed` | api | SEG fetch / STOW-RS upload failed |

`segmentation_mesh_accessed` ist standardmäßig **aus**, da UI-Sessions sonst sehr viele Rows erzeugen.

## Performance-Budget (Meshes)

Standard-Parameter reduzieren die Mesh-Größe für den Browser. Das Ziel ist ein schnelles initiales
Laden plus Lazy Loading beim Umschalten von Labels.

Tuning über `MESH_MAX_FACES` (Default `20000`) möglich.

## DICOM SEG Export (Push-to-PACS)

Nach dem Meshing schreibt der Segmenter optional eine multi-class DICOM Segmentation IOD (`segmentation.dcm`)
mittels `pydicom-seg`. Das SEG referenziert die Original-CT-Slices (SOP Instance UIDs), sodass DICOM-SEG-fähige
Viewer (z.B. 3D Slicer, OHIF, MITK) die Segmentierung als Overlay darstellen können.

Der Export ist **opt-in**: Der UI-Button „An PACS senden“ erscheint nur nach erfolgreichem Run und nur wenn
das Manifest `dicom_seg` enthält. Der Backend-Call ist `POST /api/v1/segmentation/jobs/{id}/push-to-pacs`.

Um die SEG-Erzeugung komplett zu deaktivieren (z.B. in reinen Research-Setups ohne PACS), setze:
`SEGMENTATION_GENERATE_DICOM_SEG=false`.

## Konfiguration

| Variable | Default | Zweck |
|---|---|---|
| `SEGMENTER_URL` | `http://segmenter:8200` | Orchestrator → Segmenter Base URL |
| `SEGMENTATION_DATA_DIR` | `/data/segmentations` | Shared Volume Mount |
| `SEGMENTATION_JOB_TIMEOUT` | `1800` | Worker Poll Timeout (s) |
| `SEGMENTATION_POLL_INTERVAL` | `3` | Worker Poll Cadence (s) |
| `BONE_HU_THRESHOLD` | `300` | HU Cutoff für `bone` |
| `SEGMENTER_MAX_PARALLEL_WADO` | `8` | Concurrent WADO Instanz-Fetches |
| `MESH_MAX_FACES` | `20000` | Decimation Ceiling pro Label |
| `SEGMENTATION_AUDIT_MESH_DOWNLOADS` | `false` | Audit jede Mesh/Mask GET |
| `SEGMENTATION_GENERATE_DICOM_SEG` | `true` | `segmentation.dcm` schreiben |

## Lokale Validierung (Entwicklung)

Ohne Docker können die Testsuites den HTTP-Surface und den voxel→LPS Pipeline-Teil abdecken:

```bash
# Backend orchestrator
pytest backend/tests/test_segmentation_api.py

# Segmenter microservice
pytest services/segmenter/tests/

# Frontend MeshViewer
npm test -- src/components/Viewer/__tests__/MeshViewer.test.tsx
```

## Lizenzhinweise (Modelle / Third-Party)

- Das `bone` Preset ist HU-Thresholding und enthält keine Drittanbieter-Gewichte.
- Das `total` Preset nutzt TotalSegmentator / nnU-Net (Attribution wird im UI angezeigt).

