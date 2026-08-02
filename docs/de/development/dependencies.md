# Dependency-Policy

Wie Dependency-Updates geprüft werden, welche Upgrades bewusst zurückgehalten werden und warum eine grüne Pipeline allein kein Merge-Grund ist.

---

## Die entscheidende Regel

**Ein grüner CI-Lauf ist ein Indiz, kein Beweis.**

Die Checks von Radiolyze fangen die strukturellen Fehler ab: eine unauflösbare
Installation, einen umbenannten Export, einen kaputten Test. Sie fangen *nicht*
die Dependency ab, die sauber installiert, sauber typcheckt — und sich zur
Laufzeit anders verhält. Genau diese Form haben mehrere der unten
zurückgehaltenen Upgrades.

Vor dem Merge eines Dependency-Bumps ist zu klären, um welchen der drei Fälle es
sich handelt:

| Fehlerart | Erkannt durch | Beispiel |
|---|---|---|
| Installationskonflikt | `npm ci` / `pip install` | `@cornerstonejs/dicom-image-loader` v5 gegen core v4 |
| Typ-/API-Bruch | `npm run typecheck` | `react-resizable-panels` v4 hat seine Exports umbenannt |
| **Stille Verhaltensänderung** | **nichts** | `tailwind-merge` v3 löst Tailwind-3-Klassen falsch auf |

Die dritte Zeile braucht einen Menschen.

---

## Was Dependabot konfiguriert ist zu tun

`.github/dependabot.yml` deckt sechs Ökosysteme wöchentlich ab: npm (`/`), pip
(`/backend`, `/services/segmenter`, `/docs`), GitHub Actions und die
Hook-Revisionen von pre-commit.

Zwei Mechanismen bestimmen, was ankommt:

**Gruppen** — Pakete, die sich nur gemeinsam auflösen lassen, kommen als ein PR:

- `@radix-ui/*` — 27 Pakete, die einander folgen
- `@cornerstonejs/*` — core, tools und dicom-image-loader teilen eine Versionslinie
- `opentelemetry-*` — SDK (1.4x) und Instrumentation (0.6xb0) sind aneinander
  gepinnt; einzeln aufgeteilt ist jedes davon ein pip-Konflikt
- `ruff` / `mypy` / `pytest*` — Backend-Dev-Tooling
- Alle GitHub Actions

**Ignores** — bewusst zurückgehaltene Majors. Zu jedem existiert ein
Tracking-Issue; der Eintrag wird entfernt, wenn die Migration landet. Siehe
nächster Abschnitt.

---

## Bewusst zurückgehalten

