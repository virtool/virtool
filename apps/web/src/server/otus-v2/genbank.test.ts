import type {
	NcbiGenbank,
	NcbiSource,
	NcbiTaxonomy,
} from "@virtool/ncbi/models";
import { describe, expect, it } from "vitest";
import {
	buildGenbankOtuDraft,
	GenbankOtuEmptyError,
	GenbankOtuMixedTaxidError,
} from "./genbank";

function createSource(overrides: Partial<NcbiSource> = {}): NcbiSource {
	return {
		taxid: 12242,
		organism: "Tobacco mosaic virus",
		mol_type: "genomic RNA",
		isolate: null,
		host: null,
		segment: null,
		strain: null,
		clone: null,
		proviral: false,
		macronuclear: false,
		focus: false,
		transgenic: false,
		...overrides,
	};
}

function createRecord(overrides: Partial<NcbiGenbank> = {}): NcbiGenbank {
	return {
		accession: "NC_001367",
		accession_version: "NC_001367.1",
		strandedness: "single",
		moltype: "RNA",
		topology: "linear",
		definition: "Tobacco mosaic virus, complete genome",
		organism: "Tobacco mosaic virus",
		sequence: "ATCGATCG",
		source: createSource(),
		comment: "",
		refseq: true,
		...overrides,
	};
}

const taxonomy: NcbiTaxonomy = {
	id: 12242,
	name: "Tobacco mosaic virus",
	other_names: {
		acronym: ["TMV"],
		genbank_acronym: [],
		equivalent_name: [],
		synonym: [],
		includes: [],
	},
	lineage: [],
	rank: "species",
};

describe("buildGenbankOtuDraft", () => {
	it("derives one segment per record from a single record", () => {
		const draft = buildGenbankOtuDraft([createRecord()], taxonomy);

		expect(draft).toEqual({
			molecule: { type: "RNA", strandedness: "single", topology: "linear" },
			taxonomy: { name: "Tobacco mosaic virus", acronym: "TMV" },
			isolate: null,
			segments: [
				{
					name: null,
					definition: "Tobacco mosaic virus, complete genome",
					sequence: "ATCGATCG",
					length: 8,
					accession: "NC_001367.1",
				},
			],
		});
	});

	it("builds one multipartite OTU from several accessions", () => {
		const draft = buildGenbankOtuDraft(
			[
				createRecord({
					accession: "NC_003615",
					accession_version: "NC_003615.1",
					sequence: "ATCG",
					source: createSource({ segment: "RNA1", isolate: "Fny" }),
				}),
				createRecord({
					accession: "NC_003616",
					accession_version: "NC_003616.1",
					sequence: "GGCC",
					source: createSource({ segment: "RNA2", isolate: "Fny" }),
				}),
			],
			taxonomy,
		);

		expect(draft.isolate).toEqual({ type: "isolate", value: "Fny" });
		expect(draft.segments).toHaveLength(2);
		expect(draft.segments.map((segment) => segment.name)).toEqual([
			{ prefix: "Segment", key: "RNA1" },
			{ prefix: "Segment", key: "RNA2" },
		]);
	});

	it("falls back to the record organism without a taxonomy record", () => {
		const draft = buildGenbankOtuDraft([createRecord()], null);

		expect(draft.taxonomy).toEqual({
			name: "Tobacco mosaic virus",
			acronym: null,
		});
	});

	it("prefers strain then clone for the isolate name", () => {
		const strain = buildGenbankOtuDraft(
			[createRecord({ source: createSource({ strain: "U1" }) })],
			taxonomy,
		);
		expect(strain.isolate).toEqual({ type: "strain", value: "U1" });

		const clone = buildGenbankOtuDraft(
			[createRecord({ source: createSource({ clone: "c7" }) })],
			taxonomy,
		);
		expect(clone.isolate).toEqual({ type: "clone", value: "c7" });
	});

	it("rejects accessions from different organisms", () => {
		expect(() =>
			buildGenbankOtuDraft(
				[
					createRecord(),
					createRecord({ source: createSource({ taxid: 99999 }) }),
				],
				taxonomy,
			),
		).toThrow(GenbankOtuMixedTaxidError);
	});

	it("rejects an empty record list", () => {
		expect(() => buildGenbankOtuDraft([], taxonomy)).toThrow(
			GenbankOtuEmptyError,
		);
	});
});
