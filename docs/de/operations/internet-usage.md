# Internetnutzung Strategie

## Ziele

- On-Prem Betrieb ohne externe Datenabfluesse
- EU-konforme Verarbeitung (keine PHI nach extern)
- Nachvollziehbare Updates und Audit Trail

## Grundsaetze

1. Inferenz bleibt lokal (MedGemma/MedASR).
2. Keine externen API Calls aus dem Produktivnetz.
3. Internetzugang nur fuer kontrollierte Updates.
4. Telemetrie und Auto-Updates sind deaktiviert.

## Zulaessige Egress-Verbindungen

- Paket- und Modell-Updates ueber erlaubte Mirror/Registry
- Zeitfenster und Change-Approval erforderlich
- Protokollierung aller Downloads (Hash + Version)

## Modell-Lifecycle

- Modelle werden in eine interne Registry gespiegelt
- Signatur/Checksum verifizieren
- Freigabeprozess vor Deployment

## Betrieb und Monitoring

- Egress-Proxy/Allowlist auf Firewall
- Audit Logs fuer Update-Events
- Regelmaessige Review der Abhaengigkeiten

## Ausnahmen

- Notfall-Patches nur mit Security Approval
- Dokumentation der Abweichung im Audit Log
