// Compose an ordered directive stream for a service template.
//
// Ported (partially) from Ponomar/Service.java. Given a template name and a
// Gregorian date, walks the template's `<TITLE>` + `<GET>` / `<CREATE>` /
// `<BIBLE>` directives, evaluates each directive's optional DSL `Cmd` guard
// against the day context extended with caller-supplied service flags
// (`PS`, `PFlag1`, `PFlag2`), expands `<GET>` includes inline, and returns
// the resulting flat directive list plus the resolved title.
//
// **Not** implemented here (deferred to consumers or later slices):
//   * phrase text resolution — a `create` directive's `what` is an opaque
//     identifier for the language-pack file basename;
//   * scripture-body loading for `<BIBLE Verses="…"/>` or dynamic
//     `getReading=` lookup;
//   * HTML rendering of `Who` / `RedFirst` / `Command` etc.
//
// Consumers receive a shape they can walk to produce whatever format they
// want (HTML, plain text, structured JSON).

import type { CalendarDate } from "../core/calendar/pcalendar.ts";
import { evaluateBool } from "../core/dsl/index.ts";
import { SERVICE_TEMPLATES } from "../data/index.ts";
import type {
	ServiceDirective,
	ServiceTemplate,
	ServiceTitle,
} from "../data/index.ts";
import { computeDayContext, dslContext } from "./day.ts";
import type { DayContext } from "./day.ts";

/** Caller-supplied service flags overlaid on the day context. Undefined
 *  entries default to `0` (matching upstream's initial `dayInfo.put(k, 0)`). */
export interface ComposeServiceOptions {
	/** Type of service: `0` = reader, `1` = priest, `2+` = multi-cleric. */
	readonly PS?: number;
	/** Framing: `0` = independent, `1` = no beginning, `2` = no ending,
	 *  `3` = neither. */
	readonly PFlag1?: number;
	/** Ritual variant: `0` = normal, `1` = Lenten (no kathisma),
	 *  `2` = Lenten (with kathisma), `3` = Lenten during Holy Week. */
	readonly PFlag2?: number;
	/** Cap on `<GET>` expansion depth. Default: `4`. Guards against upstream
	 *  templates that might cycle if hand-edited. */
	readonly maxIncludeDepth?: number;
}

export interface ComposedService {
	readonly context: DayContext;
	readonly template: string;
	readonly title?: ServiceTitle;
	/** All directives after `Cmd` filtering and `<GET>` expansion, in the
	 *  order they will be spoken. Every directive is either a `create` or
	 *  a `bible` — `get` directives are consumed by expansion. Unresolved
	 *  includes (missing target templates) are preserved as `get` entries
	 *  so consumers can decide how to fill or skip them. */
	readonly directives: readonly ServiceDirective[];
}

export function composeService(
	gregorian: CalendarDate,
	template: string,
	options: ComposeServiceOptions = {},
): ComposedService {
	const root = SERVICE_TEMPLATES[template];
	if (root === undefined) {
		throw new Error(`composeService: unknown template ${JSON.stringify(template)}`);
	}
	const context = computeDayContext(gregorian);
	const vars = dslContext(context, {
		PS: options.PS ?? 0,
		PFlag1: options.PFlag1 ?? 0,
		PFlag2: options.PFlag2 ?? 0,
	});
	const maxDepth = options.maxIncludeDepth ?? 4;
	const seen = new Set<string>();
	const out: ServiceDirective[] = [];
	expand(root, vars, out, seen, maxDepth, 0);
	return {
		context,
		template,
		...(root.title !== undefined ? { title: root.title } : {}),
		directives: out,
	};
}

function expand(
	template: ServiceTemplate,
	vars: Readonly<Record<string, number>>,
	out: ServiceDirective[],
	seen: Set<string>,
	maxDepth: number,
	depth: number,
): void {
	if (seen.has(template.name)) return;
	seen.add(template.name);
	for (const d of template.directives) {
		if (d.cmd !== undefined && !evaluateBool(d.cmd, vars)) continue;
		if (d.kind === "get") {
			const sub = resolveInclude(d.file);
			if (sub === undefined || depth >= maxDepth) {
				out.push(d);
				continue;
			}
			expand(sub, vars, out, seen, maxDepth, depth + 1);
			continue;
		}
		out.push(d);
	}
	seen.delete(template.name);
}

function resolveInclude(fileRef: string): ServiceTemplate | undefined {
	// Upstream refs are usually bare basenames (e.g. `"UsualBeginning"`).
	// Nested paths like `"Var/PTrop91"` are treated as unresolvable here —
	// consumers may inject them post-hoc.
	if (fileRef.includes("/")) return undefined;
	return SERVICE_TEMPLATES[fileRef];
}
