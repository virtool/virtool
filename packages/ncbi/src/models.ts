import { z } from "zod";
import { isRefSeq } from "./accession";

/** The NCBI databases this client reads. */
export const NcbiDatabase = {
	Nuccore: "nuccore",
	Taxonomy: "taxonomy",
} as const;

/** One of the NCBI databases this client reads. */
export type NcbiDatabase = (typeof NcbiDatabase)[keyof typeof NcbiDatabase];

/** The strandedness of a molecule. */
export const strandednessSchema = z.enum(["single", "double"]);

/** The strandedness of a molecule, either single or double. */
export type Strandedness = z.infer<typeof strandednessSchema>;

/** The topology of a molecule. */
export const topologySchema = z.enum(["linear", "circular"]);

/** The topology of a molecule, either linear or circular. */
export type Topology = z.infer<typeof topologySchema>;

/** The in vivo molecule type of a sequence, as GenBank's `moltype` field. */
export const moleculeTypeSchema = z.enum([
	"cRNA",
	"DNA",
	"mRNA",
	"RNA",
	"tRNA",
]);

/** The in vivo molecule type of a sequence. */
export type MoleculeType = z.infer<typeof moleculeTypeSchema>;

/**
 * The INSDC controlled vocabulary for the `/mol_type` source qualifier.
 *
 * `unassigned RNA` is a historical value that only appears on older records.
 *
 * @see https://www.insdc.org/submitting-standards/controlled-vocabulary-moltype-qualifier/
 */
export const sourceMolTypeSchema = z.enum([
	"genomic DNA",
	"other DNA",
	"unassigned DNA",
	"genomic RNA",
	"mRNA",
	"tRNA",
	"transcribed RNA",
	"viral cRNA",
	"other RNA",
	"unassigned RNA",
]);

/** An in vivo molecule type as it appears in a `source` feature. */
export type SourceMolType = z.infer<typeof sourceMolTypeSchema>;

/**
 * A qualifier that is present with no value is `true`.
 *
 * GenBank writes flag qualifiers such as `/proviral` bare, so the XML carries a
 * `GBQualifier_name` with no `GBQualifier_value` beside it. The parser turns
 * those into `true`, and everything else stays the string NCBI sent.
 */
const flagSchema = z
	.union([z.boolean(), z.string()])
	.transform((value) => value !== false && value !== "")
	.default(false);

/**
 * Read a taxid out of a source table.
 *
 * The `source` feature carries no taxid field of its own — it is the numeric
 * half of a `db_xref` qualifier reading `taxon:12242`. A `taxid` supplied
 * directly wins, which is what lets a caller build a source table by hand.
 */
const taxidSchema = z.coerce.number().int().positive();

/** An optional free-text source qualifier, absent when NCBI omitted it. */
const optionalTextSchema = z
	.string()
	.nullish()
	.transform((value) => value ?? null);

/** An NCBI source table. */
export const ncbiSourceSchema = z
	.object({
		taxid: z.unknown().optional(),
		db_xref: z.string().optional(),
		organism: z.string(),
		mol_type: sourceMolTypeSchema,
		isolate: optionalTextSchema,
		host: optionalTextSchema,
		segment: optionalTextSchema,
		strain: optionalTextSchema,
		clone: optionalTextSchema,
		proviral: flagSchema,
		macronuclear: flagSchema,
		focus: flagSchema,
		transgenic: flagSchema,
	})
	.transform((source, ctx) => {
		const raw =
			source.taxid ??
			(source.db_xref === undefined ? undefined : source.db_xref.split(":")[1]);

		const parsed = taxidSchema.safeParse(raw);

		if (!parsed.success) {
			ctx.addIssue({
				code: "custom",
				message: "No db_xref or taxid value found in source table",
			});

			return z.NEVER;
		}

		const { db_xref: _dbXref, ...rest } = source;

		return { ...rest, taxid: parsed.data };
	});

