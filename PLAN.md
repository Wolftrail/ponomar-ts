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

### Phase 3 — Codegen: static rule data *(M1 part 3)* — ✅ done

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

**Status: ✅ Phase 4a-4c done; readings deferred to Phase 5 (needs Commemorations codegen).**

Shipped this phase:

- **4a. ✅ `src/engine/day.ts`** — `computeDayContext(gregorianDate)` → `{ gregorian, julian, doy, dow, nday, ndayP, ndayF }`. `dslContext(ctx)` returns a flat record ready for the StringOp evaluator (with `dRank: 10` fallback matching upstream initial state).
- **4b. ✅ `src/engine/lookup.ts`** — `selectPaschalCycleEntry(ctx)` picks the correct `PENTECOSTARION[nday]`, `TRIODION[|nday|-1]`, or `PENTECOSTARION[ndayP]` DayEntry per upstream selection rules. `selectMenaionEntry(ctx)` looks up `MENAION[JulianMM-DD]`. Menaion codegen now unions the canonical `languages/xml/{MM}` tree with the Slavonic `languages/cu/xml/{MM}` fallback, giving full-year coverage (366 keys incl. leap day). XML parser now tolerates a leading UTF-8 BOM.
- **4c. ✅ `src/engine/resolve.ts`** — `resolveSaints(entry, ctx)` filters saints by their `Cmd` DSL guard and resolves numeric `Tone` expressions to integers.
- **4d. ✅ Public API** — `getLiturgicalDay(gregorianDate)` → `{ context, paschalSaints, menaionSaints, allSaints }`. Exposed via `src/engine/index.ts`, top barrel, and `./engine` subpath export.
- **4e. ✅ Tests** — 10 new `tests/engine.test.ts` cases: Pascha 2020 = nday 0 & Sunday; Julian Jan 1 → doy 0; negative/positive `nday` around Pascha; pentecostarion/triodion selection; Nativity (Julian Dec 25 = Greg Jan 7 2024) resolves to `MENAION["12-25"]` with cId `3174`; Cmd-guarded saints filtered; tones are finite integers.

Verification: 149/149 tests pass; `tsc --noEmit` clean; `npm run codegen -- --check` clean; `npm run build` clean.

**Milestone**: shipped as `ponomar-ts@0.1.0-alpha.0` on npm (dist-tag `alpha`).


### Phase 5 — Commemoration readings *(M1 completion; first-cut)*

**Status: ✅ Phase 5a-5c done; ordering logic deferred to Phase 5.5.**

Shipped this phase:

- **5a. ✅ Types** — `Scripture`, `ServiceContext`, `Commemoration` added to [src/data/types.ts](src/data/types.ts).
- **5b. ✅ Codegen** — [scripts/codegen/parseLife.ts](scripts/codegen/parseLife.ts) parses `languages/xml/lives/<cId>.xml`, capturing only `<SCRIPTURE>` elements with their service-block context (LITURGY / MATINS / VESPERS / PRIMES / TERCE / SEXTE / NONE). [scripts/codegen/emit.ts](scripts/codegen/emit.ts) `emitCommemorations` unions canonical `languages/xml/lives` with `languages/en/xml/lives` fallback. Emits `src/data/commemorations.ts` — 672 cIds with scripture. Files with no SCRIPTURE are skipped entirely. Cmd DSL guards validated at build time.
- **5c. ✅ Runtime API** — [src/engine/readings.ts](src/engine/readings.ts) provides `getDailyReadings(gregorian, { service?, type? })` and `getLiturgyReadings(gregorian)`. Filters saints' scriptures by Cmd DSL guard at runtime; each ref is tagged with its source (`paschal` | `menaion`).
- **5d. ✅ Tests** — [tests/readings.test.ts](tests/readings.test.ts) verifies Pascha 2020 → Acts 1:1-8 + Jn 1:1-17; Nativity 2024 → Gal 4:4-7 + Mt 2:1-12; service/type filters; source tagging. 155/155 total tests pass.
- **5e. ✅ Public API** — top-barrel exports `getDailyReadings`, `getLiturgyReadings`, `DailyReadings`, `ReadingRef`. Available via `ponomar-ts/engine` subpath too.

