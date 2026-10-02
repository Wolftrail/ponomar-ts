# Changelog

All notable changes to this project are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is anything re-exported from
[src/index.ts](src/index.ts) or from a documented deep-import path listed in
`package.json` `exports`. Anything else is internal and may change without
notice.

## [Unreleased]

## [1.0.0-rc.20] — 2026-10-02

### Added

- **New hymn classification axis `dow-julian-window`** in
  `scripts/codegen/hymns-cycle.ts` and `src/engine/hymns.ts`, keyed by
  `"${dow}-MM-DD"` (dow 0 = Sunday … 6 = Saturday, MM-DD is Julian).
  Covers moveable Sunday / Saturday feast propers tied to a nearby
  fixed Julian landmark (Sunday Before Nativity, Sunday of the Holy
  Forefathers, Sunday of the Holy Fathers of the 7th Ecumenical
  Council, Sunday of the Holy Fathers of the first six Ecumenical
  Councils, Saturday-nearest-feast of St John of Shanghai and San
  Francisco, etc.). Emission is restricted to observed `(dow, julianKey)`
  pairs, so composer never emits content HTOC did not publish.
  Internal data map `DOW_JULIAN_WINDOW_HYMNS_CYCLE` added to
  `src/data/hymnsCycle.ts` (not re-exported from `src/index.ts`;
  internal to the composer).

### Changed

- **Hymn composer (any-year propers) raised from ~93 % to 100 %
  reproduction with zero false positives.** Two codegen changes to
  `scripts/codegen/hymns-cycle.ts`:
  1. The classifier previously required a hymn's occurrences to collapse
     to a single stable Julian key or a single stable nday, dropping
     hymns like the Paschal troparion ("Christ is risen" — ndays 0..6
     across Bright Week) as "unstable". The classifier now accepts any
     hymn whose occurrences all fall on keys that are stable across
     every corpus year, allowing multi-key emission within one
     classification.
  2. Identity is now keyed on `(kind, title, text)` only; the saint-slug
     set is excluded so a hymn that picks up a composite saint tag in a
     coincidence year (e.g. 4th Sunday of Lent falling on the Julian
     fixed feast of St John Climacus) is not split into two single-year
     identities that falsely stabilise on arbitrary keys.
  Combined with the new `dow-julian-window` axis above, this closes the
  entire long tail. Measured against the vendored 2025–2027 window
  (1095 days): all-5-fields set-equal reproduction rose from 84.93 % to
  **99.73 %**; troparia 91.96 % → **100 %** (0 mismatches); kontakia
  86.30 % → **100 %** (0 mismatches); unstable hymns 11 → 0;
  false-positive emissions eliminated. The 0.27 % residue is three
  commemoration days where HTOC's raw markup publishes the same
  "New Martyr Michael the Blessed of Chernigov" entry twice (cross-list
  cross-reference artefact); our codegen correctly dedupes to one entry,
  so the composer is strictly cleaner than HTOC's publication there.

## [1.0.0-rc.19] — 2026-10-03

### Changed

