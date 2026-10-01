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
//   7 — Great Feast of the Lord (Bright Week days omitted — see note below)
//   6 — Great Feast of the Theotokos / Great-Feast tier major-saint feasts
//       (Peter & Paul, Nativity + Beheading of the Forerunner — HTOC
//       tags them with rank glyph "6" in Russian / Slavic usage)
//   5 — Vigil-rank (major polyeleos saint / lesser dominical feast)
//   4 — Polyeleos (Circumcision + Basil; upstream data owns the rest)
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

	// ── Rank 7 — Great Feasts of the Lord ──────────────────────────────
	// Bright Week days (9002-9007) are intentionally omitted: HTOC and most
	// calendars treat the week following Pascha as paschal continuation, not
	// as individual Great Feasts. Bright-Week festal behavior in the engine
	// flows from `nday ∈ [0, 6]` guards in the service DSL, not from `dRank`.
	"3174": 7, // Nativity of Christ (Dec 25 Julian)
	"163": 7, // Theophany (Jan 6 Julian)
	"9807": 7, // Palm Sunday / Entry into Jerusalem
	"9040": 7, // Ascension (nday +39)
	"9050": 7, // Pentecost (nday +49)
	"4386": 7, // Transfiguration (Aug 6 Julian)
	"1529": 7, // Elevation of the Cross (Sep 14 Julian)

	// ── Rank 6 — Great Feasts of the Theotokos + major-saint feasts ────
	// Meeting (373) follows the Slavic Typikon which places the Feb 2 Julian
	// feast on the Theotokos side of the ladder despite it being a Feast of
	// the Lord in the Byzantine reckoning. Protection (1638) is elevated to
	// Great-Feast rank in the Russian / ROCOR tradition — matching HTOC's
	// rank-6 tag — even though the Byzantine typikon files it as Vigil (5).
	// The three Forerunner / Peter-and-Paul feasts (3050, 09785, 91007) are
	// not among the Twelve but are traditionally celebrated at Great-Feast
	// tier in Russian / HTOC usage ("три великих праздника святых"), so we
	// put them here rather than at rank 5.
	"373": 6, // Meeting of the Lord (Feb 2 Julian)
	"1479": 6, // Nativity of the Theotokos (Sep 8 Julian)
	"2575": 6, // Entry of the Theotokos (Nov 21 Julian)
	"707": 6, // Annunciation (Mar 25 Julian)
	"4444": 6, // Dormition (Aug 15 Julian)
	"1638": 6, // Protection of the Theotokos (Oct 1 Julian)
	"3050": 6, // Nativity of the Forerunner (Jun 24 Julian)
	"09785": 6, // Ss. Peter and Paul (Jun 29 Julian)
	"91007": 6, // Beheading of the Forerunner (Aug 29 Julian)
	// Circumcision is a dominical feast co-celebrated with St. Basil the
	// Great; HTOC tags it rank-glyph "6" (Great-Feast tier) despite the
	// service structure resembling a Polyeleos. We follow HTOC.
	"010101": 6, // Circumcision of the Lord (Jan 1 Julian) + Basil the Great

	// ── Rank 5 — Vigil-rank / lesser dominical & major-saint feasts ────
	// (Upstream Ponomar XML owns these ranks for the few saints it marks;
	// nothing to curate here right now.)

	// ── Rank 4 — Polyeleos ─────────────────────────────────────────────
	// (Upstream Ponomar XML owns these ranks for the few saints it marks;
	// nothing to curate here right now.)
});

/** Lookup helper: returns the overlaid rank for `cId`, or `undefined`. */
export function getOverlayRank(cId: string): number | undefined {
	return RANK_OVERLAY[cId];
}
