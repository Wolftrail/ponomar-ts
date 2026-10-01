# Changelog

All notable changes to this project are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is anything re-exported from
[src/index.ts](src/index.ts) or from a documented deep-import path listed in
`package.json` `exports`. Anything else is internal and may change without
notice.

## [Unreleased]

## [1.0.0-rc.8] — 2026-10-01

### Deprecated

- **Stage 2 of the HTOC-first API refactor.** The following re-exports
  are now marked `@deprecated` in JSDoc. They remain functional and
  tests still cover them, but IDEs will show them struck-through so
  downstream apps can migrate. Scheduled for removal at `1.0.0`.

- **Ponomar DSL + resolver internals** (never meant to be public):
  `computeDayContext`, `dslContext`, `selectMenaionEntry`,
  `selectPaschalCycleEntry`, `resolveSaints`, `getPhrase`,
  `resolveBibleHeader`, `resolveCommand`, `resolveCreate`,
  `resolveTitle`.

- **Ponomar service composers** (HTOC publishes a daily reading list,
  not a service ordering): `composeService`, `getPropers`,
  `getServices`, `getHourService`, `getHourReadings`,
  `getOrderedLiturgyReadings`, `getOrderedMatinsReadings`.

- **Rank-glyph adapters** (use `HtocSaint.rank` / `HtocCommemoration.rank`
  as display strings directly): `getHtocDayRank`, `mapHtocRank`,
  `unmapHtocRank`.

- **Matins gospel cycle direct access** (now applied automatically by
  `getReadings` on Sundays): `RESURRECTION_MATINS_GOSPELS`,
  `getResurrectionMatinsGospel`.

- **Prefixed HTOC function aliases** (prefer the unprefixed Stage 1
  names): `getHtocReadings` → `getReadings`,
  `getHtocDayFacts` → `getDay`,
  `getHtocSaintsFor` → `getSaints`,
  `getHtocDailyLectionary` → `getDailyLectionary`,
  `getHtocSaintLectionary` → `getSaintLectionary`.

### Kept (non-deprecated public API)

- Foundations: `getLiturgicalDay`, `getDailyReadings`,
  `getLiturgyReadings`, `getFasting`, `getLife`.
- Stage 1 saint API: `getSaint`, `getSaintByCId`, `getLifeBySlug`,
  `slugToCId`, `cIdToSlug`.
- HTOC facade: `getReadings`, `getDay`, `getSaints`,
  `getDailyLectionary`, `getSaintLectionary`.
- Raw HTOC data maps: `HTOC_SAINTS_BY_ISO`, `HTOC_DAILY_LECTIONARY`,
  `HTOC_DAY_FACTS_BY_ISO`, `HTOC_SAINT_LECTIONARY`.
- All `Htoc*` types, `ReadingRef`, `DailyReadings`, saint API types.
- Bible, astronomy, paschalion sub-APIs.

## [1.0.0-rc.7] — 2026-10-01

### Added

- **Stage 1 of the HTOC-first API refactor.** HTOC is becoming the
  canonical public surface; Ponomar (paschalion, menaion, lives
  corpus, fasting DSL) stays as an internal engine.

- `getSaint(slug)` — saint-centric facade for `/saints/<slug>` routes.
  Returns `{ slug, cId, names, commemorations, life }` where
  `commemorations` is every Gregorian ISO date in 2025–2027 where the
  saint appears, with HTOC rank + display text.

- `getSaintByCId(cId)` — same shape, keyed by Ponomar `cId` for apps
  that already route on legacy numeric ids (e.g. `/saints/437`).

- `getLifeBySlug(slug)` — biographical prose via the HTOC slug (joins
  the slug ↔ cId bridge to the lives corpus).

- `slugToCId(slug)` / `cIdToSlug(cId)` — the explicit bridge. Covers
  fixed-cycle slugs (`Month/DD-NN`, menaion-positional) at ~89% HTOC
  slug coverage; movable-cycle slugs (`Epiphany/p±N`, etc.) and
  HTOC-only entries (icons without a Ponomar counterpart) return
  `null`.

- **Unprefixed aliases** for the HTOC day-page lookup functions:
  `getReadings` → `getHtocReadings`,
  `getDay` → `getHtocDayFacts`,
  `getSaints` → `getHtocSaintsFor`,
  `getDailyLectionary` → `getHtocDailyLectionary`,
  `getSaintLectionary` → `getHtocSaintLectionary`.
  Prefixed names remain functional; prefer the unprefixed form for new
  code.

