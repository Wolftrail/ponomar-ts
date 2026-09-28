# Plan: Port Ponomar Java → ponomar-ts (TypeScript)

**Target repo**: `ponomar-ts` (Node ≥ 20, ESM, strict TS, zero runtime deps,
GPL-3.0-or-later).
**Upstream source of truth**: [typiconman/ponomar](https://github.com/typiconman/ponomar)
(GPL-3.0, ~45 Java files + ~400 XML data files), checked out locally at
`c:\Users\wolfg\Documents\GitHub\ponomar` for development.

---

## TL;DR

Port the *engine* (not the Swing UI) of upstream Ponomar into `ponomar-ts` as a
library that runs in Node and modern browsers. Strategy: **precompile all
upstream XML data to typed TypeScript at build time** via a `scripts/codegen/`
pipeline, then implement the runtime engine (StringOp DSL evaluator, Julian
date math, service/reading/fasting rule application) in pure TypeScript with
zero runtime deps. Ship in phases; the first useful release (M1) delivers
calendar + daily Gospel/Epistle readings for the Bible site.

---

## Decisions

| Decision | Choice |
| --- | --- |
| **XML data strategy** | Precompile XML → typed TS at build time. Codegen consumes the upstream repo; runtime imports generated modules. No XML parser at runtime. |
| **First milestone (M1)** | Calendar core + StringOp DSL + Day loader + DivineLiturgy reading selection → "today's Gospel/Epistle" is queryable. |
| **Localization** | Deferred. Engine returns raw IDs (saint ids, reading refs, phrase keys). Consumers handle their own i18n. |
| **Runtime targets** | Node ≥ 20 + modern browsers (isomorphic). No `node:fs` in `src/core/`; data is imported as static modules or injected via a `DataProvider` interface. |
| **UI** | Not ported. All Swing classes (`Main`, `JCalendar`, Bible viewer, etc.) are out of scope. |
| **Upstream integration** | Add upstream as a git submodule at `vendor/ponomar/` so codegen has a pinned, reproducible source. Version-pin by SHA. |
| **License** | GPL-3.0-or-later on all ported files. Every ported source file gets a `// Ported from Ponomar/<File>.java` header per repo convention. |
| **Data format** | Strict TS types generated alongside the data; use `as const satisfies` to keep the literals type-checked without inflating output. |

---

## Architecture

### Runtime layers (bottom-up)

```
src/
  core/                    # Pure engine, no I/O. Deterministic.
    calendar/              # JDate, PCalendar, Paschalion, conversions
    dsl/                   # StringOp: lexer + parser + evaluator
    types/                 # Shared domain types (DayInfo, Rank, Tone, etc.)
  data/                    # Generated typed modules
    commands/              # DivineLiturgy, Fasting, ServiceRules, ScriptureTransfers
    calendar/
      pentecostarion.ts    # 315 movable days
      triodion.ts          # 70 pre-Pascha days
      menaion/             # 12 months × ~31 days of fixed feasts
    services/              # Kathismas 1-20, Hours, etc.
    bible/                 # Book/chapter/verse index (no text — text is per-locale, out of scope)
  engine/                  # Uses core + data to answer questions
    day.ts                 # Compose full DayInfo for a JDate
    readings.ts            # DivineLiturgy1 port: pick Gospel/Epistle
    fasting.ts             # Fasting rule applier
    services.ts            # ServiceInfo rule applier
    commemorations.ts      # Commemoration1 port
  astronomy/               # Sunrise, moon phase — optional side module
  index.ts                 # Barrel; deep imports encouraged
scripts/
  codegen/
    xml-to-json.ts         # Reads vendor/ponomar/**/*.xml → src/data/**/*.ts
    parse-day-xml.ts       # Day/saint schema
    parse-commands-xml.ts  # DivineLiturgy/Fasting/ServiceRules
    parse-services-xml.ts  # Service templates
    parse-bible-index.ts   # Bible book/chapter structure
tests/
  # one .test.ts per src module, plus fixture-driven regression tests
  fixtures/                # Known dates with expected outputs (from Perl scripts)
vendor/
  ponomar/                 # git submodule → upstream repo
```

### Data flow at runtime

```
consumer date (Y/M/D)
  → JDate (Julian) via calendar/
  → derive doy, dow, nday, ndayP, ndayF via Paschalion
  → load day from generated data (triodion|pentecostarion|menaion based on nday, doy)
  → derive dRank, tone from day record
  → build DayInfo (typed record of variables + values)
  → engine/readings.ts applies DivineLiturgy.xml rules (StringOp evaluates Cmd/Value)
  → returns { epistle: Ref[], gospel: Ref[] } (raw scripture refs)
```

### Key TS design decisions

1. **`JDate` as a value object** (`readonly { m, d, y }`) rather than a mutable
   class, avoiding the mutation footguns of the Java `addDays()` API. Provide
   pure `addDays(jd, n)`.
2. **`OrderedHashtable` → `Map<K, V>`**. `Map` already preserves insertion
   order in JS. Only introduce a wrapper if a call site depends on ordered
   *iteration*; otherwise use a plain `Record`.
3. **StringOp → proper tokenizer + Pratt parser** rather than the upstream
   rightmost-scan approach. Simpler, correct, testable; behaviour must match
   upstream on a corpus of known expressions from the XML rule files.
4. **DSL context is a `DayInfo` type** with typed fields (`doy: number`,
   `dow: 0..6`, `nday: number`, `dRank: 0..8`, `GS: 0 | 1`, etc.), not a
   stringly-typed map. The evaluator accepts `Record<string, number | boolean>`.
5. **`DataProvider` interface** in `src/core/data-provider.ts`. The default
   implementation reads from the bundled generated modules; alternative
   implementations (e.g. lazy fetch) are pluggable, satisfying the
   "no `fs` in `src/core/`" rule from `AGENTS.md`.
6. **Codegen output = `.ts` modules** (not `.json`), using
   `as const satisfies X`. This gives literal types, tree-shakeability, and no
   JSON parsing cost at import.

---

## Phased roadmap

### Phase 0 — Vendoring & scaffolding *(prerequisite; small)* — ✅ done

- Add upstream as git submodule under `vendor/ponomar/` (pinned to current
  HEAD).
- Add `scripts/codegen/` folder skeleton and an `npm run codegen` script.
- Extend `tsconfig` paths / build config so `src/data/` is compilable but
  excluded from `dist` if we decide to ship pre-generated only.
- Update [AGENTS.md](AGENTS.md) and [README.md](README.md) with the codegen
  workflow.

### Phase 1 — Core calendar *(M1 part 1; foundation)* — ✅ done

Parallel-safe steps:

- **1a.** `src/core/calendar/jdate.ts` — port `JDate.java`. Pure functions:
  `julian(year, month, day)`, `addDays`, `subtractDays`, `getDayOfWeek`,
  `difference`. Value object. Julian leap-year rule. Include the custom mod
  for 1-based months.
- **1b.** Extend [src/paschalion.ts](src/paschalion.ts) with additional derived
  dates ported from `Paschalion.java`: `getPentecost`, `getLentStart`,
  `getApostlesFastStart`, `getMeatfare`, `getCheesefare`, plus helpers for
  `nday`, `ndayP`, `ndayF` (relative to Pascha of that year / prev / next).
- **1c.** `src/core/calendar/pcalendar.ts` — Gregorian ↔ Julian conversion
  (already partly present in `paschalion.ts`; unify).
- **1d.** Fixture tests — reproduce known Pascha dates and derived feasts for
  a spread of years (from upstream `scripts/Perl/paschalion.pl`).

Verification: `npm test` passes the Paschalion regression fixture (drawn from
upstream Perl script output) for years 1900–2100.

### Phase 2 — StringOp DSL *(M1 part 2; the engine's heart)* — ✅ done

- **2a.** `src/core/dsl/lexer.ts` — tokenize numbers, identifiers,
  `+ - * / %`, `== != < > <= >=`, `&& ||`, `!`, `( )`, whitespace.
- **2b.** `src/core/dsl/parser.ts` — Pratt parser with precedence matching
  upstream. Produces an AST.
- **2c.** `src/core/dsl/eval.ts` — evaluator over AST with a typed context
  `Record<string, number | boolean>`. Boolean results returned as `boolean`;
  numeric coercion mirrors upstream (`0 = false`, `!= 0 = true`).
- **2d.** Corpus test: harvest every `Cmd=` and `Value=` string from upstream
  Commands XML into `tests/fixtures/dsl-expressions.json`; for each, verify
  with sample contexts against manually-computed expected results. This is
  the single most important regression suite for the port.

Verification: run corpus against evaluator; 100% match. Add ~30 hand-written
unit tests covering precedence, unary ops, short-circuiting.

### Phase 3 — Codegen: static rule data *(M1 part 3)*

- **3a.** `scripts/codegen/parse-commands-xml.ts` — read `DivineLiturgy.xml`,
  `Fasting.xml`, `ServiceRules.xml`, `ScriptureTransfers.xml`. Emit
  `src/data/commands/*.ts` with typed arrays of
  `{ name, value, cmd?, comment? }` records.
- **3b.** `scripts/codegen/parse-day-xml.ts` — read every `triodion/*.xml` and
  `pentecostarion/*.xml`. Emit `src/data/calendar/{triodion,pentecostarion}.ts`
  as arrays indexed by day number, each element `{ saints: SaintRef[] }` with
  `{ sId, cId, tone }`.
- **3c.** `scripts/codegen/parse-menaion-xml.ts` — read `xml/[MM]/[DD].xml`.
  Emit `src/data/calendar/menaion.ts` as a 12-array of 31-arrays.
- **3d.** TS types in `src/core/types/`: `SaintRef`, `CommandRule`, `Period`,
  `DayRank`, etc.
- **3e.** Regenerate reproducibly: `npm run codegen` overwrites `src/data/`
  deterministically; CI can verify no drift.

Verification: `tsc --noEmit` on generated files; snapshot test on a handful of
generated records (e.g. Pascha day, Christmas, Forgiveness Sunday).

### Phase 4 — Day composition & readings *(M1 part 4; the deliverable)*

- **4a.** `src/engine/day.ts` — given a `JDate`, produce a full `DayInfo`:
  `{ doy, dow, nday, ndayP, ndayF, dRank, tone, saints }`. Rank is the max
  rank over all commemorations for that day (upstream logic).
- **4b.** `src/engine/readings.ts` — port `DivineLiturgy1.java`'s core
  `Readings()` method. Uses StringOp on the DivineLiturgy commands. Ignores
  transferred-reading tomorrow/yesterday cross-day recursion for M1 (mark as
  a TODO for Phase 7).
- **4c.** Public API:
  `getDailyReadings(gregorianDate, { scheme: 'lucan' | 'jordanville' }): { epistle: Ref[], gospel: Ref[] }`.
- **4d.** Golden tests: run against upstream Perl `test_lj.pl` output for a
  full year of dates.

Verification: on a curated set of 20+ liturgically significant dates (Pascha,
Nativity, Theophany, Sundays after Pentecost, Great Lent weekdays), the
generated readings match upstream. Publish a comparison harness.

**→ M1 SHIP TARGET: end of Phase 4.** The Bible site can now render "Today's
Epistle & Gospel".

### Phase 5 — Fasting *(post-M1)*

- Port `Fasting.java` as `src/engine/fasting.ts`. Reuses StringOp + generated
  `Fasting.xml` rules. Returns 7-bit fasting code + level enum.

### Phase 6 — Service selection *(post-M1)*

- Port `ServiceInfo.java` → `src/engine/services.ts`. Determines which
  services apply on a given day (Prime type, Kathisma numbers, etc.). Returns
  a structured selection; does not compose the text.

### Phase 7 — Service composition & commemorations *(later)*

- Port `Service.java`, `Commemoration1.java`, `Matins.java`, `RoyalHours.java`,
  `UsualBeginning.java`, `{Third,Sixth,Ninth}Hour.java`.
- These are template engines that emit ordered structural output
  (`{ kind: 'bible', ref } | { kind: 'create', what, times } | ...`), which
  callers can render.
- Sequential-readings cross-day recursion (yesterday/tomorrow) added here.

### Phase 8 — Astronomy *(optional, standalone)*

- Port `Sunrise.java` and lunar phase from `Paschalion.java` into
  `src/astronomy/`. No dependency on the rest of the engine.

### Phase 9 — Bible index *(later)*

- Port `Bible.java`'s reference parser (book abbrev → canonical id,
  chapter/verse). No text — text lives in whatever Bible dataset the consumer
  chooses.

