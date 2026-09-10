# QA_REGRESSION_LEDGER.md

## Stable CORE

FÉNIX v2.0.0 QA final:
PASS, no open CRITICAL/HIGH/MEDIUM/LOW issues.

Preserve all closed regression classes from B01/B02/RC1/RC1.1/RC2/RC2.1/RC2.2.

## Major permanently protected classes

### State/freshness
- post-commit invalidation
- Today latest-wins
- Today rollback causality
- global Nutrition reconciliation
- exact Training-meal identity
- anti ping-pong

### Training
- active session uniqueness
- Planned↔Execution linkage
- ExerciseSet domain
- parent/order integrity
- add/toggle/remove lifecycle
- substitution causality
- same-day session identity
- deterministic streak ordering

### Nutrition
- DailyMeal causal mutation
- week apply atomic/idempotent
- NutritionGoal singleton
- improvised meal idempotency
- appetite material change
- Ingredient/Recipe/Shopping lifecycle
- Ingredient normalized uniqueness
- Shopping logical uniqueness

### Backup/Restore
- prevalidation before writes
- cross-entity validation
- active ExerciseSet order
- pending Training meal lifecycle
- runtime↔backup identity alignment
- postvalidation
- rollback on invalid state

### PWA/mobile
- offline source behavior
- hermetic Playwright boot
- no stale preview reuse
- responsive no-overflow contracts
- safe update behavior

## Current v2.1 CENTRAL blockers

OPEN:
- `CENTRAL-RC1-001` — real visual parity 26/26
- `CENTRAL-RC1-002` — exercise-specific motion 33/33
- `CENTRAL-RC1-003` — final custom FÉNIX media 7/7

Do not reopen a CLOSED class unless a material reproducible regression exists.

## Mandatory baseline regression artifact

Official backup:
`fenix-backup-2026-09-06T13-27-03-525Z.json`
759 records
SHA:
`3686d872e64d83f7fea7053fab9f2e32508bd525c50180431a5b437bad8e8732`

Historic unresolved Training record:
`775635cc-ec59-4b44-a566-d722ae4664d7`
`2026-09-04 · Lower B · pending`
must remain unresolved.
