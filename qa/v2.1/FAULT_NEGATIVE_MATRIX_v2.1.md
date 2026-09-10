# FAULT / NEGATIVE MATRIX — FÉNIX v2.1

| ID | Injection / invalid input | Expected | Evidence |
|---|---|---|---|
| F01 | backup missing schema-5 table | REJECT | CORE backup suite |
| F02 | wrong table count / total | REJECT | CORE backup suite |
| F03 | duplicate physical ID | REJECT | CORE backup suite |
| F04 | broken FK / active child under deleted parent | REJECT | CORE/RC2/RC2.1 |
| F05 | duplicate logical Ingredient / ShoppingItem | REJECT | RC2.2 Q01–Q12 |
| F06 | mid-restore exception | full rollback | CORE backup fault injection |
| F07 | mid-week apply exception | full weekly rollback | RC1 N01–N08 |
| F08 | clearCheckedShoppingItems mid-operation error | full rollback | RC2.1 L13 |
| F09 | stale Training mutation after terminal lifecycle | REJECT, zero write/event | B02/RC1/RC2 |
| F10 | >1 active NutritionGoal before save | explicit integrity error | RC2 G05 |
| F11 | duplicate improvised token | idempotent one fact/event | RC2 I suites |
| F12 | appetite same mode | stable no-op | RC2 A05 |
| F13 | appetite changed but no alternative | legitimate same recipe | RC2 A06 |
| F14 | offline after valid load | shell + local DB remain usable | Playwright/offline smoke |
| F15 | PWA update while Training active | update deferred, session uninterrupted | source/E2E |
| F16 | reduced-motion enabled | exercise animation reduced/paused | media source/visual |
| F17 | seed rerun after user edit/archive | no overwrite/no resurrect | `test-v21-nutrition-seed-ownership` |

No v2.1 fault recovery path may require database reset or schema migration.
