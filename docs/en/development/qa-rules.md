# QA Rules Guide

How the QA rule engine works, how to manage rules via the database, and how to add custom rule types.

---

## Overview

The QA engine runs automatically every time a report is saved. It checks findings and impression text against a configurable set of rules stored in the `qa_rules` PostgreSQL table. Results appear inline in the reporting UI before sign-off.

**Engine source:** `backend/app/qa_engine.py`  
**Database model:** `backend/app/models.py` (`QARule`)  
**Rule evaluation:** `evaluate_rules()` → returns `(checks, warnings, failures, score)`

---

## Rule Data Model

```python
class QARule(Base):
    id: str           # UUID primary key
    name: str         # Display name shown in UI
    rule_type: str    # Evaluator type (see table below)
    config_json: dict # Type-specific configuration
    is_active: bool   # Toggle without deleting
    severity: str     # "warn" or "fail"
    description: str  # Optional explanation
    created_at: str
```

`severity`:
- `warn` — shows a yellow warning; does not block approval
- `fail` — shows a red error; blocks approval until resolved

---

## Built-in Rule Types

| `rule_type` | What it checks | Required config keys |
|---|---|---|
| `required_keyword` | A specific word or phrase must appear | `keyword`, `target`, `message` |
| `min_length` | Text must be at least N characters | `min_length`, `target`, `message` |
| `max_length` | Text must not exceed N characters | `max_length`, `target`, `message` |
| `regex_match` | Text must match a regex pattern | `pattern`, `target`, `message` |
| `field_present` | Field must not be empty | `target`, `message` |
| `critical_finding` | Keyword triggers a critical finding alert | `keyword`, `finding_type` |

**`target` values:**
- `"findings"` — evaluates `findings_text`
- `"impression"` — evaluates `impression_text`

---

## Managing Rules via SQL

### List all active rules

```sql
SELECT id, name, rule_type, severity, is_active
FROM qa_rules
ORDER BY created_at;
```

### Add a new rule

```sql
INSERT INTO qa_rules (id, name, rule_type, config_json, is_active, severity, description, created_at)
VALUES (
  gen_random_uuid()::text,
  'Impression must be present',
  'field_present',
  '{"target": "impression", "message": "Impression field is empty. Add a clinical impression before approving."}',
  true,
  'fail',
  'Ensures impression is not left blank',
  NOW()::text
);
```

### Disable a rule without deleting

```sql
UPDATE qa_rules SET is_active = false WHERE name = 'My Rule';
```

### Change severity from warn to fail

```sql
UPDATE qa_rules SET severity = 'fail' WHERE name = 'My Rule';
```

### Delete a rule

```sql
DELETE FROM qa_rules WHERE name = 'My Rule';
```

### Run these via Docker Compose

```bash
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT id, name, rule_type, severity, is_active FROM qa_rules;"
```

---

## Rule Examples

### Minimum impression length

```json
{
  "rule_type": "min_length",
  "name": "Impression minimum length",
  "severity": "warn",
  "config_json": {
    "target": "impression",
    "min_length": 20,
    "message": "Impression is very short. Please verify it is complete."
  }
}
```

### Required section keyword (findings)

```json
{
  "rule_type": "required_keyword",
  "name": "Heart size mentioned",
  "severity": "warn",
  "config_json": {
    "target": "findings",
    "keyword": "heart",
    "case_sensitive": false,
    "message": "Findings do not mention cardiac size. Intentional?"
  }
}
```

### No placeholder text

```json
{
  "rule_type": "regex_match",
  "name": "No placeholder text",
  "severity": "fail",
  "config_json": {
    "target": "impression",
    "pattern": "\\[placeholder\\]|\\[insert\\]|TODO|FIXME",
    "case_sensitive": false,
    "message": "Impression contains placeholder text. Remove before approving."
  }
}
```

### Custom critical finding keyword

```json
{
  "rule_type": "critical_finding",
  "name": "Tension pneumothorax alert",
  "severity": "critical",
  "config_json": {
    "keyword": "tension pneumothorax",
    "finding_type": "Tension Pneumothorax"
  }
}
```

---

## Critical Finding Detection

The QA engine has a separate function, `detect_critical_findings()`, that scans both findings and impression text for keywords indicating findings that require immediate communication to the referring physician.

**Default critical finding keywords** (hardcoded in `qa_engine.py`, always active):

| Keyword | Finding type |
|---|---|
| `pneumothorax` | Pneumothorax |
| `tension pneumothorax` / `spannungspneumothorax` | Tension Pneumothorax |
| `pulmonary embolism` / `lungenembolie` | Pulmonary Embolism |
| `aortic dissection` / `aortendissektion` | Aortic Dissection |
| `intracranial hemorrhage` / `intrakranielle blutung` | Intracranial Hemorrhage |
| `stroke` / `schlaganfall` | Stroke |
| `pericardial effusion` / `perikarderguss` | Pericardial Effusion |
| `free air` / `freie luft` | Free Abdominal Air |

Additional critical finding patterns can be added via the `qa_rules` table with `rule_type = "critical_finding"`. DB-configured rules are checked first; default patterns cover any keyword not already matched by a DB rule.

---

## Adding a Custom Rule Type

To add an evaluator that is not built in:

1. Open `backend/app/qa_engine.py`
2. Write an evaluator function:

```python
def _eval_no_negation(text: str, config: dict) -> bool:
    """Fail if text contains negation immediately before a required keyword."""
    keyword = config.get("keyword", "")
    negation_pattern = rf"\b(no|not|without|excluding)\s+{re.escape(keyword)}"
    return not re.search(negation_pattern, text, re.IGNORECASE)
```

3. Register it in `_EVALUATORS`:

```python
_EVALUATORS = {
    "required_keyword": _eval_required_keyword,
    "min_length": _eval_min_length,
    # ... existing evaluators ...
    "no_negation": _eval_no_negation,  # add here
}
```

4. Rebuild the backend container:

```bash
docker compose build backend && docker compose restart backend
```

5. Insert a rule using the new type via SQL.

No frontend changes are needed — the UI renders all rule results generically.

---

## QA Score Calculation

The overall QA score is:

```
score = (passed_checks / total_checks) × 100
```

Where `total_checks` excludes the synthetic `qa-overall` summary check.

The score appears in:
- The QA panel in the report workspace (colour-coded: ≥90 green, 70–89 yellow, <70 red)
- The analytics dashboard (average score over time)
- The `qa_results` database table for audit purposes

---

## Viewing QA Results

```bash
# Last 10 QA results for a specific study
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT r.id, q.status, q.quality_score, q.warnings
      FROM qa_results q JOIN reports r ON r.id = q.report_id
      WHERE r.study_id = 'YOUR-STUDY-ID'
      ORDER BY q.created_at DESC LIMIT 10;"

# QA pass rate overall (last 7 days)
docker compose exec postgres psql -U postgres radiolyze \
  -c "SELECT status, COUNT(*) FROM qa_results
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY status;"
```

---

## Related

- [Compliance Checklist](../compliance/checklist.md) — QA as Art. 14 human oversight evidence
- [Risk Management](../compliance/risk-management.md) — QA mitigates R-01 (laterality errors)
- [Observability](../operations/observability.md) — QA metrics in monitoring
- [Development Setup](setup.md) — running the backend locally
