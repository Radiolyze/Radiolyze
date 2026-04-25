# Fast Reporting (CXR, <10 Minutes)

## Goal

Simple single case with rapid finding generation and automatic impression.

## Steps

1. **Queue Selection**: Radiologist starts a report from the worklist.
2. **Viewer Load**: CXR is loaded.
3. **Dictation**: Start microphone, capture findings via ASR.
4. **AI Draft**: Impression is generated automatically.
5. **QA Check**: Display status, show warning if applicable.
6. **Approval**: Approval dialog, signature.

## UI Components

- FindingsPanel (ASR, Confidence)
- ImpressionPanel (AI Draft)
- ProgressOverlay (ASR/AI/QA)
