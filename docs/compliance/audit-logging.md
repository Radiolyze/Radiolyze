# Audit Logging

## Ziel

Audit Logs dokumentieren alle KI-gestuetzten Entscheidungen und menschlichen Eingriffe.

## Ist-Stand (Repo)

- Audit Events werden via `/api/v1/audit-log` in der Orchestrator DB gespeichert
- Felder aktuell: `event_type`, `actor_id`, `report_id`, `study_id`, `timestamp`, `metadata`
- Events werden im API Layer und Worker erzeugt (Queue + Inference)
- Metadata enthaelt optional `source` (`api`, `worker`, `client`)
- Input-Hash/Model-Version/Output-Summary sind fuer Inference, Impression, QA und ASR hinterlegt
  (ASR nutzt Audio-Hash + Laengen-Output, keine Transkripte)

## Mindestfelder

- Event Type (z.B. "asr_transcription", "report_approved")
- Actor ID (User oder "system")
- Report ID + Study ID
- Timestamp (UTC)
- Model Version (bei regelbasierten Checks: `qa-rules-v1`)
- Input Hash (kein PHI, z.B. Findings/Impression oder Audio-Blob)
- Output Summary (gekuerzt; darf keine PHI enthalten)
- Source (api/worker/client)

## Logging Punkte

1. Report Creation
2. Report Opened
3. ASR Completed
4. MedGemma Inference (queued/started/completed/failed)
5. QA Check
6. Radiologist Edit/Save
7. Report Finalized/Approved

## Beispiel

```json
{
  "event_type": "qa_passed",
  "actor_id": "system",
  "study_id": "st-123",
  "report_id": "r-123",
  "metadata": {
    "model_version": "medgemma-1.5-4b-it",
    "source": "api",
    "quality_score": 88
  },
  "timestamp": "2026-01-20T10:12:00Z"
}
```
