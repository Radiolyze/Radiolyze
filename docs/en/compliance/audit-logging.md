# Audit Logging

## Purpose

Audit logs document all AI-assisted decisions and human interventions.

## Current State (Repo)

- Audit events are stored via `/api/v1/audit-log` in the orchestrator database
- Current fields: `event_type`, `actor_id`, `report_id`, `study_id`, `timestamp`, `metadata`
- Events are generated in the API layer and worker (queue + inference)
- Metadata optionally contains `source` (`api`, `worker`, `client`)
- Input hash / model version / output summary are recorded for inference, impression, QA, and ASR
  (ASR uses audio hash + length output, no transcripts)

## Minimum Required Fields

- Event Type (e.g. "asr_transcription", "report_approved")
- Actor ID (user or "system")
- Report ID + Study ID
- Timestamp (UTC)
- Model Version (for rule-based checks: `qa-rules-v1`)
- Input Hash (no PHI, e.g. findings/impression or audio blob)
- Output Summary (truncated; must not contain PHI)
- Source (api/worker/client)

## Logging Points

1. Report Creation
2. Report Opened
3. ASR Completed
4. MedGemma Inference (queued/started/completed/failed)
5. QA Check
6. Radiologist Edit/Save
7. Report Finalized/Approved

## Example

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