### Explicitly out of scope (initial port; may reconsider later)

- All Swing UI: `Main`, `JCalendar`, `JDaySelector`, `IconDisplay`,
  `PrintableTextPane`, `LanguageSelector`, `PrimeSelector`, `About`,
  `Options`, `Reporter`, `MenuFiles`, `DoSaint1`, `GospelSelector`, `Bible`
  (UI portions).
- `Database.java` (unused HSQLDB).
- `Languagizer.java` (experimental Slavonic inflection).
- `Search.java` (belongs at the app layer).
- `RuleBasedNumber.java` (needed only for UI output; consumer can format).
- `LanguagePack.java` (deferred by decision).
- Deprecated files (`.old`, `Main_old.txt`, obsolete `Commemoration.java`,
  `DivineLiturgy.java.old`).

---

## Relevant files

### To create in `ponomar-ts`

- `vendor/ponomar/` — git submodule of upstream
- `scripts/codegen/xml-to-json.ts` — entry point; walks `vendor/` and
  dispatches per-schema parsers
- `scripts/codegen/parse-*.ts` — one per XML schema
- `src/core/calendar/jdate.ts` — port of `JDate.java`
- `src/core/calendar/pcalendar.ts` — port of `PCalendar.java`
- `src/core/dsl/{lexer,parser,eval,types}.ts` — StringOp reimplementation
- `src/core/types/index.ts` — `DayInfo`, `SaintRef`, `Rank`, `Tone`,
  `CommandRule`, etc.
