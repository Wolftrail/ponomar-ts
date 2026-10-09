// Ported from Ponomar/Service.java (typiconman/ponomar).
// Differences: the result is a list of typed nodes, not HTML; Bible passages are references, as no Bible text is shipped;
// a text that cannot be found is left undefined where upstream writes an error line into the page.

import { evaluateBoolean, type DslContext } from "../core/dsl/index.ts";
import { getPrayerText, getServiceTemplate } from "../data/services.ts";
import type { LifeItem, LifeSectionName, ServiceDirective } from "../data/types.ts";
import { commemorationServiceItem } from "./commemoration.ts";
import { formatTimes } from "./localization.ts";

/** How a piece of the service is presented: who says it and the layout flags of the template. */
export interface ServicePresentation {
	/** The speaker: "P" priest, "R" reader, "SR" senior reader, "D" deacon, "C" choir; empty for none. */
	readonly who: string;
	/** The speaker's label in the language ("Priest:"), if there is a speaker. */
	readonly whoLabel?: string;
	readonly redFirst: boolean;
	readonly newLine: boolean;
	/** Whether the piece opens with its header. */
	readonly header: boolean;
}

export interface ServiceTitleNode {
	readonly kind: "title";
	readonly title?: string;
	readonly windowTitle?: string;
	readonly source?: string;
	readonly comment?: string;
}

export interface ServiceSubtitleNode {
	readonly kind: "subtitle";
	readonly title?: string;
	readonly comment?: string;
}

/** A named prayer, hymn or response, with the rubrics that go with it. */
export interface ServicePrayerNode extends ServicePresentation {
	readonly kind: "prayer";
	/** The file name under CommonPrayers/, e.g. "TROPARION/SUN8". */
	readonly what: string;
	readonly text?: string;
	readonly headerText?: string;
	readonly times?: number;
	/** The repeat count as the language writes it ("Thrice"). */
	readonly timesText?: string;
	/** A rubric after the text (key and text), e.g. "Bow". */
	readonly command?: string;
	readonly commandText?: string;
	/** A rubric before the text. */
	readonly commandB?: string;
	readonly commandBText?: string;
}

/** A passage of Scripture; the consumer supplies its text. */
export interface ServiceReadingNode extends ServicePresentation {
	readonly kind: "reading";
	/** The passage in the notation of the data, e.g. "Psalm_5". */
	readonly verses?: string;
	/** The book whose "A reading from ..." introduction is wanted instead of a passage. */
	readonly intro?: string;
	/** How the second line of a "**" heading is used: 1 as an added header, 2 as the start of the text. */
	readonly twoStars?: number;
}

/** A hymn or verse taken from a commemoration's own service data. */
export interface ServiceProperNode extends ServicePresentation {
	readonly kind: "proper";
	/** "M" for a Menaion commemoration, "T" for one of the Triodion. */
	readonly commemorationType: string;
	readonly id: string;
	/** The commemoration the id names; Triodion ids are prefixed with "98". */
	readonly cid: string;
	/** The location inside the commemoration's service, e.g. "/SEXTE/PROKEIMENON/1a". */
	readonly what: string;
	/** The text found there; undefined if the commemoration has no such item. */
	readonly text?: string;
	readonly headerText?: string;
	readonly tone?: string;
}

export type ServiceNode = ServiceTitleNode | ServiceSubtitleNode | ServicePrayerNode | ServiceReadingNode | ServiceProperNode;

/** Templates that exist only for one service, keyed like `GET File`; upstream wrote these as scratch files (Services/Var). */
export type ServiceFiles = Readonly<Record<string, readonly ServiceDirective[]>>;

async function textOf(language: string, key: string): Promise<string | undefined> {
	const text = (await getPrayerText(language, key))?.text;
	return text === undefined || text === "" ? undefined : text;
}

async function presentation(language: string, directive: { who: string; redFirst?: string; newLine?: string; header?: string }): Promise<ServicePresentation> {
	const whoLabel = directive.who === "" ? undefined : await textOf(language, `CommonPrayers/${directive.who}`);
	return {
		who: directive.who,
		...(whoLabel === undefined ? {} : { whoLabel }),
		redFirst: directive.redFirst === "1",
		newLine: directive.newLine === "1",
		header: directive.header === "1",
	};
}

