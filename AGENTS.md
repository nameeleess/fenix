# AGENTS.md — FÉNIX

This file is the repository-wide operating constitution for Codex on FÉNIX.

## 0. Mission

Continue FÉNIX from the real repository state without losing approved product decisions, history, data integrity, Design Freeze, Media Freeze, QA regressions, or release governance.

FÉNIX is not a greenfield rewrite.

## 1. Authority order

When sources conflict, use this order:

1. Explicit later decision by the user.
2. `docs/fenix/governance/CENTRAL_CUTOVER_RESOLUTIONS.md`.
3. Current formal decisions of CENTRAL.
4. `PROMPT MAESTRO — FÉNIX v2`.
5. Current approved domain handoffs:
   - Hoy / Rutina
   - Training
   - Nutrition
   - Progreso
6. QA handoff for validation policy.
7. Baseline functional source.
8. Historical engineering/QA artifacts.
9. Current implementation as evidence of state, never as authority to override a contract.

Do not silently reconcile an unresolved material contradiction.

## 2. Roles / ownership

- Hoy: orchestration and presentation. Owns daily routine/task semantics, not Training/Nutrition/Progress facts.
- Training: sessions, lifecycle, routines, exercises, sets, execution, scheduling/reprogramming, workout performance.
- Nutrition: meals, recipes, planning, consumption, macros, substitutions, appetite/volume, library and shopping semantics.
- Progreso: weight/body measurements, trends, adherence, Training streak and longitudinal derived analytics.
- CENTRAL: architecture, scope, conflicts, release, QA authorization and formal closure.
- Engineering/Codex: implementation only within authorized contracts.
- QA: independent adversarial validation; QA does not modify implementation or close a release.

## 3. Immutable platform constraints for current v2.1 work

- Database: `fenix-db`
- Schema: `5`
- Migrations: `NONE`
- Local-first / offline-first
- No login requirement
- No backend/cloud sync introduced for v2.1
- Production branch must remain untouched until CENTRAL explicitly authorizes release
- Stable production baseline commit: `deac3890f4d1b794cae8f3acde5a12bf7c35cf94`
- Stable production tag: `v2.0.0`

No reset, reseed, destructive repair, schema 6, or history rewrite.

## 4. History and identity invariants

Always separate:
`definition → planning → instance → execution → history`

Editing a reusable definition cannot silently rewrite historic execution.

Training session identity is not a calendar day. Multiple distinct formal sessions may share an effective date.

Nutrition Pre/Post Training meals bind to Training session identity, not merely date.

Completed/skipped Nutrition facts must not be automatically rewritten.

Training streak:
- unit = formal planned session instances, not days
- deterministic order = `scheduledDate → createdAt → id`
- completed increments
- scheduled rest neutral
- reprogrammed neutral until resolved
- omitted breaks
- incomplete breaks
- extra non-planned neutral
- accidental discarded start neutral

Preserve the historic unresolved session:
`775635cc-ec59-4b44-a566-d722ae4664d7`
`2026-09-04 · Lower B · pending`
Never auto-resolve it.

## 5. Design Freeze v2.1

Canonical package:
`FENIX_v2.1_GOLDEN_RENDERS_FINAL_26.zip`

SHA-256:
`0f797dd2962f44ec7ae82d46f770d6b70c462927ad6a938728ea86375056bffc`

There are exactly 26 approved individual Golden layouts.

Goldens are a strict visual contract, not inspiration.

Do not:
- edit Goldens to make implementation pass;
- substitute collages/posters;
- count capture existence as parity;
- add a global tactical CSS layer like `final-v2.css` to mask structural drift.

Visual parity must close 26/26 with evidence, including:
`STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION`

Accessibility, safe areas and compatibility may require minimal deviations; material visual deviation requires CENTRAL.

## 6. Media Freeze v2.1

Canonical result:
- 33/33 exercises mapped
- 26 RepDB
- 7 FÉNIX original
- RepDB package contract: `@repdb/exercises@2026.8.1`
- Curl femoral canonical visual: `RepDB leg-curl (lying canonical)`

The 7 FÉNIX custom exercises are:
- Remo T con pecho apoyado
- Curl Bayesian en polea
- Extensión de tríceps overhead en polea
- Open Book
- 90/90 Hip Switch
- Wall Slides
- Respiración y movilidad suave

Final custom media must be proper final media; schematic placeholders are fallback only.

ExerciseMotion must be genuinely exercise-specific 33/33. Unique IDs, timings or amplitudes alone do not satisfy specificity if exercises still share the same complete kinematic scene.

## 7. Current migration cutover status

The exact local working tree is intentionally **UNKNOWN** until physical inspection.

