# Contributing

Thanks for taking an interest. This port is early — every module is up for
grabs.

## Development

```bash
npm install
npm run typecheck    # tsc --noEmit
npm test             # node --test
npm run build        # emit dist/
```

Node ≥ 20 required (uses `node --test` and `--experimental-strip-types`).

## Ground rules

1. **Faithful to upstream.** When porting a Java file, cite it in a header
   comment: `// Ported from Ponomar/Paschalion.java @ <upstream commit>`.
   Preserve the original algorithm's structure where reasonable; note
   deviations.
2. **No runtime dependencies without discussion.** Zero-dep is a design goal.
   Type-only or dev deps are fine.
3. **Data providers are pluggable.** No `fs.readFileSync` in `src/core/` —
   pass a `DataProvider` interface in.
4. **Every ported module gets tests.** If upstream Perl or Java has regression
   fixtures, translate them; otherwise write minimal known-good cases with
   citations to authoritative Orthodox calendars.
5. **License:** GPL-3.0-or-later. Contributions are accepted under the same
   license.

## Regression fixtures

Where possible, tests verify against outputs from the upstream Perl API
(`Ponomar/APIs/Perl` in the Java repo) or from published Orthodox almanacs.
See `tests/fixtures/` (once populated).

## Commit style

Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `port:`
for straight ports).
