# QA-Regeln-Leitfaden

Funktionsweise der QA-Rule-Engine, Verwaltung von Regeln über die Datenbank und Hinzufügen eigener Regeltypen.

---

## Übersicht

Die QA-Engine läuft automatisch bei jeder Berichtsspeicherung. Sie prüft Befundtext und Impressionstext gegen einen konfigurierbaren Regelsatz, der in der `qa_rules`-PostgreSQL-Tabelle gespeichert ist. Ergebnisse werden vor der Freigabe inline in der Befundungs-UI angezeigt.

**Engine-Quelle:** `backend/app/qa_engine.py`  
**Datenbankmodell:** `backend/app/models.py` (`QARule`)

---

## Regel-Datenmodell

```python
class QARule(Base):
    id: str           # UUID Primärschlüssel
    name: str         # Anzeigename in der UI
    rule_type: str    # Evaluator-Typ (siehe Tabelle)
    config_json: dict # Typenspezifische Konfiguration
    is_active: bool   # Ein-/Ausschalten ohne Löschen
    severity: str     # "warn" oder "fail"
    description: str  # Optionale Erklärung
```

`severity`:
- `warn` — zeigt gelbe Warnung; blockiert Freigabe nicht
- `fail` — zeigt roten Fehler; blockiert Freigabe bis behoben

---

## Eingebaute Regeltypen

| `rule_type` | Was geprüft wird | Pflicht-Config-Schlüssel |
|---|---|---|
| `required_keyword` | Bestimmtes Wort/Phrase muss vorhanden sein | `keyword`, `target`, `message` |
| `min_length` | Text muss mindestens N Zeichen haben | `min_length`, `target`, `message` |
| `max_length` | Text darf N Zeichen nicht überschreiten | `max_length`, `target`, `message` |
| `regex_match` | Text muss Regex-Muster entsprechen | `pattern`, `target`, `message` |
| `field_present` | Feld darf nicht leer sein | `target`, `message` |
| `critical_finding` | Keyword löst Kritischer-Befund-Alarm aus | `keyword`, `finding_type` |

**`target`-Werte:** `"findings"` oder `"impression"`

---

## Regeln über SQL verwalten

### Alle aktiven Regeln auflisten

```sql
SELECT id, name, rule_type, severity, is_active
FROM qa_rules ORDER BY created_at;
```

### Neue Regel hinzufügen

```sql
INSERT INTO qa_rules (id, name, rule_type, config_json, is_active, severity, description, created_at)
VALUES (
  gen_random_uuid()::text,
  'Impression muss vorhanden sein',
  'field_present',
  '{"target": "impression", "message": "Impression-Feld ist leer. Bitte vor Freigabe ausfüllen."}',
  true,
  'fail',
  'Stellt sicher, dass Impression nicht leer bleibt',
  NOW()::text
);
```

### Regel deaktivieren ohne Löschen

```sql
UPDATE qa_rules SET is_active = false WHERE name = 'Meine Regel';
```

### Via Docker Compose ausführen

```bash
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT id, name, rule_type, severity, is_active FROM qa_rules;"
```

---

## Regelbeispiele

### Mindest-Impressionslänge

```json
{
  "rule_type": "min_length",
  "severity": "warn",
  "config_json": {
    "target": "impression",
    "min_length": 20,
    "message": "Impression ist sehr kurz. Bitte prüfen ob vollständig."
  }
}
```

### Kein Platzhaltertext

```json
{
  "rule_type": "regex_match",
  "severity": "fail",
  "config_json": {
    "target": "impression",
    "pattern": "\\[Platzhalter\\]|TODO|FIXME",
    "case_sensitive": false,
    "message": "Impression enthält Platzhaltertext. Vor Freigabe entfernen."
  }
}
```

---

## Kritische Befunde

Die Funktion `detect_critical_findings()` scannt Befund- und Impressionstext auf Keywords, die sofortige Kommunikation mit dem überweisenden Arzt erfordern.

**Standard-Kritische-Befund-Keywords** (immer aktiv, hardcodiert):

| Keyword | Befundtyp |
|---|---|
| `pneumothorax` | Pneumothorax |
| `spannungspneumothorax` | Spannungspneumothorax |
| `lungenembolie` | Lungenembolie |
| `aortendissektion` | Aortendissektion |
| `intrakranielle blutung` | Intrakranielle Blutung |
| `schlaganfall` | Schlaganfall |
| `perikarderguss` | Perikarderguss |
| `freie luft` | Freie abdominelle Luft |

Zusätzliche kritische Befundmuster via `qa_rules`-Tabelle mit `rule_type = "critical_finding"` hinzufügbar.

---

## Eigenen Regeltyp hinzufügen

1. Evaluator-Funktion in `backend/app/qa_engine.py` schreiben
2. In `_EVALUATORS`-Dict registrieren
3. Backend-Container neu bauen: `docker compose build backend && docker compose restart backend`
4. Regel via SQL mit neuem Typ einfügen

Keine Frontend-Änderungen erforderlich — die UI rendert alle Regelergebnisse generisch.

---

## QA-Score-Berechnung

```
Score = (bestandene_Prüfungen / gesamt_Prüfungen) × 100
```

- ≥ 90: grün
- 70–89: gelb
- < 70: rot

---

## QA-Ergebnisse einsehen

```bash
# QA-Pass-Rate (letzte 7 Tage)
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT status, COUNT(*) FROM qa_results
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY status;"
```

---

## Verwandte Seiten

- [Compliance-Checkliste](../compliance/checklist.md)
- [Risikomanagement](../compliance/risk-management.md)
- [Observability](../operations/observability.md)
- [Entwicklungssetup](setup.md)
