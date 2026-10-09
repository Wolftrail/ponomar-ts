# Upstream notice

This project reimplements functionality from Ponomar, originally written in Java. The upstream source is retained under `vendor/ponomar`, together with its license. Ported files identify their upstream counterpart where applicable.

This package is distributed under GPL-3.0-or-later. See `LICENSE` and `vendor/ponomar/LICENSE` for the applicable license texts and preserve attribution when redistributing derived work.

`vendor/ponomar/Ponomar/StringOp.java` carries a header forbidding copying, modification, or distribution, which conflicts with the repository's GPL-3.0 statement. This package therefore does not translate that file. `src/core/dsl/` reimplements the expression language from its observable behavior and is checked against the upstream class as a black box (see `scripts/golden/`).

## Ported files with their own notice

Several upstream files (including `Day.java`, `Days.java`, `Commemoration1.java` and `Fasting.java`, by Yuri Shardt) carry this notice. Code in this package derived from them keeps it:

> PERMISSION IS HEREBY GRANTED TO USE, MODIFY, AND/OR REDISTRIBUTE THIS SOURCE CODE PROVIDED THAT THIS NOTICE REMAINS IN ALL VERSION AND / OR DERIVATIVES THEREOF.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The copyright lines of those files ("(C) 2009, 2010, 2012, 2015 Yuri Shardt. All rights reserved.") apply to the work derived from them, which is why each ported source file names the Java file it follows.

## Astronomy

`src/astronomy/astronomy.ts` follows `Sunrise.java` and `Astronomy.java`. The sunrise algorithm is C. Schlyter's ("Written as DAYLEN.C, 1989-08-16; modified to SUNRISET.C, 1992-12-01; (c) Paul Schlyter, 1989, 1992; released to the public domain by Paul Schlyter, December 1992"), through the Perl module Astro::Sunrise and Aleksandr Andreev's conversion to Java for Ponomar (C) 2006. Its permission notice is kept here:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The lunar functions are Yuri Shardt's (Copyright 2012), after Meeus.