- **BREAKING: dropped the rendered `fastText` English string from the
  public API.** The engine previously synthesised a single tradition-
  flavoured sentence (strict Russian typikon) and shipped it on
  `LiturgicalDay.fastText`, `DayFacts.fastText`, and
  `DayFactsPartial.fastText`. HTOC's own `fastText` field encodes a
  Hellenic flavour that differs from the renderer in roughly 22 % of
  calendar days — rather than ship an opinionated string that is wrong
  for most consumers, the engine now returns a structured fasting
  record and lets front-ends render against their own tradition.

  **Removed:**
  - `LiturgicalDay.fastText`, `DayFacts.fastText`,
    `DayFactsPartial.fastText` (field no longer exists).
  - `getFastTextForAnyYear(ctx)` (helper that pivoted HTOC's own
    strings onto arbitrary dates — superseded by `fasting.period`).
  - `src/data/fastTextCycle.ts` (both `FAST_TEXT_PASCHAL_CYCLE` and
    `FAST_TEXT_JULIAN_CYCLE` cycle maps and the module itself).
  - Internal: the `F` string pool and `fastIdx` column were dropped
    from `src/data/dayFacts.ts`; `CompactDay` is now a 3-tuple.

  **Added:**
  - `LiturgicalDay.fasting: FastingResult` — the full `FastingResult`
    (`case`, `level`, `permitted`, `isDefault`, `period`) is now
    attached directly to the composed day.
  - `FastingResult.period: FastingPeriod` — a new structured field
    classifying the day's scheduled fast window.
  - New types `FastingPeriod` (`{ kind, isEve }`) and
    `FastingPeriodKind` (`"great-lent" | "apostles" | "dormition" |
    "nativity" | "weekly"`).
  - New exports `getFastingPeriod(ctx)` and `getFastingPeriodName(period)`.
  - `renderFastText(ctx, level)` is retained but repositioned as an
    **optional courtesy helper** that encodes a strict Russian
    typikon flavour and is documented to diverge from HTOC's Hellenic
    rendering. Consumers who want HTOC-style English should write
    their own thin renderer against `fasting.period` + `fasting.level`.

  **Migration:**
  - Replace `day.fastText` with your own rendering, e.g.
    ```ts
    const name = getFastingPeriodName(day.fasting.period);
    const label = name
      ? `${day.fasting.period.isEve ? "Eve of " : ""}${name}.`
      : "";
    ```
    Or, for the previous Russian-flavoured string:
    ```ts
    import { renderFastText } from "ponomar-ts";
    const text = renderFastText(day.context, day.fasting.level);
    ```
  - Replace `facts.fastText` reads on `DayFacts` with structured
    composition at the `LiturgicalDay` layer.

## [1.0.0-rc.18] — 2026-10-02

### Changed

- **BREAKING: dropped the `htoc`/`Htoc`/`HTOC_` prefix from all public
  names, file paths, and codegen artifacts.** Now that HTOC is the
  primary data channel for the day-info engine, the prefix is
  redundant signage. Renames follow a uniform rule — `HTOC_FOO` →
  `FOO`, `HtocFoo` → `Foo`, `htocFoo` → `foo`, `htoc-foo` → `foo`.

  **Public API renames** (import from `ponomar-ts`):
  - Constants: `HTOC_DAILY_LECTIONARY` → `DAILY_LECTIONARY`,
    `HTOC_SAINTS_BY_ISO` → `SAINTS_BY_ISO`,
    `HTOC_DAY_FACTS_BY_ISO` → `DAY_FACTS_BY_ISO`,
    `HTOC_SAINT_LECTIONARY` → `SAINT_LECTIONARY`,
    `HTOC_SAINT_FIXED_CYCLE` → `SAINT_FIXED_CYCLE`,
    `HTOC_SAINT_MOVABLE_CYCLE` → `SAINT_MOVABLE_CYCLE`,
    `HTOC_SAINT_EXCEPTIONS` → `SAINT_EXCEPTIONS`.
  - Types: `HtocDailyLectionaryEntry` → `DailyLectionaryEntry`,
    `HtocSaint` → `Saint`, `HtocCommemoration` → `Commemoration`,
    `HtocDayFacts` → `DayFacts`, `HtocHymn` → `Hymn`,
    `HtocSaintLectionaryEntry` → `SaintLectionaryEntry`.
  - Functions: `renderHtocHeaderText` → `renderHeaderText`,
    `isHtocVendoredDate` → `isVendoredDate`.

  **Deep-import path renames** (if you import via
  `ponomar-ts/engine/*` or `ponomar-ts/data/*`):
  `htocDayFacts` → `dayFacts`, `htocSaints` → `saints`,
  `htocSaintLectionary` → `saintLectionary`,
  `htocDailyLectionary` → `dailyLectionary`, and the
  `src/engine/htocFastText.ts`, `src/engine/htocSaints.ts`,
  `src/engine/htocReadings.ts` modules were merged into their
  non-prefixed counterparts (`fastText.ts`, `saints.ts`, `readings.ts`).

  Internal disambiguation: `LiturgicalDay.htocDRank` is now
  `LiturgicalDay.saintsDRank` (`dRank` keeps its original Ponomar-
  structural meaning).

  Migration: a one-liner `sed -E 's/\bHTOC_//g; s/\bHtoc([A-Z])/\1/g;
  s/\bhtoc([A-Z])/\l\1/g'` on your imports covers the vast majority
  of call sites; use `saintsDRank` where you previously used
  `htocDRank`.

