# CENTRAL_CUTOVER_RESOLUTIONS.md

**Date:** 2026-09-08  
**Purpose:** eliminate migration ambiguities before Codex resumes execution.

## CUTOVER-01 — Migration architecture

FÉNIX execution migrates to Codex. Previous specialist chats become frozen source material.

Codex is not a new product authority. CENTRAL remains release/change authority.

## CUTOVER-02 — Physical repo beats stale intermediate snapshots

The exact current `main` working tree is UNKNOWN because the latest corrective wrapper outcome is not fully captured.

Codex must inspect the physical repository without destructive commands.

No prior source bundle may be blindly restored over the working tree.

## CUTOVER-03 — v2.0.0 stable baseline

Formal stable release:
- commit/tag `deac3890f4d1b794cae8f3acde5a12bf7c35cf94` / `v2.0.0`
- production branch points to that baseline
- source SHA `f98d902d...`
- schema 5 / no migrations

This is the rollback reference, not a command to reset to it.

## CUTOVER-04 — corrected candidate label

The next candidate produced after Codex closes current blockers is reserved as:

`v2.1.0-rc.1.1`

Codex does not need to mutate version before Phase 0. Before sealing the corrected candidate, align version and rerun all version-sensitive gates.

## CUTOVER-05 — current blockers

Exactly three CENTRAL blockers are formally open at cutover:
- CENTRAL-RC1-001
- CENTRAL-RC1-002
- CENTRAL-RC1-003

The intermediate Nutrition E2E `Recetas` failure must be reproduced. It becomes an active defect only if it reproduces on the physical current state.

## CUTOVER-06 — Design authority

`FENIX_v2.1_GOLDEN_RENDERS_FINAL_26.zip`
SHA `0f797dd...`

is immutable visual authority for v2.1.

Older layout explorations, posters, collages and flexible render-reference language are superseded.

## CUTOVER-07 — Nutrition imagery

Where v2.1 Goldens approved by the user contain recipe/meal imagery, that imagery is part of the approved visual language.

This supersedes the older blanket visual restriction against food photos/images for those surfaces.

Assets must still be legal, local/offline-compatible and truthful.

## CUTOVER-08 — Media Freeze

Final:
- 26 RepDB
- 7 FÉNIX
- 33/33
- RepDB `@repdb/exercises@2026.8.1`
- Curl femoral → `leg-curl`, lying canonical

No return to 25+8.

## CUTOVER-09 — QA

Independent QA remains frozen.

Codex/Engineering must first produce one corrected, fully evidenced candidate to CENTRAL.

Only CENTRAL can authorize QA.

## CUTOVER-10 — user intervention

Codex should execute locally itself whenever possible.

Do not recreate the prior workflow where the user manually copies patches/scripts between specialist chats.

## CUTOVER-11 — Progreso navigation icon (user decision, 2026-09-08)

The user explicitly confirmed the proposed resolution after the physical migration audit: for v2.1, use the three bars shown in the immutable Golden navigation. This supersedes the phoenix navigation-icon requirement and the associated conditional STOP in Progreso handoff sections 9.2 and 19.3. Keep the accessible label `Progreso`. The Golden files remain unchanged. The audit STOP is resolved; the previously authorized consolidated RC1-001/002/003 correction may continue.

## CUTOVER-12 — CENTRAL-EXCEPTION-G22-NUTRITION-ADHERENCE-01

CENTRAL closes the Golden 22 Nutrition adherence STOP. Preserve the Nutrition card geometry and visual hierarchy; display `Nutrition` and neutral `Métrica no disponible`. Do not display `6/7`, `86%`, any alternative ratio, percentage or score. Do not invent a formula. The original Golden remains immutable. State 22 may receive parity PASS when all visual axes conform with this explicitly authorized semantic exception. Future Nutrition adherence definition is outside rc.1.1. Continue consolidated RC1-001/002/003 closure and all gates without another approval for this point.

## CUTOVER-13 — G06/G21 neutral metrics and bounded autoresolution

CENTRAL closes G06/G21 metric STOP. `CENTRAL-EXCEPTION-G06-TRAINING-VOLUME-KPI-01`: preserve the primary metric slot, display `—` / `Métrica no disponible`; no aggregate kg, tonnage, percentage or equivalent score. `CENTRAL-EXCEPTION-G21-PROGRESS-AGGREGATED-PERFORMANCE-01`: preserve aggregated performance slots with `—` / `Métrica no disponible`; no strength mean, aggregate e1RM, improving-exercise ratio or substitute score. G22 remains closed.

