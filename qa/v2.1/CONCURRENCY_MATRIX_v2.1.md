# CONCURRENCY MATRIX — FÉNIX v2.1

| ID | Race / pressure | Expected serial result | Coverage |
|---|---|---|---|
| H01 | double start day | one routine start; no duplicate day | `test-v21-today-mutations` |
| H02 | stale task toggle vs edit | later actor rereads current version; no lost update/resurrect | same |
| H03 | task delete vs edit | delete-first => edit reject; edit-first => delete current | same |
| H04 | WorkShift change vs task completion | independent stores; both committed facts survive | same |
| T01 | routine reorder vs edit | serial current-state ordering/version | `test-v21-training-editor-mutations` |
| T02 | add exercise double-submit | no accidental duplicate logical editor action | same/UI busy |
| T03 | remove routine exercise vs start session | started execution owns snapshot; template only future | CORE + v2.1 source |
| T04 | custom exercise stale edit/archive | no resurrect/version regression | v2.1 source |
| T05 | finish vs stale set mutation | stale mutation reject after terminalization | CORE T/V/R/S |
| T06 | substitute vs set mutation | transaction reread; completed fact protected | CORE S01–S10 |
| T07 | multiple same-day sessions | IDs remain independent | CORE identity suites |
| N01 | meal complete vs replace/portion | winner establishes state; stale mutation rejects | RC1.1 M01–M10 |
| N02 | recipe edit vs delete | serial current version; historical snapshots stable | RC1/RC2.1 |
| N03 | concurrent equivalent Ingredient create | one active normalized identity | RC2.1 L07/L08 |
| N04 | concurrent equivalent Shopping add | one active logical item; quantity sums once/call | RC2.1 L05/L06 |
| N05 | week apply retry | idempotent/no duplicate active identity | RC1 N01–N08 |
| N06 | goal double/10-submit | <=1 active goal | RC2 G01–G08 |
| N07 | improvised duplicate submission | one completed fact per token | RC2 I01–I06 |
| P01 | weight update vs delete | no resurrect; serial version | `test-v21-progress-mutations` |
| P02 | same-day rapid weight save | one comparable day fact unless explicit additional | same |
| P03 | measurement update vs delete | no resurrect/version stale | same |
| P04 | featured exercise concurrent changes | atomic current parent validation | same |
| B01 | restore corrupt input | reject before clear | CORE backup + v2.1 backup negative |
| B02 | injected failure mid restore | transaction rollback | CORE backup integrity |
| B03 | runtime logical duplicate in backup | validator reject | RC2.2 Q01–Q12 |

Status target for candidate: every row PASS; no unresolved class hidden behind a UI-only guard.