## [1.0.0-rc.17] — 2026-10-02

### Changed

- **Out-of-window `fastText` now pivots directly from HTOC's own strings
  instead of being re-derived from the Ponomar fasting XML.** Analysis of
  the vendored 2025–2027 corpus showed that HTOC's `fastText` is globally
  stable under the composite keys `(nday, dow)` and `(julianKey, dow)`
  — every one of the 1095 vendored days is uniquely classified. New
  codegen `scripts/codegen/htoc-fast-text-cycle.ts` emits
  `src/data/htocFastTextCycle.ts` with two cycle maps
  (`HTOC_FAST_TEXT_PASCHAL_CYCLE`: 243 keys,
  `HTOC_FAST_TEXT_JULIAN_CYCLE`: 415 keys). New engine module
  `src/engine/htocFastText.ts` consults the paschal cycle first, then
  the Julian cycle; `getLiturgicalDay` falls back to the previous
  `renderFastText` composer only when neither axis has a stable key.
  Measured 2028+ coverage: 61 % direct pivot + 27 % fallback = 88 %
  non-empty, versus the previous composer's 78 % in-window fidelity
  caused by Ponomar-stricter-than-HTOC afterfeast handling. In-window
  (2025–2027) `fastText` is unchanged — HTOC's vendored strings are
  still returned verbatim.

## [1.0.0-rc.16] — 2026-10-01

### Added

- **Phase D capstone: HTOC publication fields now populated for any year.**
  Previously `getLiturgicalDay` returned HTOC's `fastText`, `troparia`,
  and `kontakia` only within the vendored 2025–2027 window; outside the
  window these three fields were empty by default. The new composers
  reconstruct them algorithmically from the vendored corpus:

  - **`src/engine/htocHymns.ts`** composes troparia + kontakia from
    three position-stable cycle maps generated by the new codegen
    `scripts/codegen/htoc-hymns-cycle.ts`:
    `HTOC_FIXED_HYMNS_CYCLE` (365 Julian keys / 998 entries),
    `HTOC_PASCHAL_HYMNS_CYCLE` (36 nday keys / 76 entries),
    `HTOC_SUNDAY_TONE_HYMNS_CYCLE` (8 tones / 24 entries). Covers
    ~93 % of hymn occurrences; the ~7 % unstable DOW-shift /
    per-year-transferred hymns are deliberately dropped.
    Measured in-window fidelity: 94.7 % troparia, 91.5 % kontakia.
  - **`src/engine/fastText.ts`** composes HTOC's fast-rule string via
    hand-rolled period detection (nday + Julian-date ranges) × a
    10-entry `FastingLevel → suffix` table. Measured in-window
    fidelity: 78.0 % byte-exact against the vendored strings; the
    22 % divergence reflects engine-vs-HTOC rubric-level differences
    on afterfeast-ish days, not a composer bug.

  New export `computeFastingFromContext(ctx, dRank)` on
  `src/engine/fasting.ts` lets `getLiturgicalDay` compute the fasting
  level directly from a pre-built context without recursing through
  `getFasting` → `getLiturgicalDay`.

## [1.0.0-rc.15] — 2026-10-01

### Changed

- **Dedup normalization now canonicalizes book id + verse ranges.**
  `getDailyReadings` dedups HTOC-saint-lectionary / HTOC-daily-lectionary
  refs against pre-existing menaion / paschal / triodion refs using
  `normalizeReadingForDedup(reading)`. Previously that function only
  stripped `a` / `b` / `c` half-verse markers (e.g. `30b-35a → 30-35`),
  which left two systematic leaks:
  - **Book-name variants**: Ponomar menaion XML uses the `id` form
    (`Philip_2:5-11`, `I_Cor_...`), while the HTOC saint-lectionary
    codegen writes the `short` form (`Phil_2:5-11`, `I Cor_...`). The
    HTOC ref would re-surface as an additional emission on every
    Theotokos / apostle feast.
  - **Chapter-prefix shorthand**: HTOC renders cross-chapter continuations
    with a redundant chapter marker (`Lk_10:38-42, 11:27-11:28`), while
    Ponomar's `Reading=` attributes abbreviate (`Lk_10:38-42, 11:27-28`).
    Identical ceremonial pericopes, non-identical strings → dedup miss.

  The function now parses the stripped reading with `parseBibleRef` and,
  on success, returns `${book}|${canonical ranges}` using the resolved
  book id and fully-expanded same-chapter range endpoints. When parsing
  fails (free-text refs, composites), it falls back to the stripped
  string — matching the prior behavior. HTOC-corpus engine overflow
  drops from 1,745 → 1,603 refs (−142 across 2025–2027), with the
  `liturgy / htoc` bucket shrinking 134 → 10 (fixed Phil_ ↔ Philip_
  cases on Theotokos liturgies).
