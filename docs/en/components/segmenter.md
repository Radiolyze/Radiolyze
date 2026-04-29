# 3D Segmentation & Mesh Viewer

Radiolyze can turn a CT volume into navigable 3D models with selectable
tissue layers. The pipeline runs as a separate microservice (`segmenter`),
analogous to vLLM and medasr, so segmentation never blocks the main API.

!!! warning "Research / Demo phase"
    The current pipeline carries a `Not for diagnostic use` banner. Full
    MDR Class IIa validation is deferred until the milestone-4 DICOM SEG
    export and risk-management work are complete.

## Architecture

```
Browser (vtk.js MeshViewer)
   │  POST /api/v1/segmentation/jobs
   ▼
FastAPI orchestrator   ──RQ enqueue──▶  Worker
   │ (SegmentationJob row + audit)         │ HTTP
   │                                       ▼
   ◀──────────────── shared volume ── radiolyze-segmenter
                     /data/segmentations/  (FastAPI + SimpleITK + trimesh)
                       └─ <job_id>/
                          manifest.json
                          masks/<id>_<name>.nii.gz
                          meshes/<id>.glb
                          meshes/<id>.vtp
```

* Both backend and segmenter mount the named volume `seg-data`. Mesh
  downloads from the browser stream **directly** off the orchestrator's local
  disk; the segmenter is only contacted as a fallback while the volume is
  still being written.
* Segmentation `job_id`s are minted by the orchestrator (it owns identity);
  the segmenter just uses them as directory names.

## Milestones

