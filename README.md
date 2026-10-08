# ponomar-ts

A fresh TypeScript reimplementation of the Ponomar Orthodox liturgics engine. The upstream Java project is retained under `vendor/ponomar` as a behavior and data reference. This package is under active development and is not yet a drop-in replacement.

## Current scope

Julian dates, calendar conversion, the Paschalion, and the expression language used by Ponomar's data files.

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

## Licensing

The project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md); the upstream Ponomar license is also retained at `vendor/ponomar/LICENSE`.
