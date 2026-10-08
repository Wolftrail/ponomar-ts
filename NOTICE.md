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