/** An NCBI source table, as read from a record's `source` feature. */
export type NcbiSource = z.infer<typeof ncbiSourceSchema>;

/**
 * A nucleotide sequence.
 *
 * The IUPAC ambiguity codes are all accepted, and the value is upper-cased —
 * GenBank writes sequences in lower case.
 */
const sequenceSchema = z
	.string()
	.regex(/^[ATCGRYKMSWBDHVNatcgrykmswbdhvn]+$/)
	.transform((value) => value.toUpperCase());

/** An NCBI GenBank record, reduced to the fields Virtool reads. */
export const ncbiGenbankSchema = z
	.object({
		accession: z.string().min(1),
		accession_version: z.string().min(1),
		strandedness: strandednessSchema,
		moltype: moleculeTypeSchema,
		topology: topologySchema,
		definition: z.string(),
		organism: z.string(),
		sequence: sequenceSchema,
		source: ncbiSourceSchema,
		comment: z.string().default(""),
	})
	.refine((record) => record.source.organism === record.organism, {
		message: "Non-matching organism fields on record and source",
		path: ["organism"],
	})
	.transform((record) => ({
		...record,
		/** Whether this is a RefSeq record. */
		refseq: isRefSeq(record.accession),
	}));

/** An NCBI GenBank record. */
export type NcbiGenbank = z.infer<typeof ncbiGenbankSchema>;

/** One taxon in an NCBI lineage. */
export const ncbiLineageSchema = z.object({
	id: z.coerce.number().int().positive(),
	name: z.string(),
	rank: z.string(),
});

/** One taxon in an NCBI lineage. */
export type NcbiLineage = z.infer<typeof ncbiLineageSchema>;

/** The alternate names NCBI holds for a taxon. */
export const ncbiTaxonomyOtherNamesSchema = z.object({
	acronym: z.array(z.string()).default([]),
	genbank_acronym: z.array(z.string()).default([]),
	equivalent_name: z.array(z.string()).default([]),
	synonym: z.array(z.string()).default([]),
	includes: z.array(z.string()).default([]),
});

/** The alternate names NCBI holds for a taxon. */
export type NcbiTaxonomyOtherNames = z.infer<
	typeof ncbiTaxonomyOtherNamesSchema
>;

/**
 * An NCBI taxonomy record.
 *
 * **`rank` is a plain string, not a closed set.** ref-builder rejects any taxon
 * above species at validation time, because an OTU must be species-or-below.
 * That is a reference-building policy, not a property of the record, and this
 * client is also used to validate an arbitrary taxid a user has typed. Callers
 * that need the ref-builder rule apply it through {@link getSpecies}, which
 * returns `null` rather than throwing.
 */
export const ncbiTaxonomySchema = z.object({
	id: z.coerce.number().int().positive(),
	name: z.string(),
	other_names: ncbiTaxonomyOtherNamesSchema.default({
		acronym: [],
		genbank_acronym: [],
		equivalent_name: [],
		synonym: [],
		includes: [],
	}),
	lineage: z.array(ncbiLineageSchema),
	rank: z.string(),
});

/** An NCBI taxonomy record. */
export type NcbiTaxonomy = z.infer<typeof ncbiTaxonomySchema>;

/** The ranks that describe a taxon an OTU may be built from. */
export const SUBSPECIFIC_RANKS: ReadonlySet<string> = new Set([
	"no rank",
	"isolate",
]);

/**
 * The species-level taxon for a record, or `null` when it has none.
 *
 * A record that is itself a species answers with itself; anything below one
 * finds the species in its lineage. A taxon above species has no species to
 * find, which is what makes it unusable as an OTU.
 */
export function getSpecies(taxonomy: NcbiTaxonomy): NcbiLineage | null {
	if (taxonomy.rank === "species") {
		return { id: taxonomy.id, name: taxonomy.name, rank: taxonomy.rank };
	}

	return taxonomy.lineage.find((taxon) => taxon.rank === "species") ?? null;
}