## [1.0.0-rc.6] — 2026-10-01

### Changed

- `getHtocReadings(date)` is now a pure derivation on top of
  `getDailyReadings` — it filters the main engine's output down to
  the HTOC day-page surface (liturgy apostol+gospel, matins gospel,
  Royal Hours and any noted saint-lectionary entry) rather than
  dictionary-looking-up the vendored fixtures. Signature is now
  `(date) => readonly ReadingRef[]` (no more `| null`); the fixture
  window no longer gates coverage. Inside 2025–2027 the HTOC overlay
  still provides ground-truth output; outside that window the Ponomar
  algorithm fills in from menaion / triodion / pentecostarion /
  paschalion data using the same rules HTOC's team applies.

## [1.0.0-rc.5] — 2026-10-01

### Added

- `getHtocReadings(date)` — new public API returning exactly the
  pericopes HTOC publishes in its day-page `scripture[]` block, as
  structured `ReadingRef[]`. Union of the rjadovoje daily lectionary and
  the noted saint lectionary; nothing from Ponomar's menaion / paschalion
  structural extras. Returns `null` outside the vendored 2025–2027
  corpus window.

  Use this when the UI should match what HTOC's day page shows and
  nothing more. For the full liturgical surface — Great-Feast Vespers
  OT prophecies, Nativity-Eve / Theophany-Eve Royal Hours, polyeleos
  saint menaion readings not surfaced on HTOC's daily feed — continue
  calling `getDailyReadings`.

  Verified against the full 2026 fixture: 365/365 days match HTOC's
  `scripture[]` block exactly.

## [1.0.0-rc.4] — 2026-10-01

### Fixed

- `appendHtocSaintLectionary` now dedups on `(service, reading)` alone,
  ignoring the `type` sub-field. Ponomar's menaion/paschalion label each
  slot with structural ordinals (`matins/1..12`, `primes/1..3`,
  `vespers/1..15`) while HTOC flattens them (`matins/gospel`,
  `primes/reading`, `vespers/reading`). The previous `type`-aware dedup
  missed these as the same ceremonial pericope at the same service.
  On Great Friday (e.g. 2026-04-10) this collapses 11 duplicate matins
  Passion Gospels, 2 duplicate readings per Royal Hour, and the Vesperal
  Liturgy pair into their Ponomar equivalents.
- On dedup match, HTOC's `hour` and `note` metadata is now merged onto
  the surviving Ponomar/menaion ref rather than dropped. Downstream
  `getHourReadings` and UI note-display consumers continue to see Royal
  Hour tags and reading-title notes.
- Corpus-wide reading engine-only count dropped from 2355 to **1848**
  (−507 spurious duplicate refs). HTOC-coverage remains 100% (4097/4097
  matched, zero HTOC-only).

## [1.0.0-rc.3] — 2026-10-01

### Fixed

- Reading dedup now strips Ponomar's `a`/`b` verse-part suffixes before
  comparing, so e.g. menaion `Jn_19:6-11a, 13-20, 25-28a, 30b-35a`
  (Universal Exaltation liturgy gospel) is correctly recognised as the
  same reading as HTOC's `Jn_19:6-11, 13-20, 25-28, 30-35`. Previously
  both forms surfaced side by side.
- The resurrection-cycle matins gospel fallback (`appendResurrection­MatinsGospel`)
  now recognises menaion `matins/1` entries as filling the "matins gospel"
  slot. Twelve Great Feasts falling on a Sunday (e.g. 2026-09-27 Universal
  Exaltation) no longer surface Mk 16:1-8 alongside the festal Jn 12:28-36.
- The HTOC saint-lectionary appender now dedups menaion `matins/1`
  against HTOC `matins/gospel` so e.g. 2026-09-27 doesn't emit the same
  Jn 12:28-36 reading twice.

### Changed

- Corpus-wide reading engine-only count dropped from 2658 to **2355**
  (−303 spurious duplicate refs) after these dedup fixes.

## [1.0.0-rc.2] — 2026-10-01

### Fixed

