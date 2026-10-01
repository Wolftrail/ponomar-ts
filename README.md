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

### Tradition

ponomar-ts computes the Orthodox liturgical day as kept by the **Russian
Orthodox Church** — the Slavic recension of the Jerusalem Typicon, in the
form published by the [Russian Orthodox Church Outside Russia](https://www.synod.com/)
(ROCOR) parish of Holy Trinity Monastery, Jordanville, NY at
[holytrinityorthodox.com](https://www.holytrinityorthodox.com/calendar/) (HTOC).
Concretely:

- **Julian ("Old Calendar") menaion** — fixed feasts are keyed to Julian
  month-day. The library accepts a Gregorian `CalendarDate` from the caller
  and converts internally; e.g. Nativity of Christ (Julian Dec 25) falls on
  Gregorian Jan 7.
- **Orthodox Paschalion** — Meeus' luni-solar algorithm as implemented by
  the Russian / Jerusalem / Serbian / OCA / ROCOR / Georgian / Bulgarian
  churches, i.e. the dating used by every church *except* the Finnish Orthodox
  (which follows Western Pascha).
- **Russian monastic charter** for fasting — the nine canonical levels
  (`strict`, `no-oil`, `with-oil`, `with-fish`, `with-caviar`, `with-wine`,
  `fast-free`, `no-fast`, …) with HTOC's displayed phrasing
  (`"By Monastic Charter: Strict Fast (Bread, Vegetables, Fruits)"`).
- **Russian-recension commemorations** — including the twentieth-century
  Russian **New Hieromartyrs** and **New Confessors**, the Royal Martyrs,
  St. John of Shanghai and San Francisco, St. Herman of Alaska, the
  Synaxes of Russian / Siberian / Belarusian saints, and other
  commemorations proper to the Moscow Patriarchate / ROCOR usage.
  `LiturgicalDay.commemorations` surfaces HTOC's day-page list verbatim
  (16 229 entries across the vendored 2025–2027 window).
- **English display text and biographies** — HTOC publishes in English;
  this project ships English strings. Native-language rendering (Church
  Slavonic, Russian, Greek) is a consumer concern.

Not covered by this project:

- **Greek / Antiochian / Melkite usage** (Constantinopolitan recension,
  Greek-language rubrics, different New Hieromartyr / local-saint sets).
- **New Calendar** (Revised Julian) fixed-feast dating as used by the
  Ecumenical Patriarchate, Greek Archdiocese, Antiochian Archdiocese,
  OCA parishes under the "new style", Romanian / Bulgarian / Polish /
  Albanian / Czech-and-Slovak churches, etc. Pascha itself is dated the
  same way as in ponomar-ts across all these jurisdictions, but every
  fixed feast is 13 days earlier than what ponomar-ts returns.
- **Old Rite / Old Believer** rubrics (pre-Nikonian Russian usage).
- **Mount Athos monastic variants** of the Jerusalem Typicon.

Jurisdictions that *are* served well by the shipping dataset: Moscow
Patriarchate, ROCOR, Serbian Orthodox Church, Georgian Orthodox Church,
Polish Orthodox Church, OCA Old Calendar parishes, Bulgarian Orthodox
Church (fixed-feast dates; local-saint set is close but not identical),
and Jerusalem Patriarchate (fixed-feast dates; different local-saint set).

### Scope

Ported:

- [x] **Paschalion** — Meeus' luni-solar algorithm; Julian ↔ Gregorian conversion
- [x] **Julian date math** — `JDate` value type, day-of-week, addition, difference
- [x] **StringOp DSL** — lexer + Pratt parser + evaluator for `Cmd=` / `Value=` rule expressions
- [x] **Day composition** — `getLiturgicalDay(date)` → paschal + menaion saints, `dRank`, tone
- [x] **Commemoration metadata** — names, ranks, biographical info, and life prose (English)
- [x] **Gospel / Epistle readings** — `getReadings(date)` returns the HTOC day-page list (Liturgy apostol + gospel, Matins festal/resurrection gospel, Royal Hours readings, saint-lectionary pulls)
- [x] **Matins reading conflict resolution** — Sunday festal-vs-sequential arbitration applied automatically
- [x] **Fasting rules** — `getFasting(date)` → 9 canonical levels + per-food-group permissions
- [x] **Daily commemorations** — `getSaints(date)` (navigable saint list) and `getDay(date)` (full HTOC day page: header, commemorations, troparia, kontakia, fast text)
- [x] **Saint-centric facade** — `getSaint(slug)` returns names, commemoration dates, and life prose for `/saints/<slug>` routes
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
  getDay,
  getSaints,
  getReadings,
  getFasting,
  getSaint,
  parseBibleRef,
} from "ponomar-ts";

// Paschal date for a Gregorian year
getOrthodoxPascha(2026);
// → { year: 2026, month: 4, day: 12 }

// HTOC day page: header, commemorations, troparia, kontakia, fast text
const day = getDay({ year: 2026, month: 9, day: 27 }); // Exaltation of the Cross
day?.headerText;              // "17 th Sunday after Pentecost. Tone eight."
day?.commemorations[0]?.text; // "Universal Exaltation of the Precious and Life-Giving Cross..."

// HTOC's navigable saint list (one entry per linked life page)
const saints = getSaints({ year: 2026, month: 9, day: 27 });
saints?.map(s => s.slug);     // ["September/14-01", ...]

// HTOC's day-page scripture list
const readings = getReadings({ year: 2026, month: 9, day: 27 });
readings.filter(r => r.service === "liturgy").map(r => r.reading);
// → ["I Cor_1:18-24", "Jn_19:6-11,13-20,25-28,30-35"]

// Fasting rule for a date
const fast = getFasting({ year: 2024, month: 3, day: 22 }); // Lenten Friday
fast.level;                   // "no-oil"
fast.permitted.meat;          // false
fast.permitted.oil;           // false

// Saint-centric facade — resolve the slug HTOC uses in `/saints/<slug>` routes
const saint = getSaint("December/19-01"); // Boniface of Tarsus
saint?.commemorations.length; // 1 (Dec 19 Gregorian, in the 2025–2027 window)
saint?.life?.text;            // biographical prose, English

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