Deferred to Phase 5.5 (ordering, not blocking consumers who just need the raw refs):

- Port `DivineLiturgy1.Readings()` ordering: floaters → pentecostarion → menaion, Saturday inversion (menaion first), skipped-reading transfer ("Lucan jump") to the next weekday, cross-day recursion for transferred readings.
- Rank-aware SERVICE selection (`<SERVICE Type="N">` currently ignored; all scriptures collected regardless of the day's `dRank`).


### Phase 5.1 — Commemoration metadata & English lives *(UI-facing enrichment)*

**Status: ✅ done (shipped as `0.1.0-alpha.1`).**

Motivation: `ResolvedSaint` initially exposed only opaque `cId` / `sIds`. Consumers wiring the engine into UIs needed titles, feast ranks, biographical anchors and life prose. This phase adds those without a breaking change.

Shipped:

- **5.1a. ✅ Types** — [src/data/types.ts](src/data/types.ts) gains `SaintName` (Nominative / Short / Long / ShortN / ShortF / Index), `Church` (rank / cycle / tone), `SaintInfo` (birth/death year/month/day/note + place), and `Life` (body + Id / Copyright / Translator / Repose). `Commemoration` gains optional `name`, `church`, `info`.
- **5.1b. ✅ Codegen** — [scripts/codegen/parseLife.ts](scripts/codegen/parseLife.ts) now extracts NAME / CHURCH / INFO / LIFE in addition to SCRIPTURE, and accepts both `<SAINT>` and `<COMMEMORATION>` roots. [scripts/codegen/emit.ts](scripts/codegen/emit.ts) walks a list of source roots recursively and field-merges records when a cId appears in multiple sources (English NAME wins on individual attributes; scriptures concat; life body prefers whichever source had one). Sources unioned: `languages/xml/lives/`, `languages/xml/Commemorations/**`, `languages/en/xml/lives/`.
- **5.1c. ✅ Emitted modules** — `src/data/commemorations.ts` (~1.6 MB emitted TS: metadata for 3.4k cIds) + `src/data/lives.ts` (~1.6 MB emitted TS: 501 populated LIFE bodies + attribution).
- **5.1d. ✅ Runtime join** — [src/engine/resolve.ts](src/engine/resolve.ts) reads `COMMEMORATIONS` at runtime and adds optional `name`, `church`, `info` to every returned `ResolvedSaint`. Purely additive — no existing callers break.
- **5.1e. ✅ Subpath `ponomar-ts/lives`** — LIFE bodies live behind a dedicated subpath (`src/lives.ts` → `dist/lives.js`) so consumers who only need calendar + metadata do not pay the prose payload. Ships `LIVES` map + `getLife(cId)` helper.
- **5.1f. ✅ Tests** — new `tests/lives.test.ts` (Nativity has Bulgakov body; Emily has Repose metadata; ≥400 cIds have both metadata and a life) plus extra `tests/engine.test.ts` cases (Nativity resolves with joined name; Emily has short "Emily" + index "Emily of Cæsarea"). 162/162 tests pass.

**Language policy**: English only. Other languages are handled by consumers; the codegen does not pull in `languages/{cu,el,ru,fr,la,zh,ar}/xml/lives/`.


### Phase 6 — Fasting rules *(shipped as `0.1.0-alpha.2`)*

**Status: ✅ done.** Port of `Ponomar/Fasting.java` + `Commands/Fasting.xml`.

- **6a. ✅ Types** — [src/data/types.ts](src/data/types.ts) gains `FastingRule` (7-char bitstring + optional DSL `cmd`) and `FastingPeriod` (optional DSL `cmd` + ordered rules).
- **6b. ✅ Codegen** — [scripts/codegen/parseFasting.ts](scripts/codegen/parseFasting.ts) reads `Commands/Fasting.xml`, validating every `Cmd=` as DSL and every `Case=` as a `[01]{7}` bitstring. [scripts/codegen/emit.ts](scripts/codegen/emit.ts) emits `src/data/fasting.ts` exporting `FASTING_RULES: readonly FastingPeriod[]` in document order.
- **6c. ✅ `dRank` correctness** — [src/engine/day.ts](src/engine/day.ts) `dslContext` default changed from 10 → 0 to match upstream `Main.java`'s initial state. `LiturgicalDay` now carries a computed `dRank` = max of `church.rank` across all resolved saints (matches `Math.max(SolarCycle.getDayRank(), PaschalCycle.getDayRank())`). `getDailyReadings` passes the computed rank into the DSL context so `Cmd="dRank < 5"` guards on matins gospels finally resolve correctly.
- **6d. ✅ Runtime API** — [src/engine/fasting.ts](src/engine/fasting.ts) walks `FASTING_RULES` in order, skipping periods whose `cmd` is false, otherwise letting the last-matching rule's `case` win. Returns `{ case, level, permitted, isDefault, context }`. `level` maps the 9 canonical patterns (`no-food`/`strict`/`no-oil`/`oil`/`caviar`/`fish`/`meat-excluded`/`no-fast`/`wine`) plus `custom` fallback. `permitted` decodes the bitstring into `{ meat, dairy, fish, caviar, oil, cookedFood, food }` booleans.
- **6e. ✅ Public API** — top-barrel exports `getFasting`, `FastingResult`, `FastingLevel`, `FastingPermissions`. Also available via `ponomar-ts/engine`.
- **6f. ✅ Tests** — [tests/fasting.test.ts](tests/fasting.test.ts) covers 9 canonical days (Pascha / Bright Wed / Clean Mon / Cheesefare Wed / Great Fri / Apostles' Fast Wed / Nativity Fast Fri / Nativity Eve / Nativity itself) plus shape / bit-mapping invariants. 174/174 total tests pass.

Deferred: consumer-facing display strings (upstream's `convert()` produces localized human-readable prose from the bitstring — that's the front-end's job per the language policy above).


### Phase 5.5 — Divine Liturgy reading ordering *(shipped as `0.1.0-alpha.3`)*

**Status: ✅ partial — canonical ordering + Suppress + Class3Transfers classification. Cross-day transfers deferred to Phase 5.6.**

Ported from `Ponomar/DivineLiturgy1.java` (`Readings()` + `classifyReadings`), consuming the `DIVINE_LITURGY_COMMANDS` codegen (from `Commands/DivineLiturgy.xml`).

- **5.5a. ✅ Classification** — each `ReadingRef` is tagged `sequential` (movable-cycle placeholder, `cId` is a 4-digit number in `[9000, 9899]`) or `festal` (menaion, high-rank floater, anything else). Matches upstream `Commemoration1.getRank() === -2` semantics.
- **5.5b. ✅ Suppress** — `getOrderedLiturgyReadings` evaluates every `Suppress` COMMAND against the current day's DSL vars. On a match, sequential refs are dropped (Nativity, Theophany, their eves on non-Sat/non-Sun, Exaltation/Transfiguration on Sunday, etc.). Festal refs are preserved.
- **5.5c. ✅ Class3Transfers** — sequential refs matching a `Class3Transfers` COMMAND are moved to a separate `suppressed` bucket so consumers can either drop them or display them as "transferred to another day". Full cross-day transfer recursion is deferred.
- **5.5d. ✅ Saturday inversion** — on `dow === 6`, festal appears before sequential in the output; on every other weekday, sequential appears first. Matches upstream's `if (dow == 6)` branch.
- **5.5e. ✅ Rank-aware `<SERVICE Type>` selection** — **deferred**. Only 6 of 3,371 commemorations carry a `<CHURCH Rank>` in the current corpus, making rank-gated service selection meaningless for now. Revisit when a proper rank pipeline is in place.
- **5.5f. ✅ Public API** — `getOrderedLiturgyReadings(gregorian): OrderedLiturgyReadings` on the top barrel and `ponomar-ts/engine`. Returns `{ context, apostol, gospel, suppressed, refs }`; every entry extends `ReadingRef` with a `rank: "sequential" | "festal"` tag.
- **5.5g. ✅ Tests** — [tests/orderedLiturgy.test.ts](tests/orderedLiturgy.test.ts) covers classification, Suppress on Nativity, Pascha kept, Saturday vs. weekday inversion, and result-shape invariants. 185/185 total tests pass.

Deferred to a future **Phase 5.6** (Lucan jump / cross-day transfer):

- Port `TransferRulesB` (accept transfers from tomorrow) + `TransferRulesF` (accept from yesterday). Requires recursive `getOrderedLiturgyReadings` calls into adjacent days and merging their `suppressed` back into today's `refs`.
- Handle the September / October / November "Lucan jump" boundary where sequential-reading numbering shifts to a Lucan cycle.


### Phase 5.6 — Cross-day transfer *(shipped as `0.1.0-alpha.4`)*

**Status: ✅ done.** Ports upstream `DivineLiturgy1.Readings()`'s adjacent-day pull logic on top of the Phase 5.5 classification pipeline.

- **5.6a. ✅ `dowOrigin` on every `OrderedReading`** — the day-of-week a reading was originally scheduled for. Equals `context.dow` for today's own readings; differs when the ref was cross-day-transferred. Additive: existing consumers can ignore it.
- **5.6b. ✅ `Transfer` gate** — evaluated first. When true (`nday >= 52 || nday < -55`, i.e. outside a window around Pascha), cross-day pulls become eligible.
- **5.6c. ✅ `TransferRulesF` — pull from yesterday** — when today's DSL vars match (default rule fires on Tuesdays outside Lent), recursively evaluate yesterday with `crossDay=false`, take its `suppressed` refs, and *prepend* them to today's `apostol`/`gospel` — matching upstream's `dailyVf = yesterdaySuppressed + today + tomorrowSuppressed` layout.
- **5.6d. ✅ `TransferRulesB` — pull from tomorrow** — fires on most non-Sunday weekdays outside Lent; recursively evaluate tomorrow, take its `suppressed`, and *append* to today's refs. Verified end-to-end on Nativity Eve 2024: Fri 2024-01-05 (Julian Dec 23, doy=356) drains its sequential readings via Class3Transfers, and Thu 2024-01-04 pulls them in tagged `dowOrigin=5`.
- **5.6e. ✅ Bounded recursion** — the recursive call uses `crossDay=false`, so the maximum depth is 1. Verified by a regression test that Wed 2024-01-03 does not transitively acquire Friday's refs through Thursday.
- **5.6f. ✅ Tests** — [tests/orderedLiturgy.test.ts](tests/orderedLiturgy.test.ts) grows with Fri drains sequential / Thu pulls Fri / trailing-position invariant / recursion-bound check / `dowOrigin` shape. 191/191 total tests pass.

Deviations from upstream (documented in the module header):

- Upstream overrides `dRank = "0"` for the recursive adjacent-day lookup. This suppresses rank-gated `Class3Transfers` (`dRank >= 5`) and rank-gated `Suppress` clauses when peeking at the neighbor. Because only 6/3371 cIds carry a rank at all, mirroring this override is inert on today's data; deferred until rank data becomes richer.
- Full Lucan-jump *numbering* boundary (September–November sequential-reading cycle reset) is out of scope for the ordering engine — it belongs to the sequential-reading generation, which today ships as static day XML.


### Phase 7 — Service selection *(post-M1)*

- Port `ServiceInfo.java` → `src/engine/services.ts`. Determines which
  services apply on a given day (Prime type, Kathisma numbers, etc.). Returns
  a structured selection; does not compose the text.

### Phase 8 — Service composition & commemorations *(later)*

- Port `Service.java`, `Commemoration1.java`, `Matins.java`, `RoyalHours.java`,
  `UsualBeginning.java`, `{Third,Sixth,Ninth}Hour.java`.
- These are template engines that emit ordered structural output
  (`{ kind: 'bible', ref } | { kind: 'create', what, times } | ...`), which
  callers can render.
- Sequential-readings cross-day recursion (yesterday/tomorrow) added here.

### Phase 9 — Astronomy *(optional, standalone)*

- Port `Sunrise.java` and lunar phase from `Paschalion.java` into
  `src/astronomy/`. No dependency on the rest of the engine.

### Phase 10 — Bible index *(later)*

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
