# Changelog

All notable changes to this project are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is anything re-exported from
[src/index.ts](src/index.ts) or from a documented deep-import path listed in
`package.json` `exports`. Anything else is internal and may change without
notice.

## [Unreleased]

### Added

- HTOC saint-lectionary override: noted HTOC scripture citations (Matins
  Gospels, saint-specific Liturgy Apostol/Gospel pairs, Vespers OT
  readings, etc.) are now appended to `getDailyReadings` output as
  `source: "htoc"` refs, deduped against the paschal / menaion / daily-
  lectionary passes. Backed by the codegen'd `HTOC_SAINT_LECTIONARY`
  table (2162 refs across 710 dates in the 2025–2027 corpus window) and
  exposed via `getHtocSaintLectionary` on the `ponomar-ts/engine/saint-
  lectionary` deep import. Reading coverage against the HTOC corpus rose
  from 88.8% to **97.9%**; average per-day HTOC-only readings fell from
  0.42 to 0.08.

## [1.0.0-rc.0] — 2026-09-28

First release candidate. The engine is feature-complete against the ported
subset of upstream Ponomar and the public API is frozen for 1.0.

### Added

- `LIMITATIONS.md` — consolidated list of accepted deviations from upstream,
  linked from [PLAN.md](PLAN.md).
- CI drift check: `npm run codegen -- --check` runs on every push / PR,
  guaranteeing `src/data/` matches `vendor/ponomar/` at the pinned SHA.
- CI submodule init: workflow now calls `git submodule update --init
  --recursive` so `vendor/ponomar/` is available for the codegen check.
- README rewritten with real usage examples for every top-level public API
  (paschalion, day, readings, fasting, hours, bible).

### Changed

- **Breaking (from `0.2.x-alpha`)**: none. The 1.0-rc surface is byte-identical
  to `0.2.0-alpha.2`; the version bump only signals stability, not code
  change.
- `next` npm dist-tag now tracks 1.0 release candidates. `alpha` remains
  frozen at `0.2.0-alpha.2` for archaeological reference.

### Notes

- Documented, accepted deviations from upstream are listed in
  [LIMITATIONS.md](LIMITATIONS.md). Notably: the September–November Lucan-jump
  *numbering* boundary, rank-aware `<SERVICE Type>` selection, `Octoecheos`
  tone/weekday loading, `Matins.LeapReadings`, and localization all remain
  scoped out per the "engine returns raw IDs" policy.

## [0.2.0-alpha.2] — 2026-09

**Phase 9 — Astronomy + rank overlay.** Standalone sunrise/sunset
(SUNRISET.C) and Metonic-cycle lunar phase modules. `<CHURCH Rank>` overlay
for major feasts upstream forgot to annotate. Exposed via `ponomar-ts/astronomy`.
300 tests.

## [0.2.0-alpha.1] — 2026-09

**Phase 10 — Bible reference parser.** 78 books, 163 aliases, cross-chapter
ranges, half-verse suffixes (`22b`, `3a`), whole-chapter refs, format
round-trip. 1169/1170 upstream refs parse cleanly (the miss is an upstream
typo). Exposed via `ponomar-ts/bible`. 276 tests.

## [0.1.0-alpha.10] — 2026-09

**Phase 8c-iii — Hour class wrappers.** `getHourService(gregorian, hour,
options?)` — one-function API dispatching Prime / Terce / Sexte / None to the
right template (Paschal / per-hour / null for Royal Hours days), auto-deriving
`PFlag2` from the merged `HourSelection`. `composeService` now accepts
`PFlag3`. 249 tests.

## [0.1.0-alpha.9] — 2026-09

**Phase 8c-ii — Phrase text codegen.** 283 static phrases harvested from
`languages/en/xml/Services/{CommonPrayers,Text,Header,Command}/**` into a
flat `PHRASES` map. Convenience resolvers `resolveCreate`, `resolveCommand`,
`resolveBibleHeader`, `resolveTitle`. 240 tests.

## [0.1.0-alpha.8] — 2026-09

**Phase 8c-i — Service template composition.** `composeService(gregorian,
templateName, options)` walks the 28 static templates (990 directives),
filters by DSL `Cmd`, and inline-expands `<GET>` includes. Cycle-guarded,
depth-capped. 230 tests.

## [0.1.0-alpha.7] — 2026-09