- `src/core/data-provider.ts` — pluggable data provider interface
- `src/data/**/*.ts` — generated typed data (checked in for zero-cost import)
- `src/engine/day.ts` — day composition
- `src/engine/readings.ts` — port of `DivineLiturgy1.java` (core `Readings()`
  method)
- `src/engine/fasting.ts` — port of `Fasting.java`
- `src/engine/services.ts` — port of `ServiceInfo.java`
- `tests/fixtures/dsl-expressions.json` — harvested from upstream XML
- `tests/fixtures/pascha-years.json` — from upstream Perl `paschalion.pl`
- `tests/fixtures/readings-golden.json` — from upstream Perl `test_lj.pl`

### To extend

- [src/paschalion.ts](src/paschalion.ts) — add Pentecost, Lent start, `nday`
  derivations
- [src/index.ts](src/index.ts) — add new module barrels
- [package.json](package.json) — add `"codegen"` script; add `.xml` glob to
  codegen inputs
- [AGENTS.md](AGENTS.md) — document `vendor/`, codegen, and new layout

### Upstream references (read-only; not modified)

- `vendor/ponomar/Ponomar/JDate.java`
- `vendor/ponomar/Ponomar/Paschalion.java`
- `vendor/ponomar/Ponomar/StringOp.java` — the DSL specification
- `vendor/ponomar/Ponomar/DivineLiturgy1.java` — reading selection reference
- `vendor/ponomar/Ponomar/xml/Commands/*.xml` — codegen inputs
- `vendor/ponomar/Ponomar/xml/{triodion,pentecostarion}/*.xml` — codegen
  inputs
