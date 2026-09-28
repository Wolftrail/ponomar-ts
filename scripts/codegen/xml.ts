// Codegen-only. This is a tolerant XML parser sufficient for the Ponomar
// upstream files: attribute-only elements, self-closing and paired tags,
// comments, character references, and CDATA. It is not a general-purpose
// XML parser (no DTD, no namespaces, no processing instructions beyond
// skipping `<?xml ... ?>`).

export interface Element {
	readonly tag: string;
	readonly attrs: Readonly<Record<string, string>>;
	readonly children: readonly Node[];
}

export type Node =
	| { readonly kind: "element"; readonly element: Element }
	| { readonly kind: "text"; readonly text: string };

export class XmlError extends Error {
	readonly pos: number;
	constructor(message: string, pos: number) {
		super(`${message} at offset ${pos}`);
		this.name = "XmlError";
		this.pos = pos;
	}
}

const ENTITIES: Readonly<Record<string, string>> = {
	lt: "<",
	gt: ">",
	amp: "&",
	quot: '"',
	apos: "'",
};

export function parseXml(source: string): Element {
	const p = new Parser(source);
	p.skipProlog();
	const root = p.readElement();
	p.skipTrailing();
	if (!p.eof()) {
		throw new XmlError("Trailing content after root element", p.pos);
	}
	return root;
}

class Parser {
	pos = 0;
	private readonly src: string;
	constructor(src: string) {
		this.src = src;
	}

	eof(): boolean {
		return this.pos >= this.src.length;
	}

	skipProlog(): void {
		this.skipWs();
		while (this.peek(2) === "<?" || this.peek(4) === "<!--" || this.peek(2) === "<!") {
			if (this.peek(2) === "<?") {
				const end = this.src.indexOf("?>", this.pos + 2);
				if (end < 0) throw new XmlError("Unterminated processing instruction", this.pos);
				this.pos = end + 2;
			} else if (this.peek(4) === "<!--") {
				this.skipComment();
			} else if (this.peek(9) === "<!DOCTYPE") {
				// Skip a DOCTYPE by finding the matching `>` (no internal subset support).
				const end = this.src.indexOf(">", this.pos);
				if (end < 0) throw new XmlError("Unterminated DOCTYPE", this.pos);
				this.pos = end + 1;
			} else {
				throw new XmlError("Unsupported markup declaration", this.pos);
			}
			this.skipWs();
		}
	}

	skipTrailing(): void {
		while (!this.eof()) {
			this.skipWs();
			if (this.peek(4) === "<!--") {
				this.skipComment();
				continue;
			}
			break;
		}
	}

	skipWs(): void {
		while (this.pos < this.src.length) {
			const c = this.src[this.pos];
			if (c === " " || c === "\t" || c === "\n" || c === "\r") this.pos++;
			else break;
		}
	}

	skipComment(): void {
		const end = this.src.indexOf("-->", this.pos + 4);
		if (end < 0) throw new XmlError("Unterminated comment", this.pos);
		this.pos = end + 3;
	}

	peek(n: number): string {
		return this.src.slice(this.pos, this.pos + n);
	}

	readElement(): Element {
		if (this.src[this.pos] !== "<") {
			throw new XmlError("Expected element start", this.pos);
		}
		this.pos++;
		const tag = this.readName();
		const attrs: Record<string, string> = {};
		while (true) {
			this.skipWs();
			const c = this.src[this.pos];
			if (c === "/" || c === ">") break;
			const name = this.readName();
			this.skipWs();
			if (this.src[this.pos] !== "=") {
				throw new XmlError(`Attribute ${JSON.stringify(name)} missing '='`, this.pos);
			}
			this.pos++;
			this.skipWs();
			attrs[name] = this.readAttrValue();
		}
		if (this.src[this.pos] === "/") {
			this.pos++;
			if (this.src[this.pos] !== ">") throw new XmlError("Expected '>'", this.pos);
			this.pos++;
			return { tag, attrs, children: [] };
		}
		// this.src[this.pos] === ">"
		this.pos++;
		const children = this.readChildren(tag);
		return { tag, attrs, children };
	}

	readChildren(parentTag: string): Node[] {
		const children: Node[] = [];
		while (true) {
			if (this.peek(4) === "<!--") {
				this.skipComment();
				continue;
			}
			if (this.peek(9) === "<![CDATA[") {
				const end = this.src.indexOf("]]>", this.pos + 9);
				if (end < 0) throw new XmlError("Unterminated CDATA", this.pos);
				const text = this.src.slice(this.pos + 9, end);
				this.pos = end + 3;
				children.push({ kind: "text", text });
				continue;
			}
			if (this.peek(2) === "</") {
				this.pos += 2;
				const name = this.readName();
				this.skipWs();
				if (this.src[this.pos] !== ">") throw new XmlError("Expected '>'", this.pos);
				this.pos++;
				if (name !== parentTag) {
					throw new XmlError(
						`Mismatched closing tag: expected </${parentTag}>, got </${name}>`,
						this.pos,
					);
				}
				return children;
			}
			if (this.src[this.pos] === "<") {
				const el = this.readElement();
				children.push({ kind: "element", element: el });
				continue;
			}
			// Text run until next '<'.
			const start = this.pos;
			while (this.pos < this.src.length && this.src[this.pos] !== "<") {
				this.pos++;
			}
			if (this.pos === start) {
				throw new XmlError(`Unexpected end of input inside <${parentTag}>`, this.pos);
			}
			children.push({ kind: "text", text: decodeText(this.src.slice(start, this.pos)) });
		}
	}

	readName(): string {
		const start = this.pos;
		while (this.pos < this.src.length) {
			const c = this.src[this.pos] as string;
			if (isNameChar(c)) this.pos++;
			else break;
		}
		if (this.pos === start) throw new XmlError("Expected name", this.pos);
		return this.src.slice(start, this.pos);
	}

	readAttrValue(): string {
		const q = this.src[this.pos];
		if (q !== '"' && q !== "'") throw new XmlError("Expected quoted attribute value", this.pos);
		this.pos++;
		const start = this.pos;
		while (this.pos < this.src.length && this.src[this.pos] !== q) this.pos++;
		if (this.pos >= this.src.length) throw new XmlError("Unterminated attribute value", this.pos);
		const raw = this.src.slice(start, this.pos);
		this.pos++;
		return decodeText(raw);
	}
}

function isNameChar(c: string): boolean {
	return (
		(c >= "a" && c <= "z") ||
		(c >= "A" && c <= "Z") ||
		(c >= "0" && c <= "9") ||
		c === "_" ||
		c === ":" ||
		c === "-" ||
		c === "."
	);
}

function decodeText(s: string): string {
	if (!s.includes("&")) return s;
	return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (_m, ref: string) => {
		if (ref.startsWith("#x")) return String.fromCodePoint(parseInt(ref.slice(2), 16));
		if (ref.startsWith("#")) return String.fromCodePoint(parseInt(ref.slice(1), 10));
		const v = ENTITIES[ref];
		if (v === undefined) throw new XmlError(`Unknown entity &${ref};`, 0);
		return v;
	});
}

// Convenience: yield only element children of an element.
export function elementChildren(el: Element): Element[] {
	const out: Element[] = [];
	for (const c of el.children) {
		if (c.kind === "element") out.push(c.element);
	}
	return out;
}