Reason:
- a rejected `v2.1.0-rc.1` source/evidence pair exists;
- CENTRAL then opened three HIGH blockers;
- several corrective wrappers were attempted;
- the latest deterministic repair was reported by the user as not working;
- exact post-attempt PowerShell output was not captured in the canonical handoffs.

Therefore NEVER assume that the latest correction is applied or unapplied.

Open CENTRAL blockers to close as one consolidated correction:
- `CENTRAL-RC1-001` Visual Parity 26/26 not actually closed
- `CENTRAL-RC1-002` ExerciseMotion not genuinely specific 33/33
- `CENTRAL-RC1-003` 7 custom FÉNIX media assets still schematic / not final

An intermediate Nutrition `Recetas` E2E failure is historical evidence whose present status is UNKNOWN until reproduced against the physical tree. Do not invent a fourth blocker unless it reproduces.

## 8. Authorized execution after migration

CENTRAL authorizes Codex to:

1. perform a read-only physical audit of the local repo;
2. preserve a pre-Codex forensic snapshot;
3. determine which corrective changes are already applied, partial, absent or regressed;
4. continue only the consolidated closure of `CENTRAL-RC1-001/002/003`;
5. run complete self-test + PRE-QA adversarial/root-cause + shadow QA;
6. produce one corrected candidate for CENTRAL.

Candidate label reserved by CENTRAL:
`v2.1.0-rc.1.1`

Do not change versioning until the physical audit is complete. Before sealing the corrected candidate, align version to `v2.1.0-rc.1.1` and rerun all relevant gates.

No new feature backlog is authorized during this closure.

## 9. Mandatory Phase 0 — read-only repo audit

Before any source edit, report and preserve:

- `git status --short`
- current branch
- HEAD
- local/remote `production` ref
- package version
- complete tracked diff
- untracked files
- current schema definition
- presence/current state of:
  - visual harness
  - visual parity matrix
  - 26 Goldens
  - ExerciseMotion
  - media registry
  - 7 FÉNIX custom assets
  - Training/Nutrition/Hoy/Progreso/Settings presentation
  - current v2.1 evidence
- whether intermediate E2E Nutrition Recetas failure reproduces

Create an evidence snapshot outside destructive Git operations:
- binary diff
- untracked file inventory
- source/evidence metadata
- ideally a repo snapshot excluding `.git` and `node_modules`

Do NOT use:
- `git reset --hard`
- `git clean`
- destructive checkout
- reseed
- reset DB
- production changes

## 10. Root-cause closure

For every defect:
`reproduce → root cause → fix → horizontal sibling sweep → regression test → rerun gate`

Do not patch one symptom while leaving the class open.

For mutable concurrent state prefer:
`transaction → reread current → validate → atomic mutation → version++ → commit → publish freshness`

Avoid:
`read outside transaction → compute → later update`

## 11. Mandatory gates before CENTRAL handoff

At minimum:
- clean dependency install where applicable
- TypeScript
- production build
- lint zero-warning policy where current contract requires it
- v2.1 domain/PRE-QA suites
- complete CORE regression
- official 759-record backup roundtrip
- E2E
- offline/reload semantics
- 26 independent visual captures
- real Golden parity 26/26
- visual matrix no `PENDING`
- custom media final 7/7
- motion specificity 33/33
- media registry 33/33
- concurrency/negative/fault tests
- backup/restore pre/postvalidation
- `git diff --check`
- production untouched

## 12. Delivery

Deliver one candidate to CENTRAL with:
- SOURCE bundle
- EVIDENCE bundle
- SHA-256 for both
- exact diff/changed-files manifest
- root-cause report for RC1-001/002/003
- visual side-by-side 26/26
- visual parity matrix 26/26
- media registry
- motion specificity evidence
- build/lint/test results
- CORE + 759 evidence
- schema 5 / migrations NONE
- explicit production-untouched statement

Do NOT:
- commit final candidate
- tag
- release
- push production
- send directly to QA independent

Wait for CENTRAL.

## 13. STOP CONDITIONS

Stop and return to CENTRAL only for material contract decisions, including:
- schema >5 or migration need
- backend/cloud requirement
- ownership change
- new/changed domain state
- Training session identity change
- streak semantic change
- Nutrition Pre/Post semantic change
- history rewrite
- impossible Golden vs functional-contract conflict
- media/license conflict that cannot be solved under current contract
- need to touch production
- destructive data repair/reset
- new unresolved contradiction among non-superseded sources

CSS defects, stale tests, locators, path errors, deterministic QA fixtures, presentation refactors and source mapping bugs are not STOPs when they can be fixed within current contracts.

## 14. User interaction

The user is not a professional programmer.

Minimize manual steps. Prefer Codex executing the full workflow directly.

When user action is genuinely necessary, present exactly:
`INTERVENCIÓN NECESARIA`
with one clear action, where to do it, expected result and what to return.
