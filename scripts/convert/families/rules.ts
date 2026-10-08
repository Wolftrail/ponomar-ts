// Converts the rule files in languages/xml/Commands: Fasting, ServiceRules, DivineLiturgy, ScriptureTransfers.
import type {
	FastingPeriod,
	LiturgyCommand,
	ServiceHour,
	ServiceRulePeriod,
} from "../../../src/data/types.ts";
import { type GeneratedFile, header, literal } from "../emit.ts";
import { attributes, checkExpression, children, compact } from "../schema.ts";
import { readXml, sourcePath } from "../sources.ts";

const OUTPUT = "src/data/generated/rules.ts";

function convertFasting(): FastingPeriod[] {
	const where = sourcePath("", "Commands/Fasting.xml");
	return children(readXml("", "Commands/Fasting.xml"), ["PERIOD"], where).map((period) => {
		const periodAttrs = attributes(period, ["Cmd"], where);
		return {
			...compact({ cmd: checkExpression(periodAttrs["Cmd"], where) }),
			rules: children(period, ["RULE"], where).map((rule) => {
				const attrs = attributes(rule, ["Case", "Cmd"], where, ["Case"]);
				if (!/^[01]{7}$/.test(attrs["Case"]!)) {
					throw new Error(`${where}: fasting level "${attrs["Case"]}" is not seven binary digits`);
				}
				return { level: attrs["Case"]!, ...compact({ cmd: checkExpression(attrs["Cmd"], where) }) };
			}),
		};
	});
}

const HOURS: Readonly<Record<string, ServiceHour>> = { PRIME: "prime", TERCE: "terce", SEXTE: "sexte", NONE: "none" };

function convertServiceRules(): ServiceRulePeriod[] {
	const where = sourcePath("", "Commands/ServiceRules.xml");
	return children(readXml("", "Commands/ServiceRules.xml"), ["PERIOD"], where).map((period) => {
		const periodAttrs = attributes(period, ["Cmd"], where);
		return {
			...compact({ cmd: checkExpression(periodAttrs["Cmd"], where) }),
			entries: children(period, Object.keys(HOURS), where).map((entry) => {
				const attrs = attributes(entry, ["Type", "Troparion", "PickT", "Kontakion", "PickK", "Cmd", "LENTENK"], where, ["Type"]);
				return {
					hour: HOURS[entry.name]!,
					type: attrs["Type"]!,
					...compact({
						troparion: attrs["Troparion"],
						pickT: attrs["PickT"],
						kontakion: attrs["Kontakion"],
						pickK: attrs["PickK"],
						lentenK: attrs["LENTENK"],
						cmd: checkExpression(attrs["Cmd"], where),
					}),
				};
			}),
		};
	});
}

function convertCommands(logicalPath: string): LiturgyCommand[] {
	const where = sourcePath("", logicalPath);
	return children(readXml("", logicalPath), ["COMMAND"], where).map((command) => {
		const attrs = attributes(command, ["Name", "Value", "Comment", "Comments", "Cmd"], where, ["Name", "Value"]);
		return {
			name: attrs["Name"]!,
			value: checkExpression(attrs["Value"], where)!,
			...compact({ cmd: checkExpression(attrs["Cmd"], where), comment: attrs["Comment"] ?? attrs["Comments"] }),
		};
	});
}

export function convertRules(): GeneratedFile[] {
	const sources = ["Fasting", "ServiceRules", "DivineLiturgy", "ScriptureTransfers"].map((name) => sourcePath("", `Commands/${name}.xml`));
	const content =
		header(sources.join(", "), 'import type { FastingPeriod, LiturgyCommand, ServiceRulePeriod } from "../types.ts";') +
		`export const FASTING: readonly FastingPeriod[] = ${literal(convertFasting())};\n\n` +
		`export const SERVICE_RULES: readonly ServiceRulePeriod[] = ${literal(convertServiceRules())};\n\n` +
		`export const DIVINE_LITURGY_COMMANDS: readonly LiturgyCommand[] = ${literal(convertCommands("Commands/DivineLiturgy.xml"))};\n\n` +
		`export const SCRIPTURE_TRANSFER_COMMANDS: readonly LiturgyCommand[] = ${literal(convertCommands("Commands/ScriptureTransfers.xml"))};\n`;
	return [{ path: OUTPUT, content }];
}
