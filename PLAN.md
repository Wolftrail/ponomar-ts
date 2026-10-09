# Project plan

## Foundation

- Julian calendar arithmetic and Gregorian conversion.
- Paschalion dates and movable-feast derivation.
- StringOp expression parsing and evaluation.

## Calendar engine

- XML parsing and typed data generation from the vendored Ponomar source.
- Day lookup, saint resolution, and service composition.
- Readings, fasting, phrases, and localization.

## Compatibility

- Add regression fixtures against upstream behavior as each subsystem is ported.
- Document supported language packs and deliberate differences from the original Java application.

## Revisit before release

Data skipped during conversion (see LIMITATIONS.md). Re-check each against the finished engine and convert it if any code path turns out to need it.

- `Services/Var`: scratch files written and re-read at runtime by Primes, ThirdHour, SixthHour and NinthHour. Primes now rebuilds them in memory (`composePrimes`); do the same for the other three, then check that the day-dependent choices they make match upstream.
- `Commemorations/` (`0`, `123`, `543`, `T`): no upstream reader, and its ids are in no day file. Confirm nothing in day resolution or lives needs them.
- `Services/menaion` (`P_3174`, `P_163`): Paramony files used only by commented-out code. Confirm the Christmas and Theophany eve services need no hymns from them.
- `cu/xml/01/14_new.xml` and `fr/xml/lives/050307;.xml`: a draft and a misnamed copy, skipped by exact name. Confirm neither carries data the real files lack.
- `ScriptureTransfers.xml`: converted, but read by no upstream Java code and unused by `getLiturgyReadings`. Confirm Matins or the composer does not need it.
- Language packs: `LS == ##` template entries and translator-comment attributes were dropped. Confirm no lookup needs them.
- Upstream quirks kept on purpose, to decide keep or fix: `formatTimes` drops the space before the number (`ἐκ5`); `formatNumber` returns Chinese numerals above 4999 as `10000.0` and drops the number for a final format with text only before the first `#`; life and hymn texts with inline `<br/>` or `<p>` are returned whole where upstream keeps only the last text chunk.
- `formatTimes`, `podobenIntro` and `formatCommemoration` are checked against hand-written expectations only. Add oracle modes if they turn out to matter for service composition.
- Phase 6 decisions to revisit: the composer returns a typed node list and leaves Bible text to the consumer; `GETID` nodes (`proper`) are produced but not yet resolved against a commemoration's service data, because the First Hour does not use them (the Royal Hours do); `twoStars` is kept although upstream never applies it; the Primes oracle covers every third day of seven years in four languages with the options cycled, and excludes Greek Kathisma days (upstream cannot write its scratch files there).
- `LIMITATIONS.md`: once every phase is done, re-read it end to end. Decide for each limitation and deliberate difference whether it should now be fixed, kept (and reworded), or removed, and make sure nothing listed as unported has since been ported.
