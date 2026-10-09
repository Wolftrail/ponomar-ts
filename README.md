# ponomar-ts

A fresh TypeScript reimplementation of the Ponomar Orthodox liturgics engine. The upstream Java project is retained under `vendor/ponomar` as a behavior and data reference. This package is under active development and is not yet a drop-in replacement.

## Current scope

Julian dates, calendar conversion, the Paschalion, the expression language used by Ponomar's data files, and day resolution: which Triodion/Pentecostarion and Menaion commemorations fall on a date, their ranks, the day rank and the Octoechos tone.

```ts
import { resolveDay } from "ponomar-ts";

// Dates are Julian-calendar; see pcalendar.fromGregorian to convert.
const day = await resolveDay({ date: { year: 2026, month: 3, day: 30 }, language: "cu/ru" });
day.rank; // 8: Pascha
day.paschal.commemorations; // [{ sid: [], cid: "9001", rank: 8 }]
```

The Divine Liturgy's Epistle and Gospel readings for the day, after upstream's rules for suppressing and transferring the sequential readings:

```ts
import { getLiturgyReadings } from "ponomar-ts";

const { apostol, gospel } = await getLiturgyReadings(day, "cu/ru");
gospel[0]; // { reading: "Jn_20:1-10", rank: 8, commemoration: "9001" }
```

`getMatinsReadings(day, language)` returns the Matins Gospel the same way.

Language packs supply phrases, numerals and repeat counts:

```ts
import { formatNumber, formatTimes, getPhrase } from "ponomar-ts";

await formatNumber("cu/ru", 107); // "р҃з"
await formatTimes("en", 5); // "<i>5 times</i>"
await getPhrase("en", "Rank0"); // "^NF"
```

Names, lives and hymns come per commemoration:

```ts
import { commemorationLife, commemorationNames, nameForm } from "ponomar-ts";

const names = await commemorationNames("9001", "en", day.variables);
nameForm(names, "short"); // "Pascha"
await commemorationLife("9001", "en"); // undefined when the commemoration has no life
```

The First, Third, Sixth and Ninth Hours and the Royal Hours are composed as typed nodes (Scripture passages are references; supply their text yourself):

```ts
import { composePrimes } from "ponomar-ts";

const hour = await composePrimes(day, "en", { who: "priest", parts: "independent" });
hour.type; // "Normal", "Lenten", "Paschal", ... or "None" when no hour is served
hour.nodes[0]; // { kind: "title", title: "...", ... }, then prayers, readings and propers
```

Sunrise, sunset and the Moon's phase need only a Julian day number:

```ts
import { getSunriseSunset, jdate, lunarPhase } from "ponomar-ts";

const { jdn } = jdate.julianDate(day.date.year, day.date.month, day.date.day);
getSunriseSunset(jdn, { longitude: 45, latitude: 51, timeZone: 1 }); // { sunrise, sunset } in local decimal hours
await lunarPhase("en", jdn); // "Waxing Crescent"
```

Fasting follows from the resolved day, and Bible references in the data parse into structured ranges (no Bible text is included):

```ts
import { getDayFasting, parseBibleReference, renderFastingLevel } from "ponomar-ts";

getDayFasting(day)?.level; // "1111111": no fast
await renderFastingLevel("0000111", "en"); // "Fasting regulations: Fast: Wine and oil allowed "
parseBibleReference("Lk_2:20-21, 40-52").ranges; // two ranges in chapter 2
```

Data loads lazily per language, so the API is asynchronous.

```ts
import { getPascha, evaluateBoolean } from "ponomar-ts";

getPascha(2026); // Julian 30 March 2026, plus its Julian day number
evaluateBoolean("nday >= -48 && dow != 0", { nday: -10, dow: 3 }); // true
```

## Packaging

ESM only, Node.js 20 or newer, no runtime dependencies. The main entry point re-exports everything; the self-contained parts also have subpaths that load no data:

| Import | Contents |
| --- | --- |
| `ponomar-ts` | The whole API |
| `ponomar-ts/paschalion` | Pascha, Pentecost, Lent, Apostles' Fast, cycles |
| `ponomar-ts/astronomy` | Sunrise, sunset, lunar phase |
| `ponomar-ts/bible` | Reference parser and book catalogue |
| `ponomar-ts/dsl` | The expression language |

The generated data is about 5 MB packed. Each language is a separate module loaded on first use through a literal `import()`, so a bundler can split it and a runtime reads only the languages it asks for. Language ids: `cu`, `cu/ru`, `el`, `el/mono`, `en`, `fr`, `zh/Hans` and `zh/Hant`. A more specific id falls back along its chain (`cu/ru`, then `cu`, then the base data), as upstream does.

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm run typecheck
npm test
npm run build
npm run smoke
```

`npm run smoke` needs a prior build; it installs the packed tarball into a temporary project and imports every entry point.

Tests compare against fixtures generated from the upstream Java code. `npm run golden` regenerates them and needs a JDK; it also writes exhaustive dumps to `scratch/golden/`, which the tests use when present.

`npm run convert` regenerates `src/data/generated/` from the vendored XML, and `npm run convert -- --check` fails if the committed output has drifted.

## Licensing

The project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md); the upstream Ponomar license is also retained at `vendor/ponomar/LICENSE`.