async function expandDirective(
	directive: ServiceDirective,
	language: string,
	context: DslContext,
	files: ServiceFiles,
	out: ServiceNode[],
): Promise<void> {
	switch (directive.directive) {
		case "get": {
			// A file that does not exist adds nothing, as upstream.
			const template = files[directive.file] ?? getServiceTemplate(directive.file);
			if (template !== undefined) {
				await expandDirectives(template, language, context, files, out);
			}
			return;
		}
		case "title": {
			const title = await textOf(language, `Text/${directive.value}`);
			const windowTitle = await textOf(language, `Text/${directive.header}`);
			const source = directive.source === undefined ? undefined : await textOf(language, `Text/${directive.source}`);
			const comment = directive.comment === undefined ? undefined : await textOf(language, `Text/${directive.comment}`);
			out.push({
				kind: "title",
				...(title === undefined ? {} : { title }),
				...(windowTitle === undefined ? {} : { windowTitle }),
				...(source === undefined ? {} : { source }),
				...(comment === undefined ? {} : { comment }),
			});
			return;
		}
		case "subtitle": {
			const title = await textOf(language, `Text/${directive.value}`);
			out.push({ kind: "subtitle", ...(title === undefined ? {} : { title }) });
			return;
		}
		case "create": {
			const prayer = await getPrayerText(language, `CommonPrayers/${directive.what}`);
			const times = directive.times === undefined ? undefined : Number.parseInt(directive.times, 10);
			const timesText = times === undefined ? undefined : await formatTimes(language, times);
			const commandText = directive.command === undefined ? undefined : await textOf(language, `Command/${directive.command}`);
			const commandBText = directive.commandB === undefined ? undefined : await textOf(language, `Command/${directive.commandB}`);
			out.push({
				kind: "prayer",
				what: directive.what,
				...(prayer?.text === undefined || prayer.text === "" ? {} : { text: prayer.text }),
				...(prayer?.header === undefined || prayer.header === "" ? {} : { headerText: prayer.header }),
				...(times === undefined ? {} : { times }),
				...(timesText === undefined ? {} : { timesText }),
				...(directive.command === undefined ? {} : { command: directive.command }),
				...(commandText === undefined ? {} : { commandText }),
				...(directive.commandB === undefined ? {} : { commandB: directive.commandB }),
				...(commandBText === undefined ? {} : { commandBText }),
				...(await presentation(language, directive)),
			});
			return;
		}
		case "bible": {
			out.push({
				kind: "reading",
				...(directive.verses === undefined ? {} : { verses: directive.verses }),
				...(directive.getReading === undefined ? {} : { intro: directive.getReading }),
				...(directive.twoStars === undefined ? {} : { twoStars: Number.parseInt(directive.twoStars, 10) }),
				...(await presentation(language, directive)),
			});
			return;
		}
		case "getId": {
			const cid = directive.type === "T" ? `98${directive.id}` : directive.id;
			const slash = directive.what.lastIndexOf("/");
			const [section, kind] = directive.what.substring(0, slash).split("/").filter((part) => part !== "").map((part) => part.toLowerCase());
			const item = await commemorationServiceItem(cid, language, section as LifeSectionName, kind as LifeItem["kind"], directive.what.substring(slash + 1), context);
			const text = item === undefined || item.kind === "scripture" || item.text === "" ? undefined : item.text;
			const headerText = item === undefined || item.kind === "scripture" ? undefined : item.header;
			const tone = item === undefined || item.kind === "scripture" ? undefined : item.tone;
			out.push({
				kind: "proper",
				commemorationType: directive.type,
				id: directive.id,
				cid,
				what: directive.what,
				...(text === undefined ? {} : { text }),
				...(headerText === undefined || headerText === "" ? {} : { headerText }),
				...(tone === undefined ? {} : { tone }),
				...(await presentation(language, directive)),
			});
			return;
		}
	}
}

async function expandDirectives(
	directives: readonly ServiceDirective[],
	language: string,
	context: DslContext,
	files: ServiceFiles,
	out: ServiceNode[],
): Promise<void> {
	for (const directive of directives) {
		// A condition on a directive applies to it alone; upstream does not let it suppress the directives around it.
		if (directive.cmd === undefined || evaluateBoolean(directive.cmd, context)) {
			await expandDirective(directive, language, context, files, out);
		}
	}
}

/**
 * Expands a service template into its nodes for the given conditions (`PS`, `PFlag1`, the day's variables, ...),
 * following `GET` includes. `files` supplies templates upstream generated at run time.
 */
export async function expandServiceTemplate(name: string, language: string, context: DslContext, files: ServiceFiles = {}): Promise<ServiceNode[]> {
	const template = files[name] ?? getServiceTemplate(name);
	const out: ServiceNode[] = [];
	if (template !== undefined) {
		await expandDirectives(template, language, context, files, out);
	}
	return out;
}