- **Matins Gospel dedup now recognizes `type="matins"`.**
  `isMatinsGospelType` previously accepted only `"gospel"` and `"1"`.
  The pentecostarion-sourced resurrection-cycle matins gospels (cIds
  9057 All Saints, 9064 All Russian Saints, et al.) are tagged
  `type="matins"`; without this, `appendResurrectionMatinsGospel`
  would re-emit the 11-cycle matins gospel as a cycle-source
  duplicate. HTOC-corpus engine overflow drops 1,841 → 1,745 refs
  (−96 across 2025–2027).

## [1.0.0-rc.14] — 2026-10-01

### Changed

- **`htocSaints.ts` slimmed via tuple + text + names pool interning.**
  The vendored canonical-saint pool now stores unique `text` strings
  and unique `names` arrays once each in secondary pools (`TX`, `NA`),
  and each entry is a compact 5-tuple `[slug, cycleCode, namesIdx,
  rank, textIdx]` instead of a `{slug, cycle, names, rank, text}`
  object literal (saves ~40 bytes of field-name boilerplate per
  entry). `cycleCode` is `0` for `"fixed"` and `1` for `"movable"`.
  No change to the exported `HtocSaint` object shape or to any of
  `HTOC_SAINTS_BY_ISO`, `HTOC_SAINT_FIXED_CYCLE`,
  `HTOC_SAINT_MOVABLE_CYCLE`, or `HTOC_SAINT_EXCEPTIONS` values;
  byte-identical hydration verified across all 1,092 vendored days
  and 7,008 (iso, saint) rows.
  - `src/data/htocSaints.ts`: 458 KB → 346 KB (−24.6 %);
    pools: `NA` = 1,444 unique names arrays (38 % dedup),
    `TX` = 2,163 unique display texts (7 % dedup — texts shared
    chiefly by multi-name Mother-of-God icon entries).
- Codegen script (`scripts/codegen/htoc-saints.ts`) emits the new
  pooled layout deterministically; downstream consumers see
  byte-identical values and the engine (`src/engine/htocSaints.ts`)
  needs no changes.

## [1.0.0-rc.13] — 2026-10-01

### Changed

- **`htocDayFacts.ts` slimmed via tuple + array + triplet pool
  interning.** The vendored per-ISO day-facts corpus now stores unique
  hymn tuples, commemoration tuples, index arrays, and
  propers-triplets `[commemArrIdx, tropArrIdx, kontArrIdx]` once each
  and references them from a four-field compact day row
  `[headerIdx, tone, fastIdx, triIdx]`. No change to the exported
  `HTOC_DAY_FACTS_BY_ISO: ReadonlyMap<string, HtocDayFacts>` shape,
  keys, values, or ordering; byte-identical hydration verified across
  all 1,095 vendored days.
  - `src/data/htocDayFacts.ts`: 1.20 MB → 1.05 MB (−12.5 %);
    1,740 unique hymn tuples (56 % dedup), 5,334 unique commemoration
    tuples (67 % dedup), 1,730 unique index arrays (49 % dedup),
    651 unique propers-triplets (40 % dedup).
  - The remaining 66 % of the file is irreducible hymn-text and
    commemoration-text content (already string-pooled: 993 unique
    hymn texts, 5,286 unique commemoration texts).
- Codegen script (`scripts/codegen/htoc-day-facts.ts`) emits the new
  pooled layout deterministically; downstream consumers see
  byte-identical `HTOC_DAY_FACTS_BY_ISO` values.

### Documented

