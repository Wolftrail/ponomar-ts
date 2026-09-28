# Repository memory for `ponomar-ts`

## Project

TypeScript port of the [Ponomar](https://github.com/typiconman/ponomar) Java
Orthodox liturgics engine. Pre-alpha. GPL-3.0-or-later (derivative work).

## Conventions

- **Node ≥ 20** required. Uses `node --test` and `--experimental-strip-types`.
- **Zero runtime dependencies.** Type-only or dev deps only.
- **ESM only** (`"type": "module"`). Deep imports work via `exports` map.
- **Strict TS** with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, `allowImportingTsExtensions`.
- **File header attribution**: when porting a Java file from upstream, cite
  it as `// Ported from Ponomar/<File>.java` at the top.
- **No `fs` in `src/core/`**. Data providers are pluggable interfaces.

## Layout

```
src/            # library sources; ESM, .ts imports use .ts extension
  index.ts      # top-level barrel
  paschalion.ts # Pascha & Julian↔Gregorian conversion
tests/          # node:test suites, one .test.ts per src module
scripts/        # dev helpers (clean, regen, etc.)
```

## Common commands

```powershell
npm install
npm run typecheck    # tsc --noEmit
npm test             # node --test
npm run build        # emit dist/
npm run clean        # rm -rf dist/
```

## Integration into the Bible site app

Once a first useful module lands here, the Bible site can consume it either
by `npm install ponomar-ts` (published) or by `npm link` / a workspace file:
protocol dependency during development. Keep the public API stable-ish
before publishing anything.
