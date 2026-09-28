# Codegen

This directory contains the build-time pipeline that turns upstream
Ponomar XML data files into typed TypeScript modules under `src/data/`.

At runtime the library **never** parses XML: the compiled TS modules are
imported directly (tree-shakable, literally typed). See `PLAN.md` for the
overall strategy.

## Prerequisites

The upstream repo is vendored as a git submodule at `vendor/ponomar/`.
On a fresh clone:

```powershell
git submodule update --init --recursive
```

## Running

```powershell
npm run codegen           # regenerate every data module
npm run codegen -- --check  # fail if any generated file drifts (CI use)
```

## Layout

| File | Purpose |
| --- | --- |
| `index.ts` | Entry point; registers each per-schema parser. |
| `parse-commands-xml.ts` | *Phase 3* — DivineLiturgy, Fasting, ServiceRules, ScriptureTransfers → `src/data/commands/`. |
| `parse-day-xml.ts` | *Phase 3* — triodion + pentecostarion day files → `src/data/calendar/`. |
| `parse-menaion-xml.ts` | *Phase 3* — fixed-feast menaion → `src/data/calendar/menaion.ts`. |
| `parse-services-xml.ts` | *Phase 7* — Kathisma/Hours templates → `src/data/services/`. |
| `parse-bible-index.ts` | *Phase 9* — Bible book/chapter index → `src/data/bible/index.ts`. |

Each parser is a small module exporting a `{ name, run(ctx) }` object; add it
to the `parsers` array in `index.ts` to activate it.
