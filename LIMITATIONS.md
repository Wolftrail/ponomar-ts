# Known limitations

This document lists deviations from upstream
[typiconman/ponomar](https://github.com/typiconman/ponomar) that ship as of
`1.0.0`. Each entry is an intentional, accepted scope decision — not a bug.
Filing an issue is welcome if you hit real breakage or need one lifted.

For per-phase context, see [PLAN.md](PLAN.md).

## Engine

### Lucan-jump *numbering* (Sept–Nov sequential-reading cycle reset)

`getOrderedLiturgyReadings` implements Suppress, Class3Transfers, Saturday
inversion, and cross-day pull (`TransferRulesB` / `TransferRulesF`). The
September–November boundary where sequential-reading *numbering* shifts to
a Lucan cycle lives in upstream's static day XML (`pentecostarion/*.xml`) and
is consumed as-is via codegen. If upstream's XML is correct, our ordering is
correct; if upstream's XML has a numbering bug, we inherit it.

### `dRank = "0"` override on cross-day peek

Upstream `DivineLiturgy1.Readings()` sets `dRank = "0"` before its recursive
call into the adjacent day, suppressing rank-gated `Class3Transfers`
(`dRank >= 5`) and rank-gated `Suppress` clauses when peeking at the neighbor.
`ponomar-ts` does not mirror this override. It's **inert on the current
corpus** because only 6 of 3,371 commemorations carry a `<CHURCH Rank>`.
Consumers who supply richer rank data may see divergence.

### Rank-aware `<SERVICE Type>` selection

`Commemoration.hymns` collects every `<TROPARION>` / `<KONTAKION>`, regardless
of the day's `dRank`. Upstream `Service.java` would filter by
`<SERVICE Type="…">` matching the current rank. Same reason as above: rank
data is too sparse for the filter to be meaningful. `getPropers` returns
all matching hymns; consumers can filter downstream if needed.

### `Matins.LeapReadings`

Upstream's `Matins.LeapReadings()` reads a shared `Information2` map populated
by `DivineLiturgy1`. In the current corpus, that table's Matins-scoped entries
are empty and the method is a no-op. Not ported.

### `Octoecheos/**` and `Var/**` service overrides

Upstream's Hour classes overlay tone/weekday `Octoecheos/Tone N/<Weekday>.xml`
onto the base `<PRIMES>` / `<TERCE>` / `<SEXTE>` / `<NONE>` rules, and
resolve `<GET File="Var/…"/>` includes to dynamically-generated content.
`composeService` **preserves these as opaque `get` directives** so consumers
can inject the right content when rendering. The engine does not compose them
because their content is parameterised over tone selections that upstream
resolves via UI state (`PrimeSelector` etc.).

### Fasting display strings

`Fasting.convert()` upstream produces a localized human-readable string from
the 7-bit permission mask. `getFasting` returns the mask + a coarse `level`
enum; localization belongs to the consumer per the "engine returns raw IDs"
policy.

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
