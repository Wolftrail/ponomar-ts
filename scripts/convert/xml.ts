// Build-time XML reader for the vendored Ponomar data. Not shipped in the package.
// Behavior reference: Ponomar/QDParser.java (entities, attribute whitespace normalization).

export interface XmlElement {
	readonly name: string;
	readonly attributes: Readonly<Record<string, string>>;
	readonly children: readonly XmlNode[];
}

export type XmlNode = XmlElement | string;

export class XmlError extends Error {
	override name = "XmlError";
	readonly line: number;
	readonly column: number;

	constructor(message: string, line: number, column: number) {
		super(`${message} (line ${line}, column ${column})`);
		this.line = line;
		this.column = column;
	}
}

export interface ParseOptions {
	/** Accept closing tags whose name differs from the open tag, as upstream does. Mismatches are reported through `warn`. */
	readonly lenient?: boolean;
	readonly warn?: (message: string) => void;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

/** Decodes file bytes, honouring a UTF-8 or UTF-16 byte-order mark. */
export function decodeXml(bytes: Uint8Array): string {
	if (bytes[0] === 0xff && bytes[1] === 0xfe) {
		return new TextDecoder("utf-16le", { fatal: true }).decode(bytes.subarray(2));
	}
	if (bytes[0] === 0xfe && bytes[1] === 0xff) {
		return new TextDecoder("utf-16be", { fatal: true }).decode(bytes.subarray(2));
	}
	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes).replace(/^\uFEFF/, "");
}

export function parseXml(source: string, options: ParseOptions = {}): XmlElement {
	return new Reader(source.replace(/\r\n?/g, "\n"), options).document();
}

class Reader {
	private readonly text: string;
	private readonly options: ParseOptions;
	private position = 0;

	constructor(text: string, options: ParseOptions) {
		this.text = text;
		this.options = options;
	}

	document(): XmlElement {
		this.skipMisc();
		if (this.text[this.position] !== "<") {
			throw this.fail("expected a root element");
		}
		const root = this.element();
		this.skipMisc();
		if (this.position < this.text.length) {
			throw this.fail("content after the root element");
		}
		return root;
	}

	private fail(message: string, at: number = this.position): XmlError {
		const before = this.text.slice(0, at);
		const line = before.split("\n").length;
		return new XmlError(message, line, at - before.lastIndexOf("\n"));
	}

	private startsWith(token: string): boolean {
		return this.text.startsWith(token, this.position);
	}

	private skipUntil(terminator: string, what: string): void {
		const end = this.text.indexOf(terminator, this.position);
		if (end === -1) {
			throw this.fail(`unterminated ${what}`);
		}
		this.position = end + terminator.length;
	}

	/** Whitespace, comments, processing instructions and DOCTYPE outside the root. */
	private skipMisc(): void {
		for (;;) {
			while (/\s/.test(this.text[this.position] ?? "x")) {
				this.position++;
			}
			if (this.startsWith("<!--")) {
				this.skipUntil("-->", "comment");
			} else if (this.startsWith("<?")) {
				this.skipUntil("?>", "processing instruction");
			} else if (this.startsWith("<!DOCTYPE")) {
				this.skipDoctype();
			} else {
				return;
			}
		}
	}

	private skipDoctype(): void {
		let depth = 0;
		while (this.position < this.text.length) {
			const ch = this.text[this.position++];
			if (ch === "[") {
				depth++;
			} else if (ch === "]") {
				depth--;
			} else if (ch === ">" && depth <= 0) {
				return;
			}
		}
		throw this.fail("unterminated DOCTYPE");
	}

