# CURRENT_STATE.md — FÉNIX migration cutover

**Cutover date:** 2026-09-08  
**Authority:** CENTRAL  
**Status:** MIGRATION READY / CODEX PHYSICAL AUDIT REQUIRED

## Stable production

- Release: `FÉNIX v2.0.0 CORE STABLE`
- Commit: `deac3890f4d1b794cae8f3acde5a12bf7c35cf94`
- Tag: `v2.0.0`
- Production branch: `production`
- Source SHA-256: `f98d902d245dcd3cc0a6db5eca4d40afa4b1bca3e7f7f00a9238d16f32fab617`
- DB: `fenix-db`
- Schema: `5`
- Migrations: `NONE`
- Official backup: 759 records
- Backup SHA-256: `3686d872e64d83f7fea7053fab9f2e32508bd525c50180431a5b437bad8e8732`

Production is the safe rollback baseline and must not be changed during RC correction.

## Deployment known

- GitHub repository: `nameeleess/fenix`
- Cloudflare Pages project historically: `fenix`
- stable Pages domain observed: `fenix-ehy.pages.dev`
- deployment was configured so `production` acts as the production release pointer
- v2.0 PWA was physically smoke-tested on iPhone: Hoy / Training / Nutrition / Progreso / offline passed
- exact current operational data contents on the iPhone are not a repository source of truth

## v2.1

Target final release:
`v2.1.0`

Corrected candidate reserved by CENTRAL:
`v2.1.0-rc.1.2`

Previous candidate `v2.1.0-rc.1.1` was rejected by CENTRAL for a non-material visual-parity evidence gate; Motion and Media remain provisionally accepted and are under no-regression validation.

Rejected reference candidate:
- SOURCE SHA: `3dcc4f61552eafc2ae868dc6818652b34756d37db882b15285ca9864fcf54ee6`
- EVIDENCE SHA: `a305aab3ada4922c4d5529b0e094cb10af3f78387991579ab15e17049417c2c8`

That candidate had broad automated PASS evidence but was rejected by CENTRAL for three HIGH classes.

## Open blockers

### CENTRAL-RC1-001 — REOPENED FOR rc.1.2
Real Golden parity not closed.

Historical automated result `26/26 screenshots captured` is not sufficient.

Required:
- 26 Goldens vs 26 actual states
- side-by-side evidence
- 8-axis matrix
- zero PENDING
- structural parity, not only CSS approximation

### CENTRAL-RC1-002 — PROVISIONAL ACCEPTANCE / NO-REGRESSION
ExerciseMotion is not genuinely specific 33/33.

Required:
- exercise-specific body orientation / stance / equipment / trajectory / endpoints as relevant
- no complete generic family scene merely parameterized differently

### CENTRAL-RC1-003 — PROVISIONAL ACCEPTANCE / NO-REGRESSION
7 FÉNIX custom exercise assets remain schematic/not final.

Required:
- proper final start/peak or equivalent explanatory media
- anatomically/mechanically coherent
- consistent with catalog
- offline
- original/licensed safely
- schematic SVGs only as fallback

## Intermediate Nutrition E2E signal

A later intermediate Engineering/Nutrition state reported an E2E failure when navigating:
`Nutrition → Recetas`

That report is temporally between other repair attempts and the final working-tree state is unknown.

Policy:
- reproduce it during Phase 0/first test run;
- if reproduced, close it as part of the same root-cause sweep;
- if not reproduced, preserve as historical evidence;
- do not invent a separate CENTRAL blocker from stale evidence.

## Exact local working tree

**UNKNOWN.**

Known local repo path:
`C:\Users\Amin\Projects\fenix`

Known toolchain:
- Windows / PowerShell
- Node `v24.19.0`
- npm `11.17.0`

The last deterministic corrective wrapper was reported as “no funcionó”, but its exact terminal output was not captured in the canonical handoff.

Codex must physically inspect before edits.

## Migration freeze lifted only for scoped closure

The six previous specialist chats are now frozen as sources.

Codex is authorized to continue only:
- physical state recovery/audit;
- closure of RC1-001/002/003;
- any reproduced implementation defect necessary to complete that closure;
- full regression/evidence.

No new product scope until CENTRAL accepts the corrected candidate.