- `vendor/ponomar/Ponomar/xml/[MM]/[DD].xml` — menaion codegen inputs
- `vendor/ponomar/Ponomar/scripts/Perl/{paschalion.pl,test_lj.pl}` —
  regression sources

---

## Verification plan

### Automated

1. `npm run typecheck` clean after each phase.
2. `npm test` per phase:
   - Phase 1: Pascha regression across 200+ years.
   - Phase 2: 100% match of upstream DSL expressions on the harvested corpus
     + hand-written precedence tests.
   - Phase 3: snapshot tests on generated data for anchor days.
   - Phase 4: readings golden test on 100+ dates covering all four cycles
     (Great Lent, Pentecostarion, ordinary time, Nativity fast).
   - Phase 5: fasting code match on anchor dates (strict Wed/Fri, feast
     breaks).
3. `npm run codegen -- --check` in CI verifies no drift between `vendor/` and
   generated `src/data/`.

### Manual

1. Spot-check a Sunday's readings against a published Orthodox calendar
   (e.g. oca.org).
2. Confirm bundle size is acceptable: `dist/` under some modest budget
   (target < 2 MB minified with data; data is the bulk).
3. Confirm the browser build works: import via Vite or plain ESM in a scratch
   HTML page; call `getOrthodoxPascha(2026)` and `getDailyReadings(...)`.

---

## Further considerations

1. **Upstream inclusion mechanism** — Option A: git submodule under
   `vendor/ponomar/`. Option B: `npm run vendor:sync` script that copies a
   pinned tarball into `vendor/`. Option C: read from an absolute path
   outside the repo (developer machine only; codegen output is what's
   committed). *Recommendation: A (submodule)* — reproducible, CI-friendly,
   clear provenance.

2. **Generated data location & size** — 400 XML files could produce sizable
   generated code. Options: (A) commit generated `.ts` under `src/data/`
   (transparent, IDE-navigable, git-diffable when data changes). (B) generate
   at `npm install` via a `postinstall` hook (smaller repo, more fragile).
   *Recommendation: A* — this is a data-heavy library and consumers benefit
   from tree-shaking literal types.

3. **Cross-day recursion in readings** — upstream `DivineLiturgy1` recursively
   evaluates tomorrow's/yesterday's readings when transfer rules apply.
   *Recommendation*: defer to Phase 7 in the M1 cut; document the limitation,
   ship M1 without it, add in a follow-up milestone with its own golden
   fixtures.

4. **DSL fidelity vs. clarity** — upstream `StringOp` uses a
   rightmost-operator-scan approach that's not standard. *Recommendation*:
   implement a proper Pratt parser with a precedence table matching upstream
   operator precedence; add a differential test harness that runs the same
   expressions through both implementations on a corpus. If any divergence is
   found, upstream's behaviour wins (bug-for-bug compatibility for rule
   files).

5. **Julian vs Gregorian API surface** — upstream is Julian-native.
   *Recommendation*: engine internals stay Julian (matches upstream, easier
   date math for the liturgical year); public API accepts Gregorian `Date` or
   `CalendarDate` and converts. Both `getOrthodoxPascha` (Gregorian, already
   implemented) and `getJulianPascha` (Julian) stay exposed.
