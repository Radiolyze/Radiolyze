# Audit Logging

## Ziel

Audit Logs dokumentieren alle KI-gestuetzten Entscheidungen und menschlichen Eingriffe.

## Ist-Stand (Repo)

- Audit Events werden via `/api/v1/audit-log` in der Orchestrator DB gespeichert
- Felder aktuell: `event_type`, `actor_id`, `report_id`, `study_id`, `timestamp`, `metadata`
- Hashing/Model-Versionen sind noch nicht verpflichtend (Phase 3)

## Mindestfelder

- Event Type (z.B. "asr_completed", "report_finalized")
- Actor ID (User oder "system")
- Report ID + Study ID
- Timestamp (UTC)
- Model Version
- Input Hash (kein PHI)
- Output Summary (gekuerzt)

## Logging Punkte

1. Report Creation
2. ASR Completed
3. MedGemma Inference
4. QA Check
5. Radiologist Edit
6. Report Finalized

## Beispiel

```json
{
  "event_type": "qa_passed",
  "actor_id": "system",
  "study_id": "st-123",
  "report_id": "r-123",
  "model_version": "medgemma-1.5-4b-it",
  "timestamp": "2026-01-20T10:12:00Z",
  "changes": {
    "quality_score": 88
  }
}
```