- `getOrderedLiturgyReadings` no longer surfaces Ponomar's structural
  sequential-cycle gospel (cId `9000..9899`) alongside HTOC's published
  daily-lectionary pick when the two disagree. On e.g. Thursday
  2026-10-01 (Julian Sept 18), upstream Ponomar's week-18 slot schedules
  Mark 11:27–33, but HTOC publishes Matthew 24:13–28 — the Russian /
  ROCOR convention for the Lucan-Jump handoff. The engine previously
  returned both as `rank: "sequential"`, implying two "ordinary" gospels
  for the day; it now evicts the Ponomar ref when its reading is not
  among HTOC's picks for that type. On days where HTOC publishes
  multiple apostol/gospel pairs (ordinary + transferred) and Ponomar's
  sequential happens to match one of them, both are kept. Corpus-wide
  reading coverage against HTOC rose from 97.9% to **100%** (4097/4097
  matched, zero HTOC-only). The `getOrderedLiturgyReadings` regression
  budget in `tests/htoc.test.ts` is tightened accordingly.

## [1.0.0-rc.1] — 2026-10-01

Second release candidate. Reorients the user-facing data layer around
HTOC (Jordanville / ROCOR) as the single source of truth for tone,
propers, readings, and the day's commemoration list, and documents the
Russian Orthodox jurisdictional scope.

### Added

- `LiturgicalDay.commemorations` — the full HTOC day-page commemoration
  list, vendored verbatim from `htocDayFacts.ts` for dates within the
  2025–2027 coverage window (16,229 entries across 1,095 days). This
  is the authoritative "what HTOC prints today" list and is a superset
  of `LiturgicalDay.saints`: it includes entries without a navigable
  life page (e.g. New Hieromartyrs, Fast Day markers, minor
  Greek/Celtic/Russian commemorations) that have no `cId` to join
  against the Ponomar `xml/` corpus. Each entry carries HTOC's rank
  glyph (`6/4/3/2/1/0/o`), display text, a `minor` flag for
  sub-bullets, and life-page links (empty for entries without a
  navigable life). Closes the ~57% user-facing commemoration gap
  previously surfaced by the structural `allSaints` list. The new
  `HtocCommemoration` type is re-exported from the top-level barrel.
  Dates outside the vendored window return an empty array.

### Changed

- `LiturgicalDay.tone` now returns HTOC's printed tone verbatim for dates
  within the vendored HTOC coverage window (2025–2027). Outside the
  window the engine's `Day.getTone()` port (last `<SAINT Tone="…">`
  value, `0 → 8`) remains the fallback. This aligns `ponomar-ts` with
  HTOC's pastoral display convention — in particular, the engine's
  behaviour of printing a tone on Ascension / Trinity Saturday /
  Pentecost week (24 days/3-year corpus) and on Thomas Sunday
  (3 days/3-year corpus) is now suppressed in favour of HTOC's choice
  (background weekly tone / null respectively). There are no
  algorithmic mismatches between HTOC and the engine on days where
  both print a tone; the overlay only changes which days are printed
  as `null`.
- `getPropers(date)` now sources troparia and kontakia verbatim from HTOC
  (via `htocDayFacts.ts`) instead of composing them from upstream Ponomar
  `<TROPARION>` / `<KONTAKION>` XML. HTOC is the single source of truth
  for user-facing propers; running two translations side-by-side produced
  wording drift (41.9% / 46.1% token overlap under the metrics comparator)
  with no benefit to consumers. `DailyPropers.troparia` and
  `DailyPropers.kontakia` are now `readonly HtocHymn[]`; `ProperRef` is
  removed from the public API. The `service` filter option is dropped
  (HTOC data has no service-block tagging); the `kind` filter is kept.
  Dates outside the vendored HTOC coverage window (2025–2027) return
  empty arrays. The upstream XML hymn data is still vendored and still
  populates `Commemoration.hymns` in the data layer for codegen and
  analysis, but no public API surfaces it.

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

### Documented

- README.md and LIMITATIONS.md now state explicitly that ponomar-ts
  follows **Russian Orthodox** usage (Jerusalem Typicon, Slavic
  recension) as published by Holy Trinity Monastery, Jordanville
  (ROCOR). Julian ("Old Calendar") menaion, Russian monastic charter
  fasting, Russian-recension commemorations (including twentieth-century
  New Hieromartyrs), English display text. Greek / Antiochian /
  New-Calendar / Old Rite / Athonite variant usage are explicitly out
  of scope.

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