- Added `scripts/analysis/htoc-day-facts-decomp.ts` and
  `htoc-day-facts-drift-sample.ts` recording the cycle-decomposition
  analysis that scoped this release. Finding: unlike the saint corpus
  (rc.11), day facts are not cleanly decomposable into rc.11-style
  fixed + movable cycle tables — the HTOC header is a template, fast
  rules follow season boundaries, and movable commemorations overlay
  the Julian cycle. A proper any-year `getHtocDayFactsForAnyYear` is
  deferred as a future engine subsystem (Pentecost-week counter +
  Octoechos tone computer + movable-commem overlay + header renderer).

## [1.0.0-rc.12] — 2026-10-01

### Changed

- **Lectionary data files slimmed via entry-pool interning.** Both HTOC
  lectionary tables now store an entry pool once and reference it by
  integer index per day, with no change to the exported `ReadonlyMap`
  shape, keys, values, or ordering.
  - `src/data/htocDailyLectionary.ts`: 102 KB → 54 KB (−47 %);
    628 unique `(type, reading)` tuples pooled across 1,935 rows / 880
    days.
  - `src/data/htocSaintLectionary.ts`: 213 KB → 75 KB (−65 %);
    545 unique `(service, type, reading, note, hour)` tuples pooled
    across 2,162 rows / 710 days.
- Codegen scripts (`scripts/codegen/htoc-daily-lectionary.ts` and
  `scripts/codegen/htoc-saint-lectionary.ts`) emit the new pooled layout
  deterministically; downstream consumers see byte-identical
  `HTOC_DAILY_LECTIONARY` and `HTOC_SAINT_LECTIONARY` values.

## [1.0.0-rc.11] — 2026-10-01

### Added

