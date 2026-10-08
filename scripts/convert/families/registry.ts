// Emits src/data/generated/registry.ts: one lazy loader per generated day and life module.
// Specifiers are string literals so the TypeScript build rewrites their extensions and bundlers can follow them.
import { type GeneratedFile, header } from "../emit.ts";

const PREFIX = "src/data/generated/";

function loaders(files: readonly GeneratedFile[], pattern: RegExp, keyOf: (match: RegExpExecArray) => string): string {
	const entries = files
		.map((file) => ({ file, match: pattern.exec(file.path) }))
		.filter((entry): entry is { file: GeneratedFile; match: RegExpExecArray } => entry.match !== null)
		.map(({ file, match }) => `\t${JSON.stringify(keyOf(match))}: () => import(${JSON.stringify(`./${file.path.slice(PREFIX.length)}`)}),`)
		.sort();
	return `{\n${entries.join("\n")}\n}`;
}

export function convertRegistry(files: readonly GeneratedFile[]): GeneratedFile {
	const day = (family: string) => new RegExp(`^${PREFIX}days/${family}\\.([^.]+)\\.ts$`);
	const slug = (match: RegExpExecArray): string => match[1]!;
	const body =
		`/** A lazily loaded module; \`import()\` caches it. */\nexport type Loader<T> = () => Promise<T>;\n\n` +
		`/** Language slug (see languageSlug) to the module holding that language directory's menaion days, keyed "MM-DD". */\n` +
		`export const MENAION_LOADERS: Readonly<Record<string, Loader<{ MENAION: Readonly<Record<string, DayFile>> }>>> = ${loaders(files, day("menaion"), slug)};\n\n` +
		`/** As MENAION_LOADERS, keyed by the Triodion file number. */\n` +
		`export const TRIODION_LOADERS: Readonly<Record<string, Loader<{ TRIODION: Readonly<Record<number, DayFile>> }>>> = ${loaders(files, day("triodion"), slug)};\n\n` +
		`/** As MENAION_LOADERS, keyed by the Pentecostarion file number. */\n` +
		`export const PENTECOSTARION_LOADERS: Readonly<Record<string, Loader<{ PENTECOSTARION: Readonly<Record<number, DayFile>> }>>> = ${loaders(files, day("pentecostarion"), slug)};\n\n` +
		`/** As MENAION_LOADERS, keyed by the floating-feast file number. */\n` +
		`export const FLOAT_LOADERS: Readonly<Record<string, Loader<{ FLOAT: Readonly<Record<number, FloatFile>> }>>> = ${loaders(files, day("float"), slug)};\n\n` +
		`/** Keyed "<chunk>.<language slug>"; the chunk of a life id comes from LIFE_CHUNKS. */\n` +
		`export const LIFE_LOADERS: Readonly<Record<string, Loader<{ LIVES: Readonly<Record<string, Life>> }>>> = ${loaders(files, new RegExp(`^${PREFIX}lives/([^/]+)\\.ts$`), (match) => match[1]!)};\n\n` +
		`/** Language slug to that language directory's phrases, Times labels, podobni and number rules. */\n` +
		`export const LANGUAGE_PACK_LOADERS: Readonly<Record<string, Loader<{ LANGUAGE_PACK: LanguagePackData }>>> = ${loaders(files, new RegExp(`^${PREFIX}language/([^.]+)\\.ts$`), slug)};\n\n` +
		`/** Language slug to that language directory's prayer and label texts. */\n` +
		`export const PRAYER_LOADERS: Readonly<Record<string, Loader<{ PRAYERS: Readonly<Record<string, PrayerText>> }>>> = ${loaders(files, new RegExp(`^${PREFIX}services/prayers\\.([^.]+)\\.ts$`), slug)};\n\n` +
		`/** Language slug to that language directory's Octoechos tables. */\n` +
		`export const OCTOECHOS_LOADERS: Readonly<Record<string, Loader<{ OCTOECHOS: Readonly<Record<string, readonly OctoechosEntry[]>> }>>> = ${loaders(files, new RegExp(`^${PREFIX}services/octoechos\\.([^.]+)\\.ts$`), slug)};\n`;
	return {
		path: `${PREFIX}registry.ts`,
		content: header("the generated day, life, language and service modules", 'import type { DayFile, FloatFile, LanguagePackData, Life, OctoechosEntry, PrayerText } from "../types.ts";') + body.replace(/\n\t"index": [^\n]*/, ""),
	};
}
