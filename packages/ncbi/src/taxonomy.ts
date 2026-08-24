import { NcbiUnreadableError } from "./errors";
import { type NcbiTaxonomy, ncbiTaxonomySchema } from "./models";
import { getChild, getText, parseXml, toArray } from "./xml";

/**
 * The `OtherNames` keys this client reads, mapped from NCBI's element names.
 *
 * NCBI sends many more — `Misspelling`, `Teleomorph`, `Anamorph` — and they are
 * deliberately dropped rather than carried as unknown keys.
 */
const OTHER_NAME_KEYS = {
	Acronym: "acronym",
	GenbankAcronym: "genbank_acronym",
	EquivalentName: "equivalent_name",
	Synonym: "synonym",
	Includes: "includes",
} as const;

/**
 * Read the `OtherNames` container.
 *
 * Every key is a repeated element, so a taxon with one acronym and a taxon
 * with three differ in parsed shape and both have to become lists.
 */
function readOtherNames(taxon: unknown): Record<string, string[]> {
	const container = getChild(taxon, "OtherNames");

	const names: Record<string, string[]> = {};

	for (const [element, key] of Object.entries(OTHER_NAME_KEYS)) {
		names[key] = toArray(getChild(container, element)).filter(
			(value): value is string => typeof value === "string",
		);
	}

	return names;
}

/** Read the `LineageEx` container into the ordered lineage. */
function readLineage(taxon: unknown): unknown[] {
	return toArray(getChild(getChild(taxon, "LineageEx"), "Taxon")).map(
		(item) => ({
			id: getText(item, "TaxId"),
			name: getText(item, "ScientificName"),
			rank: getText(item, "Rank"),
		}),
	);
}

/** Project one `Taxon` element onto the taxonomy model. */
function readTaxon(taxon: unknown): NcbiTaxonomy {
	const parsed = ncbiTaxonomySchema.safeParse({
		id: getText(taxon, "TaxId"),
		name: getText(taxon, "ScientificName"),
		other_names: readOtherNames(taxon),
		lineage: readLineage(taxon),
		rank: getText(taxon, "Rank"),
	});

	if (!parsed.success) {
		throw new NcbiUnreadableError(
			`Could not read taxonomy record ${getText(taxon, "TaxId") ?? "?"}: ${parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "record"} ${issue.message}`)
				.join("; ")}`,
			{ cause: parsed.error },
		);
	}

	return parsed.data;
}

/**
 * Parse a `TaxaSet` document into taxonomy records.
 *
 * A fetch names one taxid and NCBI answers with an empty body for one it does
 * not hold, which parses to a document with no `TaxaSet` and yields no
 * records rather than throwing.
 */
export function parseTaxaSet(text: string): NcbiTaxonomy[] {
	const set = getChild(parseXml(text), "TaxaSet");

	if (set === undefined) {
		return [];
	}

	return toArray(getChild(set, "Taxon")).map(readTaxon);
}
