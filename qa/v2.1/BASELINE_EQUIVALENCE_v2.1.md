# BASELINE EQUIVALENCE — FÉNIX v2.1

- Approved CORE source candidate: `FENIX_v2_CORE_STABLE_v2.0.0-rc.2.2_SOURCE_BUNDLE.zip`
- Approved source SHA-256: `f98d902d245dcd3cc0a6db5eca4d40afa4b1bca3e7f7f00a9238d16f32fab617`
- Local v2.1 baseline commit: `b676f20595229e13935736c7170db16db996ae36`
- CENTRAL production/base commit reference: `deac3890f4d1b794cae8f3acde5a12bf7c35cf94`

The local starter clone does not contain the `production` ref or the `deac389…` Git object. Before v2.1 changes, Engineering compared the complete local HEAD tree with the canonical RC2.2 SOURCE BUNDLE: **159 files vs 159 files; 0 missing; 0 extra; 0 changed (byte-for-byte)**.

Therefore `b676f20…` is a local source-baseline commit with content equivalence to the promoted CORE source. No operation in the v2.1 engineering workspace writes, creates or moves a `production` ref. When `production` exists in the final Windows clone, the final gate additionally requires it to remain exactly `deac3890…`.