**Phase 8b — Matins reading conflict resolution.** `getOrderedMatinsReadings`
ports `Matins.java` `Suppress()`: Sunday festal-vs-sequential arbitration
(high-rank feast pre-empts resurrection gospel; low-rank menaion yields to
it). 217 tests.

## [0.1.0-alpha.6] — 2026-09

**Phase 8a — Hymn propers.** `getPropers` returns troparia + kontakia per
commemoration, filtered by service / kind / DSL `Cmd`. Codegen captures every
`<TROPARION>` / `<KONTAKION>` under `<SERVICE>` wrappers. 208 tests.

## [0.1.0-alpha.5] — 2026-09

**Phase 7 — Service selection.** `getServices` walks `ServiceRules.xml`
periods, returning a merged `HourSelection` per Little Hour (Prime, Terce,
Sexte, None) with type / troparion / kontakion / lentenK / pickT / pickK.
201 tests.

## [0.1.0-alpha.4] — 2026-09

**Phase 5.6 — Cross-day transfer.** `getOrderedLiturgyReadings` now pulls
suppressed readings from tomorrow (`TransferRulesB`) and yesterday
(`TransferRulesF`), tagged with `dowOrigin` and bounded to depth 1. 191 tests.

## [0.1.0-alpha.3] — 2026-09

**Phase 5.5 — Divine Liturgy reading ordering.** `getOrderedLiturgyReadings`
implements Suppress, Class3Transfers, Saturday inversion, and the
`sequential`/`festal` classification. Cross-day transfer deferred. 185 tests.

## [0.1.0-alpha.2] — 2026-08

**Phase 6 — Fasting rules.** `getFasting(gregorian)` walks `Fasting.xml`,
returns `{ case, level, permitted, isDefault }` with 9 canonical levels
(`no-food` / `strict` / `no-oil` / `oil` / `caviar` / `fish` / `meat-excluded`
/ `no-fast` / `wine`) plus per-food-group booleans. Also: `dRank` now flows
through `LiturgicalDay` and the DSL context. 174 tests.

## [0.1.0-alpha.1] — 2026-08

**Phase 5.1 — Commemoration metadata + English lives.** `ResolvedSaint` grows
`name` / `church` / `info`. Ships 3.4k cIds of metadata + 501 populated LIFE
bodies via `ponomar-ts/lives`. 162 tests.

## [0.1.0-alpha.0] — 2026-08

**Initial engine cut. Phases 0–5 shipped.**

- **Phase 0** — vendored [typiconman/ponomar](https://github.com/typiconman/ponomar)
  as `vendor/ponomar/` submodule; codegen scaffolding.
- **Phase 1** — Julian date math (`JDate`), Paschalion (`getOrthodoxPascha`,
  `getJulianPascha`, `getPentecost`, `getLentStart`, `getApostlesFastStart`,
  `getMeatfare`, `getCheesefare`), Gregorian ↔ Julian conversion. Regression-
  tested against upstream Perl `paschalion.pl` for 1900–2100.
- **Phase 2** — StringOp DSL: proper lexer + Pratt parser + evaluator.
  Corpus-tested against every `Cmd=` / `Value=` string in the upstream XML.
- **Phase 3** — Codegen for `commands/*.xml`, `pentecostarion/*.xml`,
  `triodion/*.xml`, `menaion/**.xml`. Emits typed `.ts` under `src/data/`.
- **Phase 4** — `getLiturgicalDay(gregorian)` composes paschal + menaion
  saints per DSL guards, resolves tones, returns typed `LiturgicalDay`.
- **Phase 5** — `getDailyReadings(gregorian, { service, type })` extracts
  scripture from each saint's life XML, filtered by service / type / DSL
  guard, tagged with source (`paschal` / `menaion`). 155 tests.

[1.0.0-rc.0]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v1.0.0-rc.0
[0.2.0-alpha.2]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.2.0-alpha.2
[0.2.0-alpha.1]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.2.0-alpha.1
[0.1.0-alpha.10]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.10
[0.1.0-alpha.9]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.9
[0.1.0-alpha.8]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.8
[0.1.0-alpha.7]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.3
[0.1.0-alpha.2]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.2
[0.1.0-alpha.1]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.1
[0.1.0-alpha.0]: https://github.com/wolfgangnothdurft/ponomar-ts/releases/tag/v0.1.0-alpha.0
