# Known limitations

This document lists deviations from upstream
[typiconman/ponomar](https://github.com/typiconman/ponomar) that ship as of
`1.0.0`. Each entry is an intentional, accepted scope decision — not a bug.
Filing an issue is welcome if you hit real breakage or need one lifted.

For per-phase context, see [PLAN.md](PLAN.md).

## Tradition and jurisdictional scope

ponomar-ts follows the **Russian Orthodox** usage of the Jerusalem Typicon
(Slavic recension) as published by Holy Trinity Monastery, Jordanville
(ROCOR) at [holytrinityorthodox.com](https://www.holytrinityorthodox.com/calendar/).
Fixed feasts are keyed to the **Julian** calendar; fasting follows the
**Russian monastic charter**; the saint corpus includes the twentieth-century
Russian New Hieromartyrs and other Moscow-Patriarchate / ROCOR
commemorations. See the "Tradition" section of
[README.md](README.md#tradition) for the full statement.

Out of scope: Greek / Antiochian usage, New-Calendar (Revised Julian)
fixed-feast dating, Old Rite / Old Believer rubrics, and Mt. Athos monastic
variants. Pull requests that would widen the project to serve those
traditions are welcome in principle but will not block 1.0.

## Engine

### Service composition is no longer public API

The `0.1.x-alpha` line shipped a full Ponomar service composer
(`composeService`, `getPropers`, `getServices`, `getHourService`,
`getOrderedLiturgyReadings`, `getOrderedMatinsReadings`, plus the DSL /
resolver internals). `1.0.0-rc.9` removed every one of these from the
public barrels after HTOC was adopted as the publication-level source of
truth: HTOC supplies the printed daily commemorations, propers, header,
tone, and reading list directly, which turned out to be more valuable to
consumers than a half-translated Russian typikon service order. The
implementations still exist under `src/engine/*` and resolve via direct
deep imports (e.g. `ponomar-ts/engine/compose`) as an **unsupported
escape hatch** not covered by semver — if you depend on them, pin the
exact version.

Follow-on consequences:
- Upstream `DivineLiturgy1.Readings()`'s `dRank = "0"` override on the
  cross-day peek (preserved internally in `getOrderedLiturgyReadings`) is
  therefore inert from a public-API perspective. The cross-day pull now
  only matters to consumers using the escape hatch.
- Rank-aware `<SERVICE Type>` filtering of `Commemoration.hymns` was
  never ported (rank data is too sparse — only ~6 of 3,371 cIds carry a
  rank), and this is also no longer visible from the public surface
  since `getPropers` is gone.
- `Octoecheos/**` + `Var/**` dynamic includes were preserved by the old
  `composeService` as opaque `get` directives for consumers to render;
  that engine is no longer public, so the behaviour is only observable
  via the escape hatch.

### Lucan-jump *numbering* (Sept–Nov sequential-reading cycle reset)

The September–November boundary where sequential-reading *numbering*
shifts to a Lucan cycle lives in upstream's static day XML
(`pentecostarion/*.xml`) and is consumed as-is via codegen. If upstream's
XML is correct, our output is correct; if upstream has a numbering bug,
we inherit it. In practice `getDailyReadings` now runs HTOC's
saint-lectionary layer on top of the structural picks, so for the
vendored 2025–2027 window the Lucan handoff follows HTOC's published
choice regardless of what Ponomar's structural XML says.

### Propers outside the HTOC coverage window

Two surfaces behave differently here:

- `LiturgicalDay.troparia` / `.kontakia` returned by `getLiturgicalDay`
  **are populated for any Gregorian year**. Inside the vendored
  2025–2027 window they are HTOC's published hymns verbatim; outside the
  window they are composed from three position-stable cycle maps
  (`FIXED_HYMNS_CYCLE` keyed by Julian MM-DD, `PASCHAL_HYMNS_CYCLE` keyed
  by signed days from Pascha, `SUNDAY_TONE_HYMNS_CYCLE` keyed by tone),
  which reproduce ~98% of in-window hymn occurrences with no false
  positives (the composer never emits content HTOC did not publish). The
  remaining ~2% are moveable-Sunday feasts whose dates depend on
  DOW/week-of-year interactions (e.g. Sunday Before Nativity, Sunday of
  the Holy Forefathers, Sunday of the Fathers of the 7th Ecumenical
  Council); their hymns are deliberately dropped rather than guessed.
- The lower-level `getDay(date)` / `DAY_FACTS_BY_ISO.get(iso)` accessor
  returns HTOC's verbatim record inside the window and a partial record
  outside the window with `troparia` / `kontakia` empty. Prefer
  `getLiturgicalDay` for the composed hymn surface.

### `Matins.LeapReadings`

Upstream's `Matins.LeapReadings()` reads a shared `Information2` map
populated by `DivineLiturgy1`. In the current corpus that table's
Matins-scoped entries are empty and the method is a no-op. Not ported.

### Fasting display strings

`Fasting.convert()` upstream produces a localized human-readable string
from the 7-bit permission mask. `getFasting` returns the mask + a coarse
`level` enum + a structured `period` (`"great-lent"` / `"apostles"` /
`"dormition"` / `"nativity"` / `"weekly"` with an `isEve` flag). An
optional `renderFastText(ctx, level)` courtesy helper and the
`getFastingPeriodName(period)` label are provided for consumers who want
a quick starter, but `renderFastText` encodes a strict Russian typikon
flavour and is documented to diverge from HTOC's Hellenic rendering —
localization in general belongs to the consumer per the "engine returns
raw IDs" policy. (See [CHANGELOG.md](CHANGELOG.md) for the `1.0.0-rc.19`
removal of the pre-rendered English `fastText` field.)

### Rank inference "klutz" in `ServiceInfo.java`

Upstream `ServiceInfo` contains a self-declared workaround that hard-codes
`dRank` from `doy`/`nday`. Not ported — ranks flow through
`LiturgicalDay.dRank` from `<CHURCH Rank>` metadata (plus the rank overlay
for major feasts), matching the upstream code comment that the klutz
"is unnecessary since the days can now be ranked properly."

## Data

### Language policy: English only

- Lives (`languages/en/xml/lives/`) — English only. Consumers can plug in
  additional locales via their own codegen if desired.
- Phrases (`languages/en/xml/Services/**`) — English only.
- Bible (`<BIBLE Id="en/bible/kjv">`) — canonical book IDs are language-
  neutral so consumers can join to any Bible text. Non-English `<BIBLE>`
  blocks (Brenton, French, Church Slavonic, Latin, Chinese) are not exposed.

### Upstream XML typos we inherit

- [lives/9803.xml](vendor/ponomar/Ponomar/languages/xml/lives/9803.xml):
  `Reading="Mt_26:1-20; "` — stray trailing semicolon causes `parseBibleRef`
  to reject this specific reading. All 1169 other unique references in the
  corpus parse cleanly.

## Out of scope (by design)

These are the classes listed in [PLAN.md](PLAN.md) as intentionally not
ported and are documented here for reference:

- **Swing UI**: `Main`, `JCalendar`, `JDaySelector`, `IconDisplay`,
  `PrintableTextPane`, `LanguageSelector`, `PrimeSelector`, `About`,
  `Options`, `Reporter`, `MenuFiles`, `DoSaint1`, `GospelSelector`, and the
  UI portions of `Bible.java`.
- **Database**: `Database.java` (unused HSQLDB integration upstream).
- **Localization**: `LanguagePack.java`, `Languagizer.java`,
  `RuleBasedNumber.java`.
- **Application-layer search**: `Search.java`.
- **Bible text**: only reference *metadata* ships (`parseBibleRef`, book
  registry). Actual scripture text is a per-locale dataset that consumers
  supply themselves.
- **Icon display, fonts, music library**.

## Where behavior is ambiguous

Where upstream is ambiguous or buggy, the ported behavior follows upstream
bug-for-bug so that migrating from Ponomar Java to `ponomar-ts` doesn't
change output. If you spot a divergence, please open an issue — the port's
first commitment is fidelity, and correctness is negotiated in coordination
with upstream.
