import { XMLParser } from "fast-xml-parser";
import { NcbiUnreadableError } from "./errors";

/**
 * NCBI's XML is data, not markup: every element is either a container or a
 * leaf holding a scalar, and no element carries an attribute this client
 * reads.
 *
 * `parseTagValue` is off so every leaf arrives as the string NCBI sent.
 * Letting the parser coerce would turn a `GBSeq_sequence` of all digits into a
 * number and a `TaxId` into an integer only when it happens to fit, which is
 * exactly the integer-versus-string ambiguity that has to be handled in one
 * deliberate place instead. The models coerce where a number is wanted.
 */
const parser = new XMLParser({
	ignoreAttributes: true,
	parseTagValue: false,
	trimValues: true,
});

/**
 * Parse an NCBI XML document.
 *
 * A body that is not XML at all reaches here as NCBI's HTML error page, which
 * `fast-xml-parser` will happily turn into an object rather than throwing, so
 * the caller checks for the document element it wants rather than trusting a
 * successful parse.
 */
export function parseXml(text: string): unknown {
	try {
		return parser.parse(text);
	} catch (err) {
		throw new NcbiUnreadableError("NCBI returned unparseable XML", {
			cause: err,
		});
	}
}

/**
 * Read a repeated element as an array.
 *
 * An XML element that occurs once parses to a bare value and the same element
 * occurring twice parses to an array, so every repeated element has to pass
 * through here. An absent element is an empty list rather than an error: NCBI
 * omits an empty container instead of sending one.
 */
export function toArray(value: unknown): unknown[] {
	if (value === undefined || value === null || value === "") {
		return [];
	}

	return Array.isArray(value) ? value : [value];
}

/** Read a child of an object, or `undefined` when the parent is not one. */
export function getChild(value: unknown, key: string): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}

	return (value as Record<string, unknown>)[key];
}

/**
 * Read an element expected to hold text.
 *
 * `parseTagValue: false` keeps every scalar a string, but an empty element
 * parses to `""` and a container parses to an object, so anything that is not
 * a string is reported as absent rather than stringified.
 */
export function getText(value: unknown, key: string): string | undefined {
	const child = getChild(value, key);

	return typeof child === "string" ? child : undefined;
}
