# REPO_INSTALL_PLAN.md

Do not ask the user to manually copy individual files.

After completing the physical read-only audit, Codex may install the migration corpus into the repo as follows:

- root `AGENTS.md` ← `repo_overlay/AGENTS.md`
- `docs/fenix/**` ← `repo_overlay/docs/fenix/**`

Before writing:
1. detect whether root `AGENTS.md` or `docs/fenix` already exist;
2. preserve any existing file by reading and diffing it;
3. do not overwrite a conflicting canonical source silently;
4. if existing content materially conflicts, STOP and show CENTRAL the conflict.

The migration documentation itself may remain uncommitted until CENTRAL accepts the corrected candidate.
Do not commit solely because the corpus was installed.
