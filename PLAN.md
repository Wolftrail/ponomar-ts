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

- `Services/Var`: scratch files written and re-read at runtime by Primes, ThirdHour, SixthHour and NinthHour. `composeHour` now rebuilds them in memory for all four; the Royal Hours need none.
- `Commemorations/` (`0`, `123`, `543`, `T`): no upstream reader, and its ids are in no day file. Confirm nothing in day resolution or lives needs them.
- `Services/menaion` (`P_3174`, `P_163`): Paramony files used only by commented-out code. Confirm the Christmas and Theophany eve services need no hymns from them.
- `cu/xml/01/14_new.xml` and `fr/xml/lives/050307;.xml`: a draft and a misnamed copy, skipped by exact name. Confirm neither carries data the real files lack.
- `ScriptureTransfers.xml`: converted, but read by no upstream Java code and unused by `getLiturgyReadings`. Confirm Matins or the composer does not need it.
- Language packs: `LS == ##` template entries and translator-comment attributes were dropped. Confirm no lookup needs them.
- Upstream quirks kept on purpose, to decide keep or fix: `formatTimes` drops the space before the number (`ἐκ5`); `formatNumber` returns Chinese numerals above 4999 as `10000.0` and drops the number for a final format with text only before the first `#`; life and hymn texts with inline `<br/>` or `<p>` are returned whole where upstream keeps only the last text chunk.
- `formatTimes`, `podobenIntro` and `formatCommemoration` are checked against hand-written expectations only. Add oracle modes if they turn out to matter for service composition.
- Phase 6 decisions to revisit: the composer returns a typed node list and leaves Bible text to the consumer; `GETID` nodes (`proper`) are resolved against the commemoration's service data, but the oracle only sees the Sixth Hour's, where the Triodion lives carry no such data, so the resolved text is untested until the Royal Hours; `twoStars` is kept although upstream never applies it; the hours oracle covers every second day of seven years in four languages with the hour and options cycled, and excludes Greek Kathisma days and the Greek Sixth Hour (upstream cannot write its scratch files there).
- Revisit after everything else: (1) Greek hours. Upstream cannot write its scratch files for a language without a `Services/Var` directory, so the hours oracle skips Greek Kathisma days and the Greek Sixth Hour; decide whether Greek should be compared some other way (for example by giving the oracle a Var directory) so those days are verified. (2) Proper-text gap, now mostly closed: the Royal Hours oracle matches resolved proper text and headers on every day; only the Sixth Hour's propers, which the Triodion lives lack, stay untested, and the first-character question showed no difference.
- `LIMITATIONS.md`: once every phase is done, re-read it end to end. Decide for each limitation and deliberate difference whether it should now be fixed, kept (and reworded), or removed, and make sure nothing listed as unported has since been ported.
