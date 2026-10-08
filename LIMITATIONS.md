# Limitations

This is a fresh implementation in progress. It currently provides Julian date arithmetic (`JDate`), calendar conversion (`PCalendar`), the Paschalion calculations (Pascha, Pentecost, Lent and Apostles' Fast dates, indiction, solar and lunar cycles), and the `Cmd`/`Value`/`Tone` expression language. It does not yet port data conversion, day resolution, readings, fasting rules, service composition, localization, astronomy, or the original desktop interface.

The expression language uses standard C-style tokenization and precedence, whereas upstream splits expressions on spaced operators. The two agree on every expression in the vendored data, but unusual unspaced input may behave differently.

Behavior is being added incrementally against the upstream Ponomar Java project. Until a feature is implemented and tested, this package should not be treated as a drop-in replacement for Ponomar.