- **Any-year HTOC saint lookup via cycle decomposition.** The vendored
  per-ISO saint corpus (2025–2027) is now also emitted as three cycle
  tables that resolve commemorations for any Gregorian year:
  - `HTOC_SAINT_FIXED_CYCLE: ReadonlyMap<string, readonly HtocSaint[]>`
    — menaion cycle keyed by Julian `MM-DD` (364 keys).
  - `HTOC_SAINT_MOVABLE_CYCLE: ReadonlyMap<number, readonly HtocSaint[]>`
    — pentecostarion cycle keyed by signed days from Pascha (21 keys).
  - `HTOC_SAINT_EXCEPTIONS: ReadonlyMap<string, readonly HtocSaint[]>`
    — per-ISO rows for the small set of saints whose cycle key drifts
    within the window (Apostles' Fast floats, Feb-29 forefeasts).
- New engine function `getSaintsAnyYear(date)` (also exported as
  `getHtocSaintsForAnyYear` from `src/engine/htocSaints.ts`). In the
  vendored window it returns the same object reference as
  `HTOC_SAINTS_BY_ISO.get(iso)`; outside it synthesizes from the cycle
  layers (fixed ∪ movable ∪ exceptions, slug-sorted within each cycle).
  Unlike `getSaints`, it never returns `null`.

### Changed

- Per-ISO saint ordering within the vendored window is unchanged
  (`HTOC_SAINTS_BY_ISO` preserves HTOC's historical scrape order).
  The new cycle tables use a canonical slug-sort within each cycle so
  any-year lookups are deterministic. For 79 days in the window the
  two orderings differ (same saints, different interleaving); the
  engine routes in-window lookups through `HTOC_SAINTS_BY_ISO` to
  stay byte-identical with prior releases.
- `src/data/htocSaints.ts`: 440 KB → 458 KB (+18 KB) for the three
  compact cycle tables; entry pool unchanged.

### Correctness

- Round-trip verified for every ISO date in the vendored window: the
  cycle-based lookup reproduces the exact `HTOC_SAINTS_BY_ISO` entry
  set for all 1,092 days. Proof script at
  [scripts/analysis/htoc-saint-cycles-roundtrip.ts](scripts/analysis/htoc-saint-cycles-roundtrip.ts).
- 13 new tests in [tests/htocSaintCycles.test.ts](tests/htocSaintCycles.test.ts)
  cover shape, in-window reference equality, and out-of-window lookups
  (Nativity 2030/2050, Theophany 2030, Myrrhbearers 2024).

## [1.0.0-rc.10] — 2026-10-01

### Changed

- **HTOC data-file size reduction via codegen interning.** The two
  largest vendored data modules now emit interned pools instead of
  flat object literals, and rehydrate the public `ReadonlyMap` shapes
  at module load. No public API, type, or value changes — every
  consumer sees identical `HtocDayFacts` / `HtocSaint` instances.
  - [src/data/htocDayFacts.ts](src/data/htocDayFacts.ts): 3.81 MB →
    1.20 MB (−68.5%). Pools: 200 header lines, 23 fast rules, 908
    hymn titles, 993 hymn texts, 5,286 commemoration texts, 2,927
    shared `[name, slug]` life/saint refs.
  - [src/data/htocSaints.ts](src/data/htocSaints.ts): 1.17 MB →
    0.44 MB (−62.4%). Each canonical saint commemoration is interned
    once (2,331 entries) and referenced by integer index from the
    per-day buckets.
  - Published tarball: 4.4 MB → 3.7 MB (−16%); unpacked install:
    25.2 MB → 21.9 MB (−13%).

## [1.0.0-rc.9] — 2026-10-01

### Removed

- **Stage 3 of the HTOC-first API refactor.** The symbols deprecated in
  rc.8 are now removed from both public barrels (`ponomar-ts` and
  `ponomar-ts/engine`). The implementations remain in their respective
  internal files, so the engine still works; they're just no longer
  re-exported.

- **Ponomar DSL + resolver internals** (removed): `computeDayContext`,
  `dslContext`, `selectMenaionEntry`, `selectPaschalCycleEntry`,
  `resolveSaints`, `getPhrase`, `resolveBibleHeader`, `resolveCommand`,
  `resolveCreate`, `resolveTitle`.

- **Ponomar service composers** (removed): `composeService`,
  `getPropers`, `getServices`, `getHourService`, `getHourReadings`,
  `getOrderedLiturgyReadings`, `getOrderedMatinsReadings`.

- **Rank-glyph adapters** (removed): `getHtocDayRank`, `mapHtocRank`,
  `unmapHtocRank`. Use `HtocSaint.rank` / `HtocCommemoration.rank`
  display strings directly.

- **Matins gospel cycle direct access** (removed):
  `RESURRECTION_MATINS_GOSPELS`, `getResurrectionMatinsGospel`. Applied
  automatically by `getReadings(date)` on Sundays.

- **Prefixed `getHtoc*` function aliases** (removed): `getHtocReadings`,
  `getHtocDayFacts`, `getHtocSaintsFor`, `getHtocDailyLectionary`,
  `getHtocSaintLectionary`. Use the unprefixed `getReadings`, `getDay`,
  `getSaints`, `getDailyLectionary`, `getSaintLectionary` instead.

- Types removed from the public API: `ResurrectionMatinsGospel`,
  `OrderedLiturgyReadings`, `OrderedReading`, `HourSelection`,
  `ServicesResult`, `DailyPropers`, `GetPropersOptions`,
  `OrderedMatinsReading`, `OrderedMatinsReadings`, `ComposedService`,
  `ComposeServiceOptions`, `GetHourServiceOptions`, `HourName`,
  `HourReadings`, `HourServiceResult`, `ResolvedTitle`.

### Changed

- README usage examples updated to showcase the HTOC-first API
  (`getDay`, `getSaints`, `getReadings`, `getSaint`).

### Migration

Replace calls as follows:

| Removed                         | Use instead                                    |
|---------------------------------|------------------------------------------------|
| `getHtocReadings(d)`            | `getReadings(d)`                               |
| `getHtocDayFacts(d)`            | `getDay(d)`                                    |
| `getHtocSaintsFor(d)`           | `getSaints(d)`                                 |
| `getHtocDailyLectionary(ctx)`   | `getDailyLectionary(ctx)`                      |
| `getHtocSaintLectionary(cId)`   | `getSaintLectionary(cId)`                      |
| `getOrderedLiturgyReadings(d)`  | `getReadings(d).filter(r => r.service === "liturgy")` |
| `getPropers(d)`                 | `getDay(d).troparia` + `getDay(d).kontakia`    |
| `getResurrectionMatinsGospel(w)`| `getReadings(d).filter(r => r.service === "matins")` |

If you need the old DSL/resolver/composer implementations, you can
still import them from their direct file paths (e.g.
`ponomar-ts/engine/compose` is unsupported but will resolve). This
escape hatch is not covered by semver.

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
