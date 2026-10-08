# Upstream notice

This project reimplements functionality from Ponomar, originally written in Java. The upstream source is retained under `vendor/ponomar`, together with its license. Ported files identify their upstream counterpart where applicable.

This package is distributed under GPL-3.0-or-later. See `LICENSE` and `vendor/ponomar/LICENSE` for the applicable license texts and preserve attribution when redistributing derived work.

`vendor/ponomar/Ponomar/StringOp.java` carries a header forbidding copying, modification, or distribution, which conflicts with the repository's GPL-3.0 statement. This package therefore does not translate that file. `src/core/dsl/` reimplements the expression language from its observable behavior and is checked against the upstream class as a black box (see `scripts/golden/`).