CENTRAL authorizes automatic neutral resolution of the same class: Golden/demo metric lacks sufficient functional contract, the recommendation is truthful neutral fallback, no new formula/metric/feature/domain state/ownership/history/schema/backend/Training identity/streak/Pre-Post/consumption/destructive repair/production change. Preserve immutable Golden and composition; never fabricate QA values. Assign `CENTRAL-AUTOEXCEPTION-<SCREEN>-<SUBJECT>-<NN>` and document absent contract, reason, fallback in parity matrix, PRE-QA, checkpoint and final handoff. Do not STOP for qualifying neutral cases. Material functional redesign or other protected changes still require CENTRAL.

## CUTOVER-14 — User-licensed exercise media

Later CENTRAL user resolution authorizes `_incoming/gymvisual_raw` as the authoritative incoming exercise media source. Integrate clear corresponding assets as runtime primary, preserve licensed masters and prior technical fallbacks, optimize offline derivatives, update the real final registry/composition and attribution, then continue RC1.1 without another approval. The prior 26 RepDB + 7 FÉNIX primary-runtime composition is superseded wherever licensed replacements correspond. Training identity, schema 5, migrations NONE and production untouched remain immutable. Ambiguous titles must be documented; they do not authorize depicting a different exercise as the catalog identity. Existing G06/G21/G22 exceptions remain closed.

## CUTOVER-15 — G10/G11/G26 CLOSED; conservative action autoresolution

CENTRAL-EXCEPTION-G10-ROUTINE-EXPORT-01: preserve composition; individual routine export disabled/no disponible, no handler or file generation.

CENTRAL-EXCEPTION-G11-EXERCISE-ACTIONS-01: preserve composition; exercise favorites and warm-up eligibility disabled/no disponible; no fields, persistence or side effects.

CENTRAL-EXCEPTION-G26-DELETE-ALL-DATA-01: preserve danger action composition disabled/no disponible; no destructive handler, clear, deleteDatabase, reset or reseed.

All three may pass parity with the explicitly authorized semantic deviation, while originals remain immutable. G06/G21/G22 stay closed. The Golden filename aliases in the latest message refer to the canonical numbered files with underscores already in the frozen package.

Conservative autoresolution now covers any unsupported Golden affordance, not just metrics, when implemented solely as disabled, unavailable, neutral or noninteractive presentation. Preserve composition and truthfulness; introduce no feature, formula, KPI, domain state/field/persistence, side effect, export/import, deletion/history change, ownership/schema/migration/backend, Training identity/streak/Pre-Post/consumption or production change. Assign CENTRAL-AUTOEXCEPTION-<SCREEN>-<SUBJECT>-<NN>, document affordance, absent contract, implementation risk, applied fallback and no side effects in visual matrix, PRE-QA, shadow QA, checkpoint and final handoff. No further STOP for this class. Only an incompatibility that cannot be resolved conservatively within these boundaries requires CENTRAL.

## CUTOVER-16 — rc.1.2 visual evidence correction

CENTRAL rejected the rc.1.1 visual declaration because capture/reachability/conceptual similarity was treated as parity. The rc.1.2 gate must use canonical fixtures, an immutable-Golden derived-screen crop with recorded parameters and hashes, actual captures, material pixel diffs, and an eight-axis review for all 26 states. G09 must identify `Press banca`; fixtures must not silently select another exercise. Historical rc.1.1 evidence remains retained and explicitly superseded. Motion 33/33 and licensed Media remain provisionally accepted and require regression only. No Golden may be modified.
# RC1.2 visual assets / region parity — CENTRAL resolution

CENTRAL selected alternative 2 for RC1.2. Golden originals remain byte-exact and runtime media remains 31 licensed primaries + 1 RepDB + 1 FÉNIX. Golden raster assets must never be extracted into runtime. The reproducible comparator retains full raw diffs and may apply immutable, predeclared rectangular masks only to absent-source brand/media raster slots and explicit CENTRAL semantic exceptions. Masked slots still require geometric and semantic review.

`CENTRAL-EXCEPTION-G05-CATALOG-COUNT-01` authorizes the truthful runtime count `33 ejercicios` in place of the Golden sample `128 ejercicios`, with only the minimum text region excepted. G06/G10/G11/G21/G22/G26 remain closed under their recorded exceptions.
