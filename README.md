# ponomar-ts

A TypeScript port of the [Ponomar](https://github.com/typiconman/ponomar) Orthodox liturgics engine.

> [!WARNING]
> **Status: pre-alpha.** Nothing works yet. This repository contains scaffolding
> and the beginnings of a paschal-date module. Do not depend on it for anything.

## What this is

The original [Ponomar](https://www.ponomar.net/) is a Java + XML rule engine
maintained by Aleksandr Andreev and contributors since 2006. It computes
liturgical information (saints, readings, tone, fasting, feast transfer rules)
by following the Orthodox Typicon precisely, driven by declarative XML data
files that encode each day's rubrics.

**ponomar-ts** aims to be a faithful port of the *engine and the data* to
TypeScript, so it can be consumed by modern JS/TS applications (Node servers,
Next.js apps, mobile React Native builds) without a JVM or a desktop UI.

### Scope

Ported:

- [ ] Paschalion (Meeus' luni-solar algorithm; Julian → Gregorian conversion)
- [ ] Day / Days aggregate
- [ ] Commemoration selection & feast-rank transfers
- [ ] Gospel / Epistle pericope resolution (including Lukan Jump and reserves)
- [ ] Oktoechos tone rotation
- [ ] Fasting rule classification
- [ ] XML data loader for the Ponomar `languages/` corpus

Not in scope (left to the original Java project):

- Swing desktop UI
- Font rendering and Church Slavonic typography
- Full service assembly (Matins, Hours, Divine Liturgy)
- Icon display
- Liturgical music library

## Installation

Not yet published. Once released:

```bash
npm install ponomar-ts
```

## Development

The upstream Ponomar Java repo is vendored as a git submodule under
`vendor/ponomar/`, and its XML rule data is precompiled to typed TypeScript
at build time by `scripts/codegen/`. The compiled library ships no XML and
has no XML parser at runtime.

```powershell
git clone https://github.com/Wolftrail/ponomar-ts.git
cd ponomar-ts
git submodule update --init --recursive
npm install
npm run codegen      # regenerate src/data/ from vendor/ (once codegen lands)
npm run typecheck
npm test
```

See [PLAN.md](PLAN.md) for the port roadmap and phase breakdown.

## Usage

```ts
// Preview API — subject to change.
import { getOrthodoxPascha } from "ponomar-ts/paschalion";

const pascha = getOrthodoxPascha(2026);
// -> { year: 2026, month: 4, day: 19 }
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
