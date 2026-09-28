// Curated `cId → church.rank` overlay for major feasts.
//
// Upstream typiconman/ponomar authors `<CHURCH Rank="…">` on only ~6 XML
// files total (see `AGENTS.md` / the port audit); as a result the
// data-driven `dRank` computed in `getLiturgicalDay` is `0` on nearly every
// day, including Pascha, the Twelve Great Feasts, Peter & Paul, the
// Forerunner feasts, and the Protection. This overlay supplies the ranks
// upstream forgot, so downstream consumers can key UI decisions off
// `s.church?.rank` and `getLiturgicalDay(date).dRank`.
//
// Convention (higher = more festive, matching upstream DSL usage in
// `DivineLiturgy.xml`, `Fasting.xml`, `Matins.java`):
//   8 — Pascha
//   7 — Great Feast of the Lord / Bright Week
//   6 — Great Feast of the Theotokos
//   5 — Vigil-rank (major polyeleos saint / lesser dominical feast)
//   4 — Polyeleos    (unused by this overlay; upstream data owns these)
//   3 — Doxology     (unused)
//   2 — Six-stichera (unused)
//   1 — Simple daily (unused)
//   0 — No rank      (default)
//
// This overlay OVERRIDES any rank in the generated `COMMEMORATIONS` map for
// the listed cIds. That is intentional: upstream's rank data is not just
// sparse but also contradictory (e.g. cId `373` is authored as Palamas
// rank 1 in `Commemorations/123/373.xml` yet referenced from the menaion
// at 02-02 for the Meeting of the Lord). For the cIds curated here we
// treat the overlay as authoritative.

/** Cid → rank. Frozen so consumers can rely on referential stability. */
export const RANK_OVERLAY: Readonly<Record<string, number>> = Object.freeze({
	// ── Rank 8 — Pascha ────────────────────────────────────────────────
	"9001": 8, // PASCHA

	// ── Rank 7 — Great Feasts of the Lord + Bright Week ────────────────
	"9002": 7, // Bright Monday
	"9003": 7, // Bright Tuesday
	"9004": 7, // Bright Wednesday
	"9005": 7, // Bright Thursday
	"9006": 7, // Bright Friday (Life-Giving Spring)
	"9007": 7, // Bright Saturday
	"3174": 7, // Nativity of Christ (Dec 25 Julian)
	"163": 7, // Theophany (Jan 6 Julian)
	"373": 7, // Meeting of the Lord (Feb 2 Julian)
	"9807": 7, // Palm Sunday / Entry into Jerusalem
	"9040": 7, // Ascension (nday +39)
	"9050": 7, // Pentecost (nday +49)
	"4386": 7, // Transfiguration (Aug 6 Julian)
	"1529": 7, // Elevation of the Cross (Sep 14 Julian)

	// ── Rank 6 — Great Feasts of the Theotokos ─────────────────────────
	"1479": 6, // Nativity of the Theotokos (Sep 8 Julian)
	"2575": 6, // Entry of the Theotokos (Nov 21 Julian)
	"707": 6, // Annunciation (Mar 25 Julian)
	"4444": 6, // Dormition (Aug 15 Julian)

	// ── Rank 5 — Vigil-rank / lesser dominical & major-saint feasts ────
	"010101": 5, // Circumcision of the Lord (Jan 1 Julian)
	"3050": 5, // Nativity of the Forerunner (Jun 24 Julian)
	"09785": 5, // Ss. Peter and Paul (Jun 29 Julian)
	"91007": 5, // Beheading of the Forerunner (Aug 29 Julian)
	"1638": 5, // Protection of the Theotokos (Oct 1 Julian)
});

/** Lookup helper: returns the overlaid rank for `cId`, or `undefined`. */
export function getOverlayRank(cId: string): number | undefined {
	return RANK_OVERLAY[cId];
}
