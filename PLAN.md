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

## Release review

Every phase is done. The review of the skipped data and of [LIMITATIONS.md](LIMITATIONS.md) found:

- `Services/Var`, `Commemorations/`, `Services/menaion`, `cu/xml/01/14_new.xml` and `ScriptureTransfers.xml` are read by no code path of the engine; confirmed against the upstream Java sources. They stay unconverted (or unused).
- `fr/xml/lives/050307;.xml` was wrongly skipped as a misnamed copy: `fr/xml/05/03.xml` names the commemoration `050307;`. It is now converted. Upstream throws a `NumberFormatException` when it ranks that commemoration, so the oracles skip the French 3 May.
- The language-pack `LS == ##` entries are inside an XML comment and the `Comment` attributes are never read, so nothing was lost.
- The day, readings, Matins and lives oracles now cover six languages (English, Church Slavonic, Greek, French, Simplified and Traditional Chinese), up from three.
- The hours oracle gives upstream a temporary `Services/Var` directory where a language has none, so the Greek Kathisma days and Sixth Hour are compared too.
- Upstream quirks kept on purpose (Greek `ἐκ5`, Chinese numerals above 4999, the dropped number in `formatNumber`, `twoStars`) are listed in LIMITATIONS.md.

Left open:

- `formatTimes`, `podobenIntro` and `formatCommemoration` are checked by hand against upstream's code only; their logic lives in instance methods of the GUI classes, which an oracle cannot call without a window.
- The Sixth Hour's propers on Lenten days have no text to compare, because the Triodion lives lack the hymns the template asks for.
