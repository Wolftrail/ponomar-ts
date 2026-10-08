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

- `Services/Var`: scratch files written and re-read at runtime by Primes, ThirdHour, SixthHour and NinthHour. Confirm the Phase 6 composer rebuilds the same structure in memory.
- `Commemorations/` (`0`, `123`, `543`, `T`): no upstream reader, and its ids are in no day file. Confirm nothing in day resolution or lives needs them.
- `Services/menaion` (`P_3174`, `P_163`): Paramony files used only by commented-out code. Confirm the Christmas and Theophany eve services need no hymns from them.
- `cu/xml/01/14_new.xml` and `fr/xml/lives/050307;.xml`: a draft and a misnamed copy, skipped by exact name. Confirm neither carries data the real files lack.
- `ScriptureTransfers.xml`: converted, but read by no upstream Java code and unused by `getLiturgyReadings`. Confirm Matins or the composer does not need it.
- Language packs: `LS == ##` template entries and translator-comment attributes were dropped. Confirm no lookup needs them.
- `LIMITATIONS.md`: once every phase is done, re-read it end to end. Decide for each limitation and deliberate difference whether it should now be fixed, kept (and reworded), or removed, and make sure nothing listed as unported has since been ported.
