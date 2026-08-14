import type { Genbank } from "@virtool/contracts";
import type { Logger } from "@virtool/logger";
import { AppError } from "../errors";
import { USER_AGENT } from "../userAgent";

const FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

// NCBI asks automated callers to identify themselves; unidentified traffic is
// throttled harder and can be blocked outright.
const EMAIL = "dev@virtool.ca";
const TOOL = "virtool";

// A non-200 body is normally a one-line NCBI error, but a proxy or outage page
// in front of it can be arbitrarily large. Cap what reaches the log.
const MAX_LOGGED_BODY = 500;

// NCBI is a third party on the far side of the internet. Without a deadline a
// hung connection holds the server function open until the client gives up.
const TIMEOUT_MS = 10_000;

/** Thrown when NCBI could not be reached at all. */
export class GenbankUnreachableError extends AppError {}

type Sections = {
	features: string[];
	header: string[];
	origin: string[];
};

/**
 * Split a flat file into its header, feature table, and sequence regions.
 *
 * Top-level keywords start at column 0; everything belonging to them is
 * indented.
 */
function splitSections(lines: string[]): Sections {
	const features: string[] = [];
	const header: string[] = [];
	const origin: string[] = [];

	let section = header;

	for (const line of lines) {
		if (line.startsWith("//")) {
			break;
		}

		if (/^\S/.test(line)) {
			const keyword = line.slice(0, 12).trim();

			if (keyword === "FEATURES") {
				section = features;
				continue;
			}

			if (keyword === "ORIGIN") {
				section = origin;
				continue;
			}

			// A top-level keyword such as BASE COUNT or CONTIG closes the feature
			// table without opening the sequence.
			if (section === features) {
				section = header;
			}
		}

		section.push(line);
	}

	return { features, header, origin };
}

/**
 * Collect header field values by keyword, with each field's continuation lines
 * kept as separate chunks.
 *
 * Indented sub-keywords (ORGANISM, AUTHORS) are folded into their enclosing
 * field, which is harmless because no field read here has any.
 */
function parseHeader(lines: string[]): Map<string, string[]> {
	const fields = new Map<string, string[]>();

	let keyword = "";

	for (const line of lines) {
		if (/^\S/.test(line)) {
			keyword = line.slice(0, 12).trim();

			const value = line.slice(12).trim();

			fields.set(keyword, value ? [value] : []);

			continue;
		}

		if (keyword) {
			const value = line.trim();

			if (value) {
				fields.get(keyword)?.push(value);
			}
		}
	}

	return fields;
}

function firstToken(chunks: string[] | undefined): string {
	return chunks?.[0]?.split(/\s+/)[0] ?? "";
}

/**
 * True when `text` ends in a quote that closes a value rather than one half of
 * a doubled `""` escape.
 */
function isTerminated(text: string): boolean {
	let quotes = 0;

	for (let i = text.length - 1; i >= 0 && text[i] === '"'; i--) {
		quotes++;
	}

	return quotes % 2 === 1;
}

function joinQualifier(chunks: string[], quoted: boolean): string {
	const value = chunks.join(" ");

	return quoted ? value.replaceAll('""', '"') : value;
}

/**
 * Read the `/host` qualifier of the last `source` feature.
 *
 * Feature keys occupy columns 5-20 and qualifiers start at column 21, so a line
 * with anything in its first 21 characters opens a new feature.
 */
function parseHost(lines: string[]): string {
	let host = "";
	let inSource = false;
	let qualifier = "";
	let chunks: string[] = [];
	let quoted = false;
	let open = false;

	function commit() {
		if (inSource && qualifier === "host") {
			host = joinQualifier(chunks, quoted);
		}

		qualifier = "";
		chunks = [];
		quoted = false;
		open = false;
	}

	for (const line of lines) {
		if (line.slice(0, 21).trim()) {
			commit();

			inSource = line.slice(5, 21).trim() === "source";

			// Python reads every `source` feature in turn and falls back to "" when
			// one carries no /host, so a later hostless source clears an earlier
			// host rather than leaving it standing.
			if (inSource) {
				host = "";
			}

			continue;
		}

		const text = line.slice(21).trim();

		if (!text) {
			continue;
		}

		if (!open && text.startsWith("/")) {
			commit();

			const separator = text.indexOf("=");

			if (separator === -1) {
				qualifier = text.slice(1);

				continue;
			}

			qualifier = text.slice(1, separator);

			const value = text.slice(separator + 1);

			if (!value.startsWith('"')) {
				chunks.push(value);

				continue;
			}

			quoted = true;

			const body = value.slice(1);

			open = !isTerminated(body);

			chunks.push(open ? body : body.slice(0, -1));

			continue;
		}

		if (open) {
			open = !isTerminated(text);

			chunks.push(open ? text : text.slice(0, -1));
		}
	}

	commit();

	return host;
}

/**
 * Parse a GenBank flat file the way BioPython's `Bio.SeqIO.read(..., "gb")`
 * does for the four fields Virtool reads.
 */
function parseGenbank(text: string): Genbank {
	const { features, header, origin } = splitSections(text.split(/\r?\n/));

	const fields = parseHeader(header);

	// BioPython's `record.id` is the VERSION value, falling back to ACCESSION
	// and then to the LOCUS name.
	const accession =
		firstToken(fields.get("VERSION")) ||
		firstToken(fields.get("ACCESSION")) ||
		firstToken(fields.get("LOCUS"));

	if (!accession) {
		throw new Error("Could not parse GenBank record");
	}

	const definition = (fields.get("DEFINITION") ?? [])
		.join(" ")
		.replace(/\s+/g, " ")
		.trim()
		// BioPython's `record.description` drops a single trailing period.
		.replace(/\.$/, "");

	return {
		accession,
		definition,
		host: parseHost(features),
		// ORIGIN is conventionally lower case; BioPython upper-cases it.
		sequence: origin
			.join("")
			.replace(/[\s\d]/g, "")
			.toUpperCase(),
	};
}

/**
 * Fetch a GenBank record from NCBI.
 *
 * Returns `null` when NCBI has no such accession, and throws
 * `GenbankUnreachableError` when NCBI could not be reached.
 */
export async function getGenbank(
	logger: Logger,
	accession: string,
): Promise<Genbank | null> {
	const url = new URL(FETCH_URL);

	url.search = new URLSearchParams({
		db: "nuccore",
		email: EMAIL,
		id: accession,
		retmode: "text",
		rettype: "gb",
		tool: TOOL,
	}).toString();

	let response: Response;

	try {
		response = await fetch(url, {
			headers: { "User-Agent": USER_AGENT },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (err) {
		// A timeout arrives here too, and means the same thing to the caller as a
		// refused connection: NCBI did not answer.
		logger.warn({ accession, err }, "could not reach ncbi");

		throw new GenbankUnreachableError("Could not reach NCBI");
	}

	const body = await response.text();

	if (response.status !== 200) {
		// NCBI answers an unknown accession with this phrase, which is an expected
		// miss rather than a fault. Anything else is worth seeing.
		if (!body.includes("Failed to retrieve sequence")) {
			logger.warn(
				{
					accession,
					body: body.slice(0, MAX_LOGGED_BODY),
					status: response.status,
				},
				"unexpected genbank error",
			);
		}

		return null;
	}

	return parseGenbank(body);
}
