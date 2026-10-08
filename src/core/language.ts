// The upstream language fallback chain (Ponomar/Helpers.langFileFind).

/** Language directories searched for a file, most specific first: "cu/ru" -> ["cu/ru", "cu", ""]. */
export function languageChain(language: string): string[] {
	const chain: string[] = [];
	let current = language.replace(/\/+$/, "");
	while (current !== "") {
		chain.push(current);
		const slash = current.lastIndexOf("/");
		current = slash === -1 ? "" : current.slice(0, slash);
	}
	chain.push("");
	return chain;
}

/** A language as a module-name segment: "cu/ru" -> "cu-ru", "" -> "base". */
export function languageSlug(language: string): string {
	return language === "" ? "base" : language.replaceAll("/", "-");
}
