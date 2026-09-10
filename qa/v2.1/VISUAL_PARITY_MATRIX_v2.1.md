# HISTORICAL / SUPERSEDED — VISUAL PARITY MATRIX — FÉNIX v2.1 (rc.1.1)

Golden contract: `FENIX_v2.1_GOLDEN_RENDERS_FINAL_26.zip`.

This matrix describes the rejected rc.1.1 evidence and is retained for traceability only. It is superseded by `VISUAL_PARITY_MATRIX_RC12.md`, which is generated from the reproducible derived-crop comparator and current captures. The rc.1.1 conceptual comparison is not current evidence.

Legend: STRUCT / GEO / TYPE / SPACE / COLOR / ICON / MEDIA / INTERACTION. Automated screenshots capture the app viewport; the Golden contains external framing and is therefore compared conceptually at content level.

| # | Golden | App surface/state | Required dimensions | Gate |
|---:|---|---|---|---|
| 01 | HOY Principal | Hoy started/current | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 02 | HOY Día 0 | Hoy no routine started | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 03 | TRAINING Hoy | Training/Hoy | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 04 | TRAINING Rutinas | Training/Rutinas | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 05 | TRAINING Ejercicios | Training/Ejercicios | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 06 | TRAINING Historial | Training/Historial | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G06 exception |
| 07 | TRAINING Sesión en curso | active session | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 08 | TRAINING Detalle rutina | routine detail Sheet/surface | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 09 | TRAINING Detalle ejercicio | exercise detail | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 10 | TRAINING Crear/Editar rutina | routine editor | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G10 exception |
| 11 | TRAINING Crear/Editar ejercicio | custom exercise editor | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G11 exception |
| 12 | NUTRITION Hoy | Nutrition/Hoy | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 13 | NUTRITION Semana | Nutrition/Semana | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 14 | NUTRITION Recetas | Nutrition/Recetas | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 15 | NUTRITION Compra | Nutrition/Compra | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 16 | NUTRITION Detalle receta | recipe detail | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 17 | NUTRITION Detalle comida | meal detail | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 18 | NUTRITION Crear/Editar receta | recipe editor | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 19 | PROGRESO Resumen | Progress/Resumen | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 20 | PROGRESO Peso | Progress/Peso | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 21 | PROGRESO Rendimiento | Progress/Rendimiento | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G21 exception |
| 22 | PROGRESO Adherencia | Progress/Adherencia | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G22 exception |
| 23 | PROGRESO Cuerpo/Medidas | Progress/Cuerpo | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 24 | AJUSTES Principal | Settings/home | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 25 | AJUSTES Rutina diaria | Settings/routine | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS |
| 26 | AJUSTES Datos/Backup/Restore | Settings/data | STRUCT · GEO · TYPE · SPACE · COLOR · ICON · MEDIA · INTERACTION | PASS · G26 exception |

## Non-negotiable parity rules

- shared black/carbon/red FÉNIX visual language;
- consistent uppercase module titles and typography rhythm;
- no per-page visual identity drift;
- bottom navigation remains four primary modules;
- Settings never appears as a fifth tab;
- all critical interactive targets meet the mobile touch floor;
- no generated/placeholder exercise media where mapping exists;
- reduced-motion path remains usable.

Manual review is recorded in `evidence/VISUAL_REVIEW_26.md`; each row references the immutable Golden, current capture and side-by-side comparison. PASS includes only the documented CENTRAL semantic exceptions and never changes a Golden.

## Current RC1.1 exceptions (CENTRAL authorized)
G06: CENTRAL-EXCEPTION-G06-TRAINING-VOLUME-KPI-01.
G21: CENTRAL-EXCEPTION-G21-PROGRESS-AGGREGATED-PERFORMANCE-01; CENTRAL-AUTOEXCEPTION-G21-VOLUME-01; CENTRAL-AUTOEXCEPTION-G21-WEEKLY-SETS-01.
G22: CENTRAL-EXCEPTION-G22-NUTRITION-ADHERENCE-01; CENTRAL-AUTOEXCEPTION-G22-OVERALL-01; CENTRAL-AUTOEXCEPTION-G22-WEEKLY-TREND-01; CENTRAL-AUTOEXCEPTION-G22-COMPLETED-DAYS-01; CENTRAL-AUTOEXCEPTION-G22-MOBILITY-01; CENTRAL-AUTOEXCEPTION-G22-WEIGHT-ADHERENCE-01.
G10: CENTRAL-EXCEPTION-G10-ROUTINE-EXPORT-01.
G11: CENTRAL-EXCEPTION-G11-EXERCISE-ACTIONS-01.
G26: CENTRAL-EXCEPTION-G26-DELETE-ALL-DATA-01.
See evidence/CENTRAL_METRIC_EXCEPTIONS.md for the conflict, absent contract, fallback and justification. Exceptions do not waive any visual axis or count capture as parity.
