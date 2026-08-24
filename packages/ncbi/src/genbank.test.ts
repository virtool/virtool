/**
 * Tests for the NCBI irregularities the recorded fixtures do not happen to
 * contain — bare flag qualifiers, a missing source table, a record NCBI sends
 * with a `mol_type` outside the controlled vocabulary, and an error page
 * returned with a 200.
 */

import { describe, expect, it } from "vitest";
import { NcbiUnreadableError } from "./errors";
import { parseGenbankSet } from "./genbank";

/** Build a `GBSet` around one `GBSeq` body. */
function gbSet(...seqs: string[]): string {
	return `<?xml version="1.0"?><GBSet>${seqs.join("")}</GBSet>`;
}

function qualifier(name: string, value?: string): string {
	return `<GBQualifier><GBQualifier_name>${name}</GBQualifier_name>${
		value === undefined ? "" : `<GBQualifier_value>${value}</GBQualifier_value>`
	}</GBQualifier>`;
}

function gbSeq({
	accession = "AB000048",
	moltype = "RNA",
	organism = "Test virus",
	sequence = "atcg",
	quals = [
		qualifier("organism", "Test virus"),
		qualifier("mol_type", "genomic RNA"),
		qualifier("db_xref", "taxon:12242"),
	],
	featureKey = "source",
	comment,
}: {
	accession?: string;
	moltype?: string;
	organism?: string;
	sequence?: string;
	quals?: string[];
	featureKey?: string;
	comment?: string;
} = {}): string {
	return `<GBSeq>
		<GBSeq_strandedness>single</GBSeq_strandedness>
		<GBSeq_moltype>${moltype}</GBSeq_moltype>
		<GBSeq_topology>linear</GBSeq_topology>
		<GBSeq_definition>A test record</GBSeq_definition>
		<GBSeq_primary-accession>${accession}</GBSeq_primary-accession>
		<GBSeq_accession-version>${accession}.1</GBSeq_accession-version>
		<GBSeq_organism>${organism}</GBSeq_organism>
		${comment === undefined ? "" : `<GBSeq_comment>${comment}</GBSeq_comment>`}
		<GBSeq_feature-table><GBFeature>
			<GBFeature_key>${featureKey}</GBFeature_key>
			<GBFeature_quals>${quals.join("")}</GBFeature_quals>
		</GBFeature></GBSeq_feature-table>
		<GBSeq_sequence>${sequence}</GBSeq_sequence>
	</GBSeq>`;
}

describe("parseGenbankSet()", () => {
	it("reads a taxid out of db_xref", () => {
		const [record] = parseGenbankSet(gbSet(gbSeq()));

		expect(record?.source.taxid).toBe(12242);
	});

	it("upper-cases the sequence", () => {
		const [record] = parseGenbankSet(gbSet(gbSeq({ sequence: "atcgn" })));

		expect(record?.sequence).toBe("ATCGN");
	});

	it("marks an NC_ accession as refseq", () => {
		const [record] = parseGenbankSet(gbSet(gbSeq({ accession: "NC_004452" })));

		expect(record?.refseq).toBe(true);
	});

	it("defaults an absent comment to an empty string", () => {
		const [record] = parseGenbankSet(gbSet(gbSeq()));

		expect(record?.comment).toBe("");
	});

	it("reads a qualifier written bare as a flag", () => {
		const [record] = parseGenbankSet(
			gbSet(
				gbSeq({
					quals: [
						qualifier("organism", "Test virus"),
						qualifier("mol_type", "genomic RNA"),
						qualifier("db_xref", "taxon:12242"),
						qualifier("proviral"),
					],
				}),
			),
		);

		expect(record?.source.proviral).toBe(true);
		expect(record?.source.transgenic).toBe(false);
	});

	it("keeps absent optional qualifiers null", () => {
		const [record] = parseGenbankSet(gbSet(gbSeq()));

		expect(record?.source.isolate).toBeNull();
		expect(record?.source.host).toBeNull();
		expect(record?.source.segment).toBeNull();
	});

	it("keeps the first of a repeated qualifier", () => {
		const [record] = parseGenbankSet(
			gbSet(
				gbSeq({
					quals: [
						qualifier("organism", "Test virus"),
						qualifier("mol_type", "genomic RNA"),
						qualifier("db_xref", "taxon:12242"),
						qualifier("host", "Nicotiana"),
						qualifier("host", "Solanum"),
					],
				}),
			),
		);

		expect(record?.source.host).toBe("Nicotiana");
	});

	it("reads a set carrying one record and a set carrying several alike", () => {
		expect(parseGenbankSet(gbSet(gbSeq()))).toHaveLength(1);
		expect(
			parseGenbankSet(
				gbSet(
					gbSeq({ accession: "AB000048" }),
					gbSeq({ accession: "AB000049" }),
				),
			),
		).toHaveLength(2);
	});

	it("sorts nothing and preserves NCBI's order", () => {
		const records = parseGenbankSet(
			gbSet(gbSeq({ accession: "ZZ000001" }), gbSeq({ accession: "AA000001" })),
		);

		expect(records.map((record) => record.accession)).toEqual([
			"ZZ000001",
			"AA000001",
		]);
	});

	describe("rejects a record", () => {
		it.each([
			[
				"whose source table is missing",
				gbSeq({ featureKey: "CDS" }),
				/no source table/,
			],
			[
				"whose mol_type is outside the vocabulary",
				gbSeq({
					quals: [
						qualifier("organism", "Test virus"),
						qualifier("mol_type", "protein"),
						qualifier("db_xref", "taxon:12242"),
					],
				}),
				/mol_type/,
			],
			[
				"carrying no taxid at all",
				gbSeq({
					quals: [
						qualifier("organism", "Test virus"),
						qualifier("mol_type", "genomic RNA"),
					],
				}),
				/taxid/,
			],
			[
				"whose organism disagrees with its source",
				gbSeq({ organism: "Other virus" }),
				/Non-matching organism/,
			],
			[
				"whose sequence carries a non-IUPAC character",
				gbSeq({ sequence: "atcgz" }),
				/sequence/,
			],
		])("%s", (_, seq, pattern) => {
			const rejected: string[] = [];

			const records = parseGenbankSet(gbSet(seq), (err) =>
				rejected.push(err.message),
			);

			expect(records).toEqual([]);
			expect(rejected).toHaveLength(1);
			expect(rejected[0]).toMatch(pattern);
		});
	});

	it("keeps the readable records of a batch that carries an unreadable one", () => {
		const rejected: string[] = [];

		const records = parseGenbankSet(
			gbSet(gbSeq({ accession: "AB000048" }), gbSeq({ featureKey: "CDS" })),
			(err) => rejected.push(err.message),
		);

		expect(records.map((record) => record.accession)).toEqual(["AB000048"]);
		expect(rejected).toHaveLength(1);
	});

	it("throws when the response is not a GBSet", () => {
		// NCBI answers some refusals with an HTML page and a 200 status, which
		// parses without error but carries no GBSet.
		expect(() => parseGenbankSet("<html><body>Error</body></html>")).toThrow(
			NcbiUnreadableError,
		);
	});

	it("returns nothing for an empty GBSet", () => {
		expect(parseGenbankSet(gbSet())).toEqual([]);
	});
});
