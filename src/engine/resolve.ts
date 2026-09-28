// Apply the DSL `Cmd` guards on `Saint` records to a DayContext, and resolve
// the optional numeric `Tone` expression. Saints whose guard evaluates to
// false are dropped. Joined `<NAME>` / `<CHURCH>` / `<INFO>` metadata from
// the generated COMMEMORATIONS map is attached when available so callers
// have UI-ready titles and ranks without a second lookup.

import { evaluate, evaluateBool } from "../core/dsl/index.ts";
import type {
	Church,
	DayEntry,
	Saint,
	SaintInfo,
	SaintName,
} from "../data/index.ts";
import { COMMEMORATIONS, RANK_OVERLAY } from "../data/index.ts";
import type { DayContext } from "./day.ts";
import { dslContext } from "./day.ts";

/**
 * A `Saint` with its `Tone` expression resolved to a number (or null if
 * absent). The `cmd` guard, if any, has already been evaluated to `true`.
 * `name` / `church` / `info` are populated when a matching `<NAME>` /
 * `<CHURCH>` / `<INFO>` record exists for this `cId` in the bundled
 * English commemorations dataset.
 */
export interface ResolvedSaint {
	readonly sIds: readonly string[];
	readonly cId: string;
	readonly src?: string;
	readonly tone: number | null;
	readonly name?: SaintName;
	readonly church?: Church;
	readonly info?: SaintInfo;
}

/** Evaluate every saint's `Cmd`, then resolve tone; drop saints where Cmd is false. */
export function resolveSaints(
	entry: DayEntry,
	ctx: DayContext,
	extraVars?: Readonly<Record<string, number>>,
): ResolvedSaint[] {
	const vars = dslContext(ctx, extraVars);
	const out: ResolvedSaint[] = [];
	for (const s of entry.saints) {
		if (s.cmd !== undefined && !evaluateBool(s.cmd, vars)) continue;
		const meta = COMMEMORATIONS[s.cId];
		const church = applyRankOverlay(s.cId, meta?.church);
		out.push({
			sIds: s.sIds,
			cId: s.cId,
			...(s.src !== undefined ? { src: s.src } : {}),
			tone: resolveTone(s, vars),
			...(meta?.name !== undefined ? { name: meta.name } : {}),
			...(church !== undefined ? { church } : {}),
			...(meta?.info !== undefined ? { info: meta.info } : {}),
		});
	}
	return out;
}

// The overlay authoritatively supplies `rank` for the curated cIds. If the
// generated `Church` metadata already carries `cycle`/`tone`, we preserve
// those and only replace `rank`.
function applyRankOverlay(
	cId: string,
	meta: Church | undefined,
): Church | undefined {
	const overlay = RANK_OVERLAY[cId];
	if (overlay === undefined) return meta;
	return { ...(meta ?? {}), rank: overlay };
}

function resolveTone(
	s: Saint,
	vars: Readonly<Record<string, number>>,
): number | null {
	if (s.tone === undefined) return null;
	const n = evaluate(s.tone, vars);
	if (!Number.isFinite(n)) return null;
	return Math.trunc(n);
}
