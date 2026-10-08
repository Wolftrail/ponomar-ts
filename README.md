# ponomar-ts

A fresh TypeScript reimplementation of the Ponomar Orthodox liturgics engine. The upstream Java project is retained under `vendor/ponomar` as a behavior and data reference. This package is under active development and is not yet a drop-in replacement.

## Current scope

The first implemented function calculates Orthodox Pascha on the Julian calendar.

```ts
import { getPascha } from "ponomar-ts";

getPascha(2026); // { year: 2026, month: 3, day: 30 }
```

## Development

Requires Node.js 20 or newer.

```sh
npm install
npm run typecheck
npm test
npm run build
```

## Licensing

The project is licensed under GPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md); the upstream Ponomar license is also retained at `vendor/ponomar/LICENSE`.
