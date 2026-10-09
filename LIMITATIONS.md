# Limitations

`ponomar-ts` reimplements the engine of the upstream Ponomar Java project (`vendor/ponomar`) and its data. Each subsystem was compared with the upstream code run as an oracle (`npm run golden`); this file lists what that comparison covers, where the port deliberately differs, and what is left out.

## Not ported

- The desktop interface, the search window and the commemoration database (`Database`, `Search`, `Days`, the old `Commemoration` class).
- HTML output. The engine returns structured values: readings are references with rank and origin, hours are lists of typed nodes, lives and hymns are text with inline `<br/>` and `<p>` kept as HTML.
- Bible text. Supplying a translation is the consumer's responsibility and will stay so. Only a translation-independent book catalogue (ids, English names, chapter counts) ships, so references such as `Lk_2:20-21` can be parsed and validated.

## Data not converted

- `Services/Var`: scratch files the hour classes write at runtime and read straight back. `composeHour` keeps those choices in memory.
- `Commemorations/`: no upstream code reads it and its ids are in no day file.
- `Services/menaion` (`B_` and `P_` files for 3174 and 163, in `el` and `fr`): read only by the old `Commemoration` class, which only the unported search database uses; no day file names these ids.
- `cu/xml/01/14_new.xml`: a draft; it is a subset of `14.xml`.
- `ScriptureTransfers.xml` is converted but read by no upstream code, so `getLiturgyReadings` does not use it.
- In the language packs, the `LS == ##` entries are part of an XML comment, and the translator `Comment` attributes are never read upstream.

## What agrees with upstream, and how it was checked

| Subsystem | Compared on |
| --- | --- |
| Julian dates, calendar conversion, Paschalion | Every year from 33 to 3000; sampled dates |
| Expression language | Every `Cmd`, `Value` and `Tone` in the data, in 40 contexts |
| `resolveDay` | Every day of 2010, 2024, 2026, 2037, 2041, 2048 and 2078, in six languages, both lectionary schemes |
| `getLiturgyReadings`, `getMatinsReadings` | The same days: readings, ranks and origin |
| `getDayFasting` | The same days; `renderFastingLevel` on all 128 levels in six languages |
| Names, lives, Liturgy hymns | Every commemoration of the same days, in six languages |
| `formatNumber` | About 5,400 numbers in each of six languages and the root |
| Sunrise, sunset, Moon | About 4,100 sunrise values for eight places (polar ones included), 3,200 localized times, 850 lunar phases; reals within 1e-9 since Java and V8 trigonometry can differ in the last bit |
| `composeHour` | About 5,100 services in English, Church Slavonic (Russian), French and Greek: type, flags and the directive sequence; prayer, command and title texts in all six languages |
| `composeRoyalHours` | Every day of the seven years in four languages, resolved proper text and headers included |
| `parseBibleReference` | Written for this port, not compared with upstream. It reads every reference in the data except two upstream typos (`lives/1777.xml`, `lives/9803.xml`), which it rejects |

Checked by hand against the upstream source only: `formatTimes`, `podobenIntro` and `formatCommemoration`. The Sixth Hour's propers on Lenten days are untested, because the Triodion lives carry none of the hymns its template asks for.

## Deliberate differences

### Day resolution and data

- `el/xml/lives/08160600.xml` has a saint's name in a numeric `Type` attribute, which makes upstream throw and abandon that commemoration's remaining files. `commemorationRank` skips that `SERVICE` and carries on.
- `fr/xml/05/03.xml` names its commemoration `050307;`, with the semicolon. Upstream opens `lives/050307;.xml` for it, then throws a `NumberFormatException` when it ranks the commemoration, so the French 3 May cannot be shown there. The port converts the file, gives the commemoration rank 0 and carries on; the comparison skips that day in French.
- Whitespace around ids in day files is trimmed, where upstream keeps a stray trailing space in the English `09/01.xml`.

### Readings

- Placeholders for commemorations without a reading of the requested type are dropped (Liturgy and Matins).
- Upstream throws when a neighbouring day has no Liturgy readings at all while it looks there for transferred readings; the port treats that day as contributing none.
- Upstream's Matins rules are hard-coded because `Commands/Matins.xml` does not exist; `getMatinsReadings` hard-codes them too.

### Names, lives and hymns

- Upstream keeps only the last text chunk of an element, so a life or hymn with inline `<br/>` or `<p>` (Modern Greek lives) loses everything before the markup. The port returns the whole text, trimmed.
- Name forms are keyed `nominative`, `genitive`, ... where the data spells the attribute `Genetive`. `nameForm` falls back to the nominative as `getGrammar` does, but returns undefined where upstream returns a localized error phrase.
- Hymns placed directly in a service, outside any section, are reached only through the propers of a service template (`/TROPARION/1`).

### Localization

Kept as upstream has them:

- `formatNumber`: a final format with text before its first `#` and none after the last drops the number; a language without number rules gets Chinese numerals up to 4999; Chinese numerals above 4999 come back as `10000.0`.
- `formatTimes` trims the text before the number, so Greek gives `ἐκ5`.
- The `Commemoration2` label supports the first `%getN` call in the phrase only.

The expression language additionally accepts exponent notation (`1.0E7`) so that upstream's number-to-text substitutions evaluate, and uses C-style tokenization and precedence where upstream splits on spaced operators. The two agree on every expression in the data; unusual unspaced input may behave differently.

### Services

- Scripture passages are references (`verses`, or `intro` for an "A reading from..." line); the consumer supplies the text.
- Upstream writes the troparion, kontakion and Kathisma choices to `Services/Var` and reads them back. The port passes them in memory, so a stale file from an earlier run, which upstream would include, never appears.
- Upstream always writes the second troparion slot from the first troparion and never the first slot; the port does the same, so an hour has one troparion.
- On days the service rules do not cover (Ascension and the week after Pentecost) upstream fails with a null type. The port returns an undefined `type` and no nodes.
- The Kathisma templates spell the heading option `TwoStars` where upstream looks for `2Stars`, so upstream never applies it. The nodes carry `twoStars` for consumers that want it.
- Upstream cannot write its scratch files for a language with no `Services/Var` directory (Greek) and shows nothing on Lenten days with a Kathisma there, or at the Sixth Hour at all. The port composes them; the comparison gives the oracle a temporary directory.
- At the Sixth Hour on Lenten days with a prophecy, the proper hymns the template asks for have no text. Upstream's null pointer there ends the rest of each included file; the port keeps all the nodes.
- Where a proper is found, upstream drops the first character of its raw text; the port trims instead. The Royal Hours show no difference.

### Fasting

- For a level outside the nine named ones, upstream's sentence builder repeats the whole sentence when exactly one food is forbidden (`output += output += ...`); `renderFastingLevel` reproduces that.
- A day with no applicable fasting rule yields no result, where upstream fell through to an error message.
