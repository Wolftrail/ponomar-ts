# Changelog

All notable changes to this project are documented here. This project follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The public API is anything re-exported from [src/index.ts](src/index.ts) or from a
subpath listed in the `exports` field of `package.json`. Anything else is internal and may
change without notice.

Earlier history described an implementation that was discarded in commit `1ffd781`; this
changelog starts again with the rewrite.

## [2.0.0] — 2026-10-09

A complete rewrite. The API is new and not compatible with the `1.0.0-rc.x` releases, which were built on a different implementation; migrate by reading the README.

### Added

- Julian date arithmetic, calendar conversion and the Paschalion, checked against the upstream Java engine.
- The `Cmd`/`Value`/`Tone` expression language (`ponomar-ts/dsl`).
- A converter (`npm run convert`) that turns the vendored XML into typed, lazily loaded modules under `src/data/generated/`.
- Day resolution (`resolveDay`), Divine Liturgy and Matins readings, fasting, Bible reference parsing and the book catalogue (`ponomar-ts/bible`), with no Bible text.
- Commemoration names, lives and hymns; rule-based numerals, repeat counts and rank formats.
- The First, Third, Sixth and Ninth Hours and the Royal Hours, composed as typed nodes.
- Sunrise, sunset and the Moon's phase (`ponomar-ts/astronomy`).
- Golden-master harness (`npm run golden`) that compares each subsystem with the upstream Java code in up to six languages; sampled fixtures are committed.
- Subpath exports `./paschalion`, `./astronomy`, `./bible`, `./dsl` and `./package.json`.
- `npm run smoke` packs the package, installs the tarball into a temporary project and exercises every entry point.

### Changed

- Source maps for the generated data modules are no longer published (about 0.6 MB smaller packed).

### Fixed

- The French life file `050307;.xml` is converted: `fr/xml/05/03.xml` names its commemoration with the semicolon, so the French 3 May now has a name.
