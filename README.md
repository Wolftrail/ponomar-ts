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

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm run typecheck
npm test
npm run build
```

Tests compare against fixtures generated from the upstream Java code. `npm run golden` regenerates them and needs a JDK; it also writes exhaustive dumps to `scratch/golden/`, which the tests use when present.

`npm run convert` regenerates `src/data/generated/` from the vendored XML, and `npm run convert -- --check` fails if the committed output has drifted.

## Licensing

The project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md); the upstream Ponomar license is also retained at `vendor/ponomar/LICENSE`.