| Milestone | Status | Capability |
|---|---|---|
| **M1** | done | CT bone via HU thresholding (no ML, no GPU) |
| **M2** | done | TotalSegmentator multi-organ (~104 classes) |
| **M3** | done | Polish, lazy loading, ROCm overlay, audit detail |
| **M4** | done | DICOM SEG export back into Orthanc |

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/v1/segmentation/jobs` | POST | Queue a job (`preset = bone \| total`) |
| `/api/v1/segmentation/jobs/{id}` | GET | Status + manifest |
| `/api/v1/segmentation/jobs/{id}/manifest` | GET | Manifest only |
| `/api/v1/segmentation/jobs/{id}/mesh/{label_id}?format=glb\|vtp` | GET | Binary mesh stream |
| `/api/v1/segmentation/jobs/{id}/mask/{label_id}` | GET | NIfTI mask stream |
| `/api/v1/segmentation/jobs/{id}/push-to-pacs` | POST | Upload the multi-class DICOM SEG to Orthanc; persists Orthanc URL on the job row |
| `/api/v1/segmentation/jobs/{id}` | DELETE | Drop row + on-disk artifacts |

The `total` preset returns 501 in M1; remove that gate when the M2
TotalSegmentator dependency lands in `services/segmenter/requirements.txt`.

## Manifest

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

`volume.{spacing, origin, direction}` mirror the source DICOM exactly so a
downstream DICOM-SEG writer can reconstruct the frame of reference without
re-reading the original series.

## Coordinate frame

Mesh vertices are written in **LPS world coordinates** (the DICOM standard).
The transform is the standard ITK voxel-to-physical map:

```
physical = origin + direction · (i · sx, j · sy, k · sz)
```

`services/segmenter/tests/test_coordinate_frame.py` proves this end-to-end
for identity orientation, origin offsets, axis-flipped `(-1, 0, 0, 0, -1, 0, 0, 0, 1)`
direction (very common for axial CT) and anisotropic spacing — placing a
sphere at a known voxel index and asserting the GLB centroid lands within
half a voxel of the analytically expected LPS point.

## Audit events

Segmentation jobs emit four audit-event types via the existing
`add_audit_event` helper:

| Event | Source | Where |
|---|---|---|
| `segmentation_queued` | api | `POST /jobs` |
| `segmentation_started` | worker | RQ task picked up |
| `segmentation_completed` | worker | manifest written |
| `segmentation_failed` | worker | timeout or segmenter error |
| `segmentation_mesh_accessed` (optional) | api | every mesh / mask GET when `SEGMENTATION_AUDIT_MESH_DOWNLOADS=true` |
| `segmentation_pushed_to_pacs` | api | `POST /jobs/{id}/push-to-pacs` succeeded |
| `segmentation_push_failed` | api | DICOM SEG fetch from segmenter or STOW-RS upload failed |

The `segmentation_mesh_accessed` event is **off by default** because a normal
viewing session emits 5–50 toggle-driven mesh fetches, and a busy radiologist
would generate hundreds of audit rows per study. Switch it on for an MDR
Class IIa pre-audit window or a forensic review; the event payload includes
`{job_id, label_id, format, kind, preset}` so it's queryable without joining
back to the job manifest.

## Performance budget

Default decimation parameters keep the per-study mesh bundle small enough
for the browser:

| Volume class | Example tissue | Target faces |
|---|---|---|
| < 5 ml | rib fragment, small lymph node | 2,000 (floor) |
| 5–50 ml | gallbladder, kidney pole, vertebra | 4,000–14,000 |
| 50–500 ml | spleen, single kidney, lung lobe | 14,000–20,000 (ceiling) |
| > 500 ml | liver, full lung | 20,000 (ceiling) |

The mapping is `target = ceiling × √(volume_ml / 100)` clamped to
`[ceiling/10, ceiling]`. Tune via `MESH_MAX_FACES` (default `20000`):
- Bump to `40000` if your GPUs idle and radiologists complain about staircase
  artefacts on the liver edge.
- Drop to `5000` if you target tablets / low-end browsers.

Empirical bundle sizes (single chest CT, fast=True):

| Preset | Labels | Total GLB on disk |
|---|---|---|
| `bone` | 1 | ~80 KB |
| `total` | ~95 (chest CT) | ~3 MB |
| `total` (with `MESH_MAX_FACES=40000`) | same | ~6 MB |

The browser fetches GLBs lazily via `MeshViewer`'s top-N preload + on-toggle
loading, so the *initial* bundle download is roughly 10 × `(ceiling × 0.5)`
bytes in glTF-encoded form ≈ 1 MB for the default settings.

## DICOM SEG export (M4)

After the meshing pass the segmenter additionally writes a multi-class
DICOM Segmentation IOD (`segmentation.dcm`) using `pydicom-seg`. The SEG
references the original CT slices by SOP Instance UID, so any DICOM SEG-
aware viewer (3D Slicer, OHIF, MITK, …) can overlay it on the source
study without re-running the pipeline.

The export is **opt-in at the user level**: the viewer's "An PACS senden" /
"Send to PACS" button (visible only after a successful run with a manifest
that carries `dicom_seg`) calls `POST /api/v1/segmentation/jobs/{id}/push-to-pacs`,
which:

1. fetches the SEG file from the segmenter via `GET /jobs/{id}/dicom-seg`,
2. STOW-RS uploads it to Orthanc (re-using the same client used for SR
   archiving — see `backend/app/dicom_client.py:store_dicom_object`),
3. persists the resulting Orthanc study URL on `SegmentationJob.dicom_seg_orthanc_url`,
4. emits a `segmentation_pushed_to_pacs` audit event with
   `{job_id, preset, orthanc_url, sop_instance_uid, series_instance_uid,
   label_count, size_bytes}`.

A re-push is a no-op duplicate-friendly STOW-RS write (Orthanc deduplicates
on SOPInstanceUID); the orchestrator simply overwrites the cached URL.

To skip the SEG generation pass entirely (e.g. on a research deployment
without a real PACS), set `SEGMENTATION_GENERATE_DICOM_SEG=false`. The job
will still publish meshes; the manifest just won't contain a `dicom_seg`
section and the push button stays hidden.

### SCT codes

The writer maps a small curated subset of label names to SNOMED CT type
codes (`spleen` → T-C3000, `liver` → T-62000, `aorta` → T-42000, etc.) and
falls back to `T-D000A "Anatomical structure"` for the long tail. This is
sufficient for viewer rendering and round-tripping; full ICD-10 / RadLex
mapping is out of scope for this milestone.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SEGMENTER_URL` | `http://segmenter:8200` | Orchestrator → segmenter base URL |
| `SEGMENTATION_DATA_DIR` | `/data/segmentations` | Shared volume mount |
| `SEGMENTATION_JOB_TIMEOUT` | `1800` | Worker poll timeout (s) |
| `SEGMENTATION_POLL_INTERVAL` | `3` | Worker poll cadence (s) |
| `BONE_HU_THRESHOLD` | `300` | HU cutoff for the bone preset |
| `SEGMENTER_MAX_PARALLEL_WADO` | `8` | Concurrent WADO instance fetches |
| `MESH_MAX_FACES` | `20000` | Per-label decimation ceiling (M3) |
| `SEGMENTATION_AUDIT_MESH_DOWNLOADS` | `false` | Audit every mesh/mask GET (M3) |
| `SEGMENTATION_GENERATE_DICOM_SEG` | `true` | Write `segmentation.dcm` after meshing (M4) |

## Local validation

Without Docker, run the test suites; they cover the HTTP surface and the
voxel-to-LPS pipeline with a synthetic CT:

```bash
# Backend orchestrator (8 tests)
pytest backend/tests/test_segmentation_api.py

# Segmenter microservice (15 tests across 4 files)
pytest services/segmenter/tests/

# Frontend MeshViewer (3 tests)
npm test -- src/components/Viewer/__tests__/MeshViewer.test.tsx
```

With Docker, the manual smoke is:

```bash
docker compose up -d --build
# wait for healthchecks (segmenter, backend, orthanc) to be green
# open http://localhost:5173 → log in → open a CT study →
# switch to "3D Modell" → "Generieren" with preset Bone
```

The mesh appears in roughly 30 s on a synthetic chest CT. The audit log
records the four events:

```sql
SELECT event_type, metadata
FROM audit_events
WHERE event_type LIKE 'segmentation_%'
ORDER BY timestamp DESC
LIMIT 10;
```

## License

The bone preset is pure HU thresholding and ships no third-party model
weights. The (deferred) TotalSegmentator integration is Apache 2.0; the
underlying nnU-Net weights are also Apache 2.0. Attribution renders inside
the viewer alongside the disclaimer banner once M2 lands.

