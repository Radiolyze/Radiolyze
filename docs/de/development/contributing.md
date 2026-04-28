# Contributing-Leitfaden

Entwicklungsumgebung einrichten, Code nach Radiolyze-Standards schreiben und Änderungen mergen lassen.

---

## Vor dem Start

1. [Entwicklungssetup](setup.md) lesen — vollständigen Stack lokal zum Laufen bringen
2. [Styleguide](styleguide.md) lesen — UI-, Code- und Sprachkonventionen
3. Offene Issues prüfen bevor ein Duplikat erstellt wird
4. Für größere Änderungen (neue Features, Architekturänderungen): zuerst ein Issue öffnen

---

## Entwicklungsumgebung

```bash
# Vollständiger Stack (CPU-Modus)
docker compose up --build

# Nur Frontend
npm install && npm run dev   # → http://localhost:5173

# Nur Backend
cd backend && pip install -e ".[dev]" && uvicorn app.main:app --reload
```

---

## Branch-Strategie

| Branch-Typ | Benennung | Merged in |
|---|---|---|
| Feature | `feat/kurze-beschreibung` | `main` |
| Bugfix | `fix/kurze-beschreibung` | `main` |
| Dokumentation | `docs/kurze-beschreibung` | `main` |
| Hotfix | `hotfix/kurze-beschreibung` | `main` + Tag |

- Ein Branch pro Arbeitspaket
- Branches kurz halten (Merge innerhalb von Tagen)
- Vor PR auf `main` rebasen

---

## Commit-Messages

[Conventional Commits](https://www.conventionalcommits.org/) verwenden:

```
<typ>(<scope>): <kurze Beschreibung>
```

Typen: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `style`, `perf`

Beispiele:

```
feat(qa): regex_match-Regeltyp hinzufügen
fix(asr): leere Whisper-Antwort abfangen
docs(compliance): FMEA-Tabelle zu risk-management.md hinzufügen
```

---

## Code-Standards

### TypeScript / Frontend

- **Striktes TypeScript** — `strict: true`; kein `any` ohne Begründung
- **Keine neuen Abhängigkeiten** ohne Team-Review
- **Dark-Mode-kompatibel** — alle UI-Änderungen in hellem und dunklem Modus testen
- **Barrierefreiheit** — Tastaturfokus muss sichtbar sein; interaktive Elemente müssen zugängliche Labels haben
- **Kein PHI in Console-Logs** — `console.log(patientName)` ist niemals akzeptabel

### Python / Backend

- **Typannotationen auf allen öffentlichen Funktionen**
- **Kein nacktes `except:`** — immer spezifische Ausnahmen abfangen
- **Kein PHI in Log-Statements** — IDs und Hashes loggen, keine Namen oder Textinhalte
- **DB-Operationen** — SQLAlchemy-Session aus `deps.py` verwenden

---

## Pre-Commit-Checkliste

- [ ] `npm run build` ohne Fehler
- [ ] `cd backend && python -m pytest tests/ -v` alle bestanden
- [ ] Kein PHI in Log-Statements
- [ ] Tastaturkürzel funktionieren korrekt
- [ ] Dark Mode korrekt
- [ ] Audit-Events für neue signifikante Aktionen vorhanden
- [ ] Neue Umgebungsvariablen in `docs/en/development/setup.md` und `.env.example` dokumentiert
- [ ] API-Änderungen in `docs/en/api/` dokumentiert

---

## Pull-Request-Prozess

1. PR gegen `main` öffnen mit klarem Titel (Conventional-Commits-Format)
2. PR-Beschreibung muss enthalten:
   - Welches Problem gelöst wird
   - Wie manuell zu testen ist
   - Screenshots bei UI-Änderungen
3. Mindestens einen Reviewer zuweisen
4. Alle CI-Checks müssen vor dem Merge bestehen
5. Squash-Merge für saubere `main`-History

---

## Test-Anforderungen

- **Neue Backend-Logik**: Unit-Test in `backend/tests/`
- **Neue API-Endpunkte**: Smoke-Test-Eintrag in `scripts/smoke-backend.sh`
- **Sicherheitsrelevante Änderungen**: Peer-Review durch zweite Person

Siehe [Testing-Leitfaden](testing.md) für Test-Runner-Befehle.

---

## Sicherheitssensible Bereiche

| Bereich | Risiko | Was prüfen |
|---|---|---|
| `backend/app/auth.py` | Authentifizierungs-Bypass | JWT-Validierung, Token-Ablauf, Rollenprüfungen |
| `backend/app/asr_providers.py` | Audio-Datenhandling | Kein Audio auf Disk; kein PHI in Logs |
| `backend/app/audit.py` | Audit-Log-Integrität | Events bei allen erforderlichen Aktionen |
| `backend/app/qa_engine.py` | QA-Bypass | Regeln können nicht lautlos deaktiviert werden |
| Jedes Log-Statement | PHI-Leakage | Kein Name, Geburtsdatum, Patienten-ID, roher Befundtext |

---

## Dokumentation

- **Alle nutzerseitigen Änderungen** → relevante `docs/en/`-Seiten aktualisieren
- **DE-Übersetzungen** → passende `docs/de/`-Seiten aktualisieren
- **Neue Seiten** → zu `mkdocs.yml`-Nav + DE `nav_translations` hinzufügen
- **Docs lokal bauen** um tote Links zu finden:

```bash
pip install -r requirements-docs.txt
python3 -m mkdocs build --strict
```

---

## Verwandte Seiten

- [Entwicklungssetup](setup.md)
- [Styleguide](styleguide.md)
- [Testing-Leitfaden](testing.md)
- [ASR-Provider-Leitfaden](asr-providers.md)
- [QA-Regeln-Leitfaden](qa-rules.md)
