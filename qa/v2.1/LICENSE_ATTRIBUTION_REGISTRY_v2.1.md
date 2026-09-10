# LICENSE / ATTRIBUTION REGISTRY — FÉNIX v2.1

## Composición vigente — CUTOVER-14

31 primarios Gymvisual licenciados y aportados por el usuario, 1 primario RepDB (Jalón al pecho), 1 primario FÉNIX (Remo T con apoyo torácico). Autorización explícita para integración y entrega interna a CENTRAL; no se afirma una licencia más amplia de redistribución. Se preservan masters, marcas de agua y pixels completos. Véanse `evidence/USER_MEDIA_LICENSE_REGISTRY.md` y `evidence/USER_MEDIA_MAPPING.json` para correspondencias, exclusiones mecánicas, hashes y derivados.

Los inventarios 26 RepDB y 7 FÉNIX descritos debajo se conservan como fallback técnico. Los siete originales finales FÉNIX son WebP de start/peak; los SVG anteriores son fallback adicional, no media principal final.

## RepDB

- Coverage: **26/33** exercise mappings.
- Source class: RepDB free exercise dataset / flat illustrations selected by the Media Freeze.
- In-app attribution string: **Exercise data & flat illustrations by RepDB — repdb.co**.
- Registry license reference: `https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md`.
- Package source: `@repdb/exercises@2026.8.1` (build-time only, zero runtime API dependency).
- Build policy: `scripts/sync-repdb-media.mjs` copies only the 26 frozen mappings into the built application; the complete RepDB dataset is never copied into FÉNIX.
- Offline/performance policy: one local thumbnail for exercises referenced by canonical seed routines is precached; remaining local detail frames are CacheFirst on first use. `ExerciseMotion` remains the vector fallback.
- FÉNIX does not republish the RepDB package as a dataset/API; selected media is shipped solely as in-app application media.

## FÉNIX original media

Coverage: **7/33** mappings.

Files:
- `fenix-chest-supported-tbar-row.svg`
- `fenix-bayesian-curl.svg`
- `fenix-overhead-cable-triceps.svg`
- `fenix-open-book.svg`
- `fenix-9090-hip-switch.svg`
- `fenix-wall-slides.svg`
- `fenix-breathing-mobility.svg`

These assets are original FÉNIX application assets and are labelled in the registry as `FÉNIX original asset — in-app use only`.

## Media Freeze resolution

CENTRAL resolved STOP-MEDIA-01 in favor of the final mapping in `03_FENIX_v2.1_MEDIA_FREEZE_DECISION_v0.3.md`: **26 RepDB + 7 FÉNIX; 33/33**. This supersedes only prior 25+8 counters and changes no other functional contract.
