# Limitations

This is a fresh implementation in progress. It currently provides Julian date arithmetic (`JDate`), calendar conversion (`PCalendar`), the Paschalion calculations (Pascha, Pentecost, Lent and Apostles' Fast dates, indiction, solar and lunar cycles), and the `Cmd`/`Value`/`Tone` expression language. It does not yet port day resolution, readings, fasting evaluation, service composition, localization lookups, astronomy, or the original desktop interface. The vendored XML is converted to typed modules under `src/data/generated/` for the rule files (fasting, service rules, liturgy and scripture-transfer commands), the day files (menaion, triodion, pentecostarion, float), the language packs, the default configuration and the lives (names, biographies, readings, hymns), the last in per-language month chunks plus an id-to-chunk index, the service templates, the per-language prayer and label texts and the Octoechos tables. Nothing consumes the converted data yet.

Three upstream data families are deliberately not converted. `Services/Var` holds scratch files that the hour classes write at runtime and read straight back, so the committed copies are a stale snapshot of one run. `Commemorations/` has no reader upstream and its ids appear in no day file. `Services/menaion` holds two Paramony files used only by commented-out code. If a later phase needs them, they can be added to the converter.

Bible text is not provided and never will be: supplying a translation is the consumer's responsibility. Only a translation-independent book catalogue (ids, English names, chapter counts) ships, so readings such as `Lk_2:20-21` can be parsed and validated.

The expression language uses standard C-style tokenization and precedence, whereas upstream splits expressions on spaced operators. The two agree on every expression in the vendored data, but unusual unspaced input may behave differently.

Behavior is being added incrementally against the upstream Ponomar Java project. Until a feature is implemented and tested, this package should not be treated as a drop-in replacement for Ponomar.
