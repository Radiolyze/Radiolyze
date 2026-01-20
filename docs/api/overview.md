# API Uebersicht

Die UI nutzt HTTP und WebSocket APIs:

- REST: Report Management, QA, Audit
- WebSocket: Live Updates (ASR/AI Status)

## Versionierung

Alle Endpunkte sollten unter `/api/v1` gefuehrt werden.

## Auth

- JWT oder Session Tokens
- Optional mTLS fuer intra-cluster Kommunikation