| Paket | Gehalten auf | Blockiert durch | Issue |
|---|---|---|---|
| `tailwind-merge` | `<3` | v3 lässt Tailwind-3-Support fallen; muss zusammen mit einer Tailwind-4-Migration landen | [#197](https://github.com/Radiolyze/Radiolyze/issues/197) |
| `eslint` | `<10` | Upstream: `eslint-plugin-jsx-a11y` unterstützt ESLint 10 nicht | [#196](https://github.com/Radiolyze/Radiolyze/issues/196) |
| `vite` | `<8` | Peer-Range von `lovable-tagger` deckelt Vite auf `<8` | [#194](https://github.com/Radiolyze/Radiolyze/issues/194) |
| `@cornerstonejs/*` | `<5` | Braucht Änderungen an `vite.config.ts` und `scripts/bundle-cornerstone-worker.mjs` | [#195](https://github.com/Radiolyze/Radiolyze/issues/195) |
| `pydicom` (Segmenter) | `<3` | `pydicom-seg` importiert `SegmentationStorage` über einen Pre-3.0-Pfad und ist unmaintained | [#199](https://github.com/Radiolyze/Radiolyze/issues/199) |

`tailwind-merge` ist der lehrreiche Fall. Das v3-Release lässt den
Tailwind-3-Support fallen, deklariert aber keine `peerDependencies`, ist an
keiner Stelle typ-relevant, und kein Test prüft die gemergte Klassenausgabe. Der
Bump installiert sauber, CI wird grün — und `cn()` löst danach Klassenkonflikte
in der gesamten Komponentenbibliothek falsch auf: visuelle Regressionen ohne
erkennbaren Verursacher. Deshalb existiert ein Ignore-Eintrag und nicht bloß
eine Notiz „beim Review aufpassen".

`pydicom` hat im Segmenter dieselbe Form: Der Import ist lazy und der Writer ist
in Tests über `_set_writer_for_testing` gestubbt — ein pydicom-3-Bump zerlegt
also den DICOM-SEG-Export zur Laufzeit, während alle Tests weiter grün sind.

---

## Einen Bump reviewen

**1. Einordnen.**

- Patch oder Minor innerhalb des aktuellen Majors → die Checks unten reichen meist.
- Major → bis zum Gegenbeweis von einer Migration ausgehen. Zuerst die Release
  Notes auf einen Breaking-Changes-Abschnitt lesen, dann den Diff.
- Ein `>=`-Floor-Bump in `services/segmenter/requirements.txt` → das sind untere
  Schranken, keine Pins. CI und Dockerfile installieren ohnehin bereits das
  neueste Release; ein höherer Floor ändert, was *erlaubt* ist, nicht, was
  installiert wird.

**2. Die Checks laufen lassen, die die Änderung brechen kann.**

```bash
# Frontend
npm ci && npm run bundle:worker
npm run typecheck && npm run lint && npm run format:check
npm run test
npm run build          # findet Bundling-/Chunking-Regressionen, die typecheck nicht sieht

# Backend
cd backend
ruff check . && ruff format --check .
python -m pytest tests/ -v

# Segmenter
cd services/segmenter && python -m pytest tests/ -v

# Docs
python3 -m mkdocs build --strict
```

**3. Fragen, was keinen Test hat.** Die Bereiche, die CI nicht erreicht:

- **Der DICOM-Viewer** — es gibt keinen WebGL-Rendering-Test. Jede Änderung an
  `@cornerstonejs/*` oder `@kitware/vtk.js` braucht einen manuellen Durchgang:
  Serienladen, MPR und Segmentierungs-Overlay.
- **Gerendertes Styling** — kein Test prüft gemergte Tailwind-Klassen. Alles, was
  `tailwindcss`, `tailwind-merge` oder `class-variance-authority` berührt,
  braucht ein visuelles Review der Hauptrouten in hellem und dunklem Theme.
- **DICOM-SEG-Export** — in den Segmenter-Tests gestubbt.

**4. Riskante Bumps in einen eigenen Commit legen**, damit eine Regression
revertiert werden kann, ohne den Rest eines abgearbeiteten Backlogs aufzutrennen.

---

## Pins, die Beobachtung brauchen

Einige Versionen sind an mehr als einer Stelle gepinnt — oder an einer Stelle,
an der kein Check bemerken würde, dass sie veraltet:

| Pin | Wo | Absicherung |
|---|---|---|
| `ruff`, zweimal | `backend/requirements-dev.txt` **und** `.pre-commit-config.yaml` | `scripts/check-ruff-pin-sync.sh`, läuft in CI |
| `@kitware/vtk.js` | `package.json` — **exakter** Peer von `@cornerstonejs/core` und `tools` | `npm ci` schlägt bei Abweichung fehl |
| Cornerstone-Worker-Pfad | `scripts/bundle-cornerstone-worker.mjs` greift auf `node_modules/@cornerstonejs/dicom-image-loader/dist/esm/` zu | `npm run bundle:worker` in CI |
| torch / totalsegmentator | `services/segmenter/requirements.txt` — nur Floors, Segmenter-Images sind über Rebuilds hinweg **nicht** reproduzierbar | keine |

Die `ruff`-Zeile ist die unangenehme. Dependabot sieht die beiden Pins über
verschiedene Ökosysteme — `pip` für `requirements-dev.txt`, `pre-commit` für die
Hook-Rev — und schlägt sie deshalb als zwei PRs vor, die Tage auseinander landen
können. Dazwischen formatieren Hook und CI mit unterschiedlichen ruff-Versionen:
Der Hook schreibt eine Datei um, die die Pipeline anschließend ablehnt. **Die
beiden ruff-PRs gemeinsam mergen**; der CI-Guard lässt den Build so lange
fehlschlagen, wie sie auseinanderliegen.

---

## Wenn ein Bump nicht landen kann

Nicht offen liegen lassen, damit er wöchentlich neu vorgeschlagen wird. Stattdessen:

1. Einen `ignore`-Eintrag in `.github/dependabot.yml` anlegen, auf den blockierten
   Bereich begrenzt (`versions: [">=3"]`), mit einem Kommentar, der das *Warum*
   festhält — nicht nur das *Dass*.
2. Ein Tracking-Issue öffnen: Blocker, Migrationsumfang und wie verifiziert würde.
3. Den Dependabot-PR mit Link auf das Issue schließen.
4. Die Zeile in die Tabelle oben aufnehmen.

Der Ignore-Eintrag wird in demselben PR entfernt, der die Migration durchführt.

---

## Verwandt

- [Contributing-Leitfaden](contributing.md)
- [Testing-Leitfaden](testing.md)
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