	private name(): string {
		const match = /^[^\s/>=<"']+/.exec(this.text.slice(this.position, this.position + 200));
		if (!match) {
			throw this.fail("expected a name");
		}
		this.position += match[0].length;
		return match[0];
	}

	private skipSpace(): void {
		while (/\s/.test(this.text[this.position] ?? "x")) {
			this.position++;
		}
	}

	private entity(): string {
		const end = this.text.indexOf(";", this.position);
		if (end === -1 || end - this.position > 12) {
			throw this.fail("unterminated entity");
		}
		const body = this.text.slice(this.position + 1, end);
		let value: string | undefined = NAMED_ENTITIES[body];
		if (value === undefined && /^#\d+$/.test(body)) {
			value = String.fromCodePoint(Number(body.slice(1)));
		} else if (value === undefined && /^#x[0-9a-fA-F]+$/.test(body)) {
			value = String.fromCodePoint(parseInt(body.slice(2), 16));
		}
		if (value === undefined) {
			throw this.fail(`unknown entity &${body};`);
		}
		this.position = end + 1;
		return value;
	}

	private attributeValue(): string {
		const quote = this.text[this.position];
		if (quote !== '"' && quote !== "'") {
			throw this.fail("expected a quoted attribute value");
		}
		this.position++;
		let value = "";
		for (;;) {
			const ch = this.text[this.position];
			if (ch === undefined) {
				throw this.fail("unterminated attribute value");
			}
			if (ch === quote) {
				this.position++;
				return value;
			}
			if (ch === "&") {
				value += this.entity();
			} else {
				value += ch === "\n" || ch === "\t" ? " " : ch;
				this.position++;
			}
		}
	}

	private element(): XmlElement {
		const start = this.position;
		this.position++; // <
		const name = this.name();
		const attributes: Record<string, string> = {};
		for (;;) {
			this.skipSpace();
			const ch = this.text[this.position];
			if (ch === "/") {
				if (this.text[this.position + 1] !== ">") {
					throw this.fail(`expected > after / in <${name}>`);
				}
				this.position += 2;
				return { name, attributes, children: [] };
			}
			if (ch === ">") {
				this.position++;
				break;
			}
			if (ch === undefined) {
				throw this.fail(`unterminated tag <${name}>`, start);
			}
			const attribute = this.name();
			this.skipSpace();
			if (this.text[this.position] !== "=") {
				throw this.fail(`attribute ${attribute} has no value`);
			}
			this.position++;
			this.skipSpace();
			attributes[attribute] = this.attributeValue();
		}
		return { name, attributes, children: this.content(name, start) };
	}

	private content(name: string, start: number): XmlNode[] {
		const children: XmlNode[] = [];
		let text = "";
		const flush = (): void => {
			if (text !== "") {
				children.push(text);
				text = "";
			}
		};
		for (;;) {
			const ch = this.text[this.position];
			if (ch === undefined) {
				throw this.fail(`<${name}> is never closed`, start);
			}
			if (ch === "&") {
				text += this.entity();
			} else if (ch !== "<") {
				text += ch;
				this.position++;
			} else if (this.startsWith("<!--")) {
				this.skipUntil("-->", "comment");
			} else if (this.startsWith("<![CDATA[")) {
				this.position += 9;
				const end = this.text.indexOf("]]>", this.position);
				if (end === -1) {
					throw this.fail("unterminated CDATA");
				}
				text += this.text.slice(this.position, end);
				this.position = end + 3;
			} else if (this.startsWith("<?")) {
				this.skipUntil("?>", "processing instruction");
			} else if (this.startsWith("</")) {
				const closeAt = this.position;
				this.position += 2;
				const closing = this.name();
				this.skipSpace();
				if (this.text[this.position] !== ">") {
					throw this.fail(`malformed closing tag </${closing}`);
				}
				this.position++;
				if (closing !== name) {
					const message = `</${closing}> closes <${name}>`;
					if (!this.options.lenient) {
						throw this.fail(message, closeAt);
					}
					this.options.warn?.(`${message} (line ${this.fail("", closeAt).line})`);
				}
				flush();
				return children;
			} else {
				flush();
				children.push(this.element());
			}
		}
	}
}

export function childElements(element: XmlElement, name?: string): XmlElement[] {
	return element.children.filter((child): child is XmlElement => typeof child !== "string" && (name === undefined || child.name === name));
}

export function textContent(element: XmlElement): string {
	return element.children.map((child) => (typeof child === "string" ? child : textContent(child))).join("");
}
