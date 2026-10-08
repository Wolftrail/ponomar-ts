// Ported from Ponomar/Commemoration1.java readCommemoration() and getReadings() (typiconman/ponomar).

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { findLives } from "../data/access.ts";
import type { LifeScripture, LifeSectionName } from "../data/types.ts";

/** A reading of a commemoration's service, as its life file gives it. */
export type ScriptureReading = Omit<LifeScripture, "kind">;

/**
 * The scripture readings of one section (Vespers, Liturgy, ...) of a commemoration, keyed by their `type`.
 * Life files are read root first and a later reading of the same type replaces an earlier one; a `Cmd` on the
 * service, the section or the reading itself must hold for it to count.
 */
export async function commemorationReadings(
	cid: string,
	language: string,
	section: LifeSectionName,
	context: DslContext,
): Promise<Readonly<Record<string, ScriptureReading>>> {
	const readings: Record<string, ScriptureReading> = {};
	for (const life of await findLives(cid, language)) {
		for (const service of life.services) {
			if (service.cmd !== undefined && !evaluateBoolean(service.cmd, context)) {
				continue;
			}
			for (const part of service.sections) {
				if (part.section !== section || (part.cmd !== undefined && !evaluateBoolean(part.cmd, context))) {
					continue;
				}
				for (const item of part.items) {
					if (item.kind === "scripture" && (item.cmd === undefined || evaluateBoolean(item.cmd, context))) {
						const { kind: _kind, ...reading } = item;
						readings[item.type] = reading;
					}
				}
			}
		}
	}
	return readings;
}
