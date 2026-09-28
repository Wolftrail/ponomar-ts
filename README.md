# ponomar-ts

A TypeScript port of the [Ponomar](https://github.com/typiconman/ponomar) Orthodox liturgics engine.

> [!NOTE]
> **Status: 1.0 release candidate.** The engine is feature-complete against
> the ported subset of upstream Ponomar and covered by 305 tests. Public API
> is frozen for 1.0. Consumers should pin to `^1.0.0-rc` while the release
> soaks; the plain `1.0.0` tag will follow once no blocking issues surface.

## What this is

The original [Ponomar](https://www.ponomar.net/) is a Java + XML rule engine
maintained by Aleksandr Andreev and contributors since 2006. It computes
liturgical information (saints, readings, tone, fasting, feast transfer rules)
by following the Orthodox Typicon precisely, driven by declarative XML data
files that encode each day's rubrics.

**ponomar-ts** is a faithful port of the *engine and the data* to TypeScript,
so it can be consumed by modern JS/TS applications (Node servers, Next.js
apps, mobile React Native builds) without a JVM or a desktop UI.

### Scope

Ported:

- [x] **Paschalion** — Meeus' luni-solar algorithm; Julian ↔ Gregorian conversion
- [x] **Julian date math** — `JDate` value type, day-of-week, addition, difference
- [x] **StringOp DSL** — lexer + Pratt parser + evaluator for `Cmd=` / `Value=` rule expressions
- [x] **Day composition** — `getLiturgicalDay(date)` → paschal + menaion saints, `dRank`, tone
- [x] **Commemoration metadata** — names, ranks, biographical info, and life prose (English)
- [x] **Gospel / Epistle readings** — `getDailyReadings` (raw) and `getOrderedLiturgyReadings` (Suppress + Class3Transfers + Saturday inversion + cross-day pull)
- [x] **Matins reading conflict resolution** — Sunday festal-vs-sequential arbitration
- [x] **Fasting rules** — `getFasting(date)` → 9 canonical levels + per-food-group permissions
- [x] **Service selection** — Little Hours template dispatch per period rules
- [x] **Service composition** — typed directive streams for every static template under `languages/xml/Services/`
- [x] **Hymn propers** — `getPropers(date)` → troparia + kontakia per commemoration
- [x] **Phrase text** — 283 static phrases (CommonPrayers / Text / Header / Command), English
- [x] **Bible reference parser** — 1169/1170 upstream refs parse cleanly (one is an upstream typo)
- [x] **Astronomy** — sunrise/sunset (SUNRISET.C) + Metonic-cycle lunar phase

Not in scope (left to the original Java project or to consumers):

- Swing desktop UI
- Font rendering and Church Slavonic typography
- Localization (engine returns raw IDs; consumers handle i18n)
- Bible text (only reference metadata ships; text is per-locale)
- Icon display
- Liturgical music library

See [PLAN.md](PLAN.md) for phase-by-phase implementation notes and the
"Known limitations" section for documented deviations from upstream.

## Installation

```bash
npm install ponomar-ts@next
```

The `next` dist-tag tracks the 1.0 release candidates. Once `1.0.0` ships,
plain `npm install ponomar-ts` will resolve to it.

## Development

The upstream Ponomar Java repo is vendored as a git submodule under
`vendor/ponomar/`, and its XML rule data is precompiled to typed TypeScript
at build time by `scripts/codegen/`. The compiled library ships no XML and
has no XML parser at runtime.

```powershell
git clone https://github.com/wolfgangnothdurft/ponomar-ts.git
cd ponomar-ts
git submodule update --init --recursive
npm install
npm run codegen      # regenerate src/data/ from vendor/
npm run typecheck
npm test
npm run build
```

See [PLAN.md](PLAN.md) for the port roadmap and phase breakdown, and
[CHANGELOG.md](CHANGELOG.md) for per-release notes.

## Usage

The public API takes plain `CalendarDate` literals (`{ year, month, day }`)
rather than JS `Date` objects, so the same code runs identically in Node,
the browser, and time-zone-sensitive contexts.

```ts
import {
  getOrthodoxPascha,
  getLiturgicalDay,
  getOrderedLiturgyReadings,
  getFasting,
  getHourService,
  parseBibleRef,
} from "ponomar-ts";

// Paschal date for a Gregorian year
getOrthodoxPascha(2026);
// → { year: 2026, month: 4, day: 12 }

// Full liturgical day: paschal + menaion saints, dRank, tone
const day = getLiturgicalDay({ year: 2024, month: 1, day: 7 }); // Nativity (Old Calendar)
day.dRank;                         // 7 (Great Feast of the Lord)
day.allSaints[1]?.name?.short;     // "Nativity"

// Divine Liturgy readings — canonical order, with Suppress + Class3Transfers
const readings = getOrderedLiturgyReadings({ year: 2024, month: 1, day: 7 });
readings.apostol.map(r => r.reading); // ["Gal_4:4-7"]
readings.gospel.map(r => r.reading);  // ["Mt_2:1-12"]

// Fasting rule for a date
const fast = getFasting({ year: 2024, month: 3, day: 22 }); // Lenten Friday
fast.level;                  // "no-oil"
fast.permitted.meat;         // false
fast.permitted.oil;          // false

// Little Hour template dispatch (Prime, Terce, Sexte, None)
const prime = getHourService({ year: 2024, month: 4, day: 2 }, "prime");
prime.templateName;   // "Prime"
prime.PFlag2;         // 1 (auto-derived: Lenten)

// Bible reference parser (78 books, 163 aliases)
parseBibleRef("I Tim_3:14-4:5");
// → { book: "I_Tim", bookLabel: "I Tim", ranges: [{ start, end }] }
```

Deep imports are encouraged when bundle size matters:

```ts
import { getOrthodoxPascha } from "ponomar-ts/paschalion";
import { getFasting } from "ponomar-ts/engine";
import { parseBibleRef } from "ponomar-ts/bible";
import { getSunriseSunset, getLunarPhase } from "ponomar-ts/astronomy";
import { getLife } from "ponomar-ts/lives"; // life prose, ~1.6 MB payload
```

## Design goals

- **Zero runtime dependencies.** Pure TypeScript, works in Node ≥ 20.
- **Tree-shakable ESM.** Deep imports (`ponomar-ts/paschalion`) return small,
  focused modules; the top-level export is the sum of them.
- **No I/O in the core.** Data files are loaded through pluggable providers so
  the same core can run in Node (filesystem), the browser (fetch), or from a
  precomputed SQLite bake.
- **Faithful to the Java engine.** Where behavior is ambiguous, we defer to
  the original Java implementation and reference the source file in comments.
- **Testable against Ponomar Perl API.** The upstream project also ships a
  Perl API; its regression outputs are the ground truth for our own tests.

## License

**GPL-3.0-or-later** — matching the upstream Ponomar Java project. This is a
derivative work.

The XML data files reproduced from Ponomar (menaion, triodion, pentekostarion,
oktoechos) retain their upstream license and copyright. See `LICENSE` for the
full GPL-3.0 text and `NOTICE.md` (once added) for attribution details.

## Related projects

- [typiconman/ponomar](https://github.com/typiconman/ponomar) — the original Java engine and XML corpus
- [brianglass/orthocal-python](https://github.com/brianglass/orthocal-python) — Django-based Orthodox calendar (Slavic)
- [OliverBrotchie/orthodox-calendar](https://github.com/OliverBrotchie/orthodox-calendar) — GOARCH ICS → Unix `calendar(1)` data files (Greek)
- [holytrinityorthodox.com](https://www.holytrinityorthodox.com/calendar/) — HTC's public Slavic calendar (Jordanville)
