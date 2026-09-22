import type {
	CreateLocalOtuCommand,
	CreateLocalOtuIsolateCommand,
	LocalOtuV2,
} from "@virtool/contracts";
import type {
	NcbiGenbank,
	NcbiSource,
	NcbiTaxonomy,
} from "@virtool/ncbi/models";
import { describe, expect, it } from "vitest";
import { buildCreateOtuCommandFromDraft } from "../../otus-v2/command";
import {
	buildGenbankIsolateDraft,
	buildGenbankOtuDraft,
	buildPromotionPreview,
	GenbankMixedIsolateError,
	GenbankOtuEmptyError,
	GenbankOtuMixedTaxidError,
	GenbankProvenanceError,
	GenbankSegmentError,
	GenbankTaxonomyError,
	validateGenbankIsolateSave,
	validateGenbankOtuSave,
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
		secondary_accessions: [],
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
			taxonomy: {
				name: "Tobacco mosaic virus",
				acronym: "TMV",
				lineage: [{ id: 12242, name: "Tobacco mosaic virus", rank: "species" }],
			},
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
			{ prefix: "RNA", key: "1" },
			{ prefix: "RNA", key: "2" },
		]);
	});

	it("rejects duplicate normalized segments in an initial draft", () => {
		const records = [
			createRecord({ source: createSource({ segment: "RNA1" }) }),
			createRecord({
				accession_version: "NC_001368.1",
				source: createSource({ segment: "RNA 1" }),
			}),
		];
		expect(() => buildGenbankOtuDraft(records, taxonomy)).toThrow(
			GenbankSegmentError,
		);
	});

	it("requires names for every segment in a multipartite draft", () => {
		const records = [
			createRecord({ source: createSource({ segment: "RNA1" }) }),
			createRecord({ accession_version: "NC_001368.1" }),
		];
		expect(() => buildGenbankOtuDraft(records, taxonomy)).toThrow(
			GenbankSegmentError,
		);
	});

	it("rejects a draft without verifiable taxonomy", () => {
		expect(() => buildGenbankOtuDraft([createRecord()], null)).toThrow(
			GenbankTaxonomyError,
		);
	});

	it("captures the full lineage, ending at the record's own taxon", () => {
		const draft = buildGenbankOtuDraft([createRecord()], {
			...taxonomy,
			lineage: [
				{ id: 10239, name: "Viruses", rank: "superkingdom" },
				{ id: 675071, name: "Virgaviridae", rank: "family" },
			],
		});

		expect(draft.taxonomy.lineage).toEqual([
			{ id: 10239, name: "Viruses", rank: "superkingdom" },
			{ id: 675071, name: "Virgaviridae", rank: "family" },
			{ id: 12242, name: "Tobacco mosaic virus", rank: "species" },
		]);
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

	it("rejects named isolates that conflict within one organism", () => {
		const records = [
			createRecord({ source: createSource({ isolate: "A" }) }),
			createRecord({
				accession: "NC_001368",
				accession_version: "NC_001368.1",
				source: createSource({ strain: "B" }),
			}),
		];
		expect(() => buildGenbankOtuDraft(records, taxonomy)).toThrow(
			GenbankMixedIsolateError,
		);
	});

	it("accepts anonymous records alongside a named isolate", () => {
		const records = [
			createRecord({ source: createSource({ isolate: "A" }) }),
			createRecord({
				accession: "NC_001368",
				accession_version: "NC_001368.1",
			}),
		];
		expect(() => buildGenbankOtuDraft(records, taxonomy)).toThrow(
			GenbankSegmentError,
		);
	});

	it("rejects an empty record list", () => {
		expect(() => buildGenbankOtuDraft([], taxonomy)).toThrow(
			GenbankOtuEmptyError,
		);
	});
});

const otu = {
	taxonomy: {
		kind: "local",
		identityId: "id",
		name: "Tobacco mosaic virus",
		acronym: null,
		lineage: [{ id: 12242, name: "Tobacco mosaic virus", rank: "species" }],
	},
	plan: {
		id: "plan",
		segments: [
			{
				id: "segment",
				name: null,
				length: 8,
				lengthTolerance: 0,
				rule: "required",
			},
		],
	},
} as Pick<LocalOtuV2, "taxonomy" | "plan">;

function createCommand(): CreateLocalOtuIsolateCommand {
	return {
		type: "CreateIsolate",
		schemaVersion: 1,
		otuId: "otu",
		expectedVersion: 1,
		payload: {
			genbank: {
				sequences: [{ sequenceId: "sequence", accession: "NC_001367.1" }],
			},
			isolate: {
				id: "isolate",
				name: null,
				sequences: [
					{
						id: "sequence",
						definition: "Tobacco mosaic virus, complete genome",
						sequence: "ATCGATCG",
						segmentId: "segment",
					},
				],
			},
		},
	};
}

describe("NCBI isolate promotion preview", () => {
	const isolateId = "10000000-0000-4000-8000-000000000001";
	const sequenceId = "10000000-0000-4000-8000-000000000002";
	const segmentId = "10000000-0000-4000-8000-000000000003";
	const current = [
		{
			id: sequenceId,
			segmentId,
			definition: "Tobacco mosaic virus, complete genome",
			sequence: "ATCGATCG",
			source: "genbank" as const,
			accessionVersion: "NC_001367.1",
		},
	];
	const existing = {
		...otu,
		molecule: {
			type: "RNA" as const,
			strandedness: "single" as const,
			topology: "linear" as const,
		},
		version: 1,
		plan: {
			...otu.plan,
			id: "10000000-0000-4000-8000-000000000004",
			segments: [
				{
					id: segmentId,
					name: null,
					length: 8,
					lengthTolerance: 0,
					rule: "required" as const,
				},
			],
		},
		isolates: [
			{
				id: isolateId,
				name: null,
				sequences: [
					{
						id: sequenceId,
						segmentId,
						definition: "Tobacco mosaic virus, complete genome",
						sequence: "ATCGATCG",
					},
				],
			},
		],
	};
	it("detects a newer exact accession version", () => {
		const preview = buildPromotionPreview(
			existing,
			isolateId,
			current,
			[
				[
					createRecord({
						accession_version: "NC_001367.2",
						sequence: "ATCGATCA",
					}),
				],
			],
			taxonomy,
		);
		expect(preview.issues).toEqual([]);
		expect(preview.sequences[0]).toMatchObject({
			kind: "refresh",
			accessionVersion: "NC_001367.2",
			sequenceChanged: true,
		});
	});
	it("promotes a RefSeq only with explicit secondary accession evidence", () => {
		const replacement = createRecord({
			accession: "NC_888888",
			accession_version: "NC_888888.1",
			secondary_accessions: ["NC_001367"],
		});
		const preview = buildPromotionPreview(
			existing,
			isolateId,
			current,
			[[replacement]],
			taxonomy,
		);
		expect(preview.issues).toEqual([]);
		expect(preview.sequences[0]?.kind).toBe("promotion");
		expect(
			buildPromotionPreview(
				existing,
				isolateId,
				current,
				[[{ ...replacement, secondary_accessions: [] }]],
				taxonomy,
			).issues,
		).toContain(
			"NCBI did not confirm NC_001367 as a secondary accession of NC_888888.",
		);
	});
	it("rejects inconsistent primary and versioned accession fields", () => {
		const preview = buildPromotionPreview(
			existing,
			isolateId,
			current,
			[
				[
					createRecord({
						accession: "NC_888888",
						accession_version: "NC_999999.1",
						secondary_accessions: ["NC_001367"],
					}),
				],
			],
			taxonomy,
		);
		expect(preview.issues).toContain(
			"NCBI returned inconsistent accession fields for NC_888888.",
		);
	});
	it("rejects ambiguous and partial lookups", () => {
		expect(
			buildPromotionPreview(
				existing,
				isolateId,
				current,
				[[createRecord(), createRecord()]],
				taxonomy,
			).issues,
		).toContain("Accession NC_001367.1 did not resolve to exactly one record.");
		expect(
			buildPromotionPreview(existing, isolateId, current, [[]], taxonomy)
				.issues,
		).toContain("The replacement set is incomplete.");
	});
});

describe("GenBank isolate validation", () => {
	it.each(["RNA1", "RNA 1", "1"])(
		"matches %s to a normalized plan segment",
		(segmentName) => {
			const first = otu.plan.segments[0];
			if (!first) {
				throw new Error("Expected a segment.");
			}
			const namedOtu = {
				...otu,
				plan: {
					...otu.plan,
					segments: [
						{ ...first, name: { prefix: "RNA", key: "1" } },
						{
							...first,
							id: "segment-2",
							name: { prefix: "RNA", key: "2" },
						},
					],
				},
			};
			expect(
				buildGenbankIsolateDraft(
					[createRecord({ source: createSource({ segment: segmentName }) })],
					taxonomy,
					namedOtu,
				).sequences[0]?.segmentId,
			).toBe("segment");
		},
	);

	it("rejects an unnamed record that fits multiple segments", () => {
		const first = otu.plan.segments[0];
		if (!first) {
			throw new Error("Expected a segment.");
		}
		const ambiguousOtu = {
			...otu,
			plan: {
				...otu.plan,
				segments: [
					{ ...first, name: { prefix: "RNA", key: "1" } },
					{
						...first,
						id: "segment-2",
						name: { prefix: "RNA", key: "2" },
					},
				],
			},
		};
		expect(() =>
			buildGenbankIsolateDraft([createRecord()], taxonomy, ambiguousOtu),
		).toThrow(GenbankSegmentError);
	});

	it("matches records against legacy Segment-prefixed plans", () => {
		const first = otu.plan.segments[0];
		if (!first) {
			throw new Error("Expected a segment.");
		}
		const legacyOtu = {
			...otu,
			plan: {
				...otu.plan,
				segments: [
					{ ...first, name: { prefix: "Segment", key: "RNA1" } },
					{
						...first,
						id: "segment-2",
						name: { prefix: "Segment", key: "RNA2" },
					},
				],
			},
		};
		expect(
			buildGenbankIsolateDraft(
				[createRecord({ source: createSource({ segment: "RNA 1" }) })],
				taxonomy,
				legacyOtu,
			).sequences[0]?.segmentId,
		).toBe("segment");
	});
	it("rejects an out-of-tolerance sequence for a single-segment plan", () => {
		expect(() =>
			buildGenbankIsolateDraft(
				[createRecord({ sequence: "ATCG" })],
				taxonomy,
				otu,
			),
		).toThrow(GenbankSegmentError);
	});

	it("rejects an out-of-tolerance named segment", () => {
		const segment = otu.plan.segments[0];
		if (!segment) {
			throw new Error("Expected an OTU segment.");
		}
		const namedOtu = {
			...otu,
			plan: {
				...otu.plan,
				segments: [
					{ ...segment, name: { prefix: "RNA", key: "1" } },
					{
						...segment,
						id: "segment-2",
						name: { prefix: "RNA", key: "2" },
					},
				],
			},
		};
		expect(() =>
			buildGenbankIsolateDraft(
				[
					createRecord({
						sequence: "ATCG",
						source: createSource({ segment: "RNA1" }),
					}),
				],
				taxonomy,
				namedOtu,
			),
		).toThrow(GenbankSegmentError);
	});

	it("rejects conflicting isolate identities in preview and save", () => {
		const firstSegment = otu.plan.segments[0];
		if (!firstSegment) {
			throw new Error("Expected an OTU segment.");
		}
		const records = [
			createRecord({ source: createSource({ isolate: "A" }) }),
			createRecord({
				accession: "NC_001368",
				accession_version: "NC_001368.1",
				source: createSource({ strain: "B" }),
			}),
		];
		const twoSegments = {
			...otu,
			plan: {
				...otu.plan,
				segments: [...otu.plan.segments, { ...firstSegment, id: "segment-2" }],
			},
		};
		expect(() =>
			buildGenbankIsolateDraft(records, taxonomy, twoSegments),
		).toThrow(GenbankMixedIsolateError);
		const command = createCommand();
		const firstSequence = command.payload.isolate.sequences[0];
		if (!firstSequence || !command.payload.genbank) {
			throw new Error("Expected command sequence and provenance.");
		}
		command.payload.genbank.sequences.push({
			sequenceId: "sequence-2",
			accession: "NC_001368.1",
		});
		command.payload.isolate.sequences.push({
			...firstSequence,
			id: "sequence-2",
			segmentId: "segment-2",
		});
		expect(() =>
			validateGenbankIsolateSave(command, records, taxonomy, twoSegments),
		).toThrow(GenbankMixedIsolateError);
	});
	it("accepts a strain taxon beneath the OTU species", () => {
		const strainTaxonomy = {
			...taxonomy,
			id: 999,
			rank: "strain",
			name: "TMV strain U1",
			lineage: [{ id: 12242, name: "Tobacco mosaic virus", rank: "species" }],
		};
		const record = createRecord({
			source: createSource({ taxid: 999, strain: "U1" }),
		});
		expect(
			buildGenbankIsolateDraft([record], strainTaxonomy, otu).name,
		).toEqual({ type: "strain", value: "U1" });
	});

	it("rejects mixed organisms even when taxids match", () => {
		const second = createRecord({
			organism: "Another virus",
			source: createSource({ organism: "Another virus" }),
		});
		expect(() =>
			buildGenbankIsolateDraft([createRecord(), second], taxonomy, otu),
		).toThrow(GenbankOtuMixedTaxidError);
	});

	it("rejects another species and missing taxonomy", () => {
		const otherOtu = {
			...otu,
			taxonomy: {
				...otu.taxonomy,
				lineage: [{ id: 123, name: "Another species", rank: "species" }],
			},
		};
		expect(() =>
			buildGenbankIsolateDraft([createRecord()], taxonomy, otherOtu),
		).toThrow(GenbankTaxonomyError);
		expect(() => buildGenbankIsolateDraft([createRecord()], null, otu)).toThrow(
			GenbankTaxonomyError,
		);
	});

	it("rejects a save without provenance or with edited sequence content", () => {
		const command = createCommand();
		validateGenbankIsolateSave(command, [createRecord()], taxonomy, otu);
		expect(() =>
			validateGenbankIsolateSave(
				{
					...command,
					payload: {
						...command.payload,
						genbank: undefined,
					},
				},
				[createRecord()],
				taxonomy,
				otu,
			),
		).toThrow(GenbankProvenanceError);
		expect(() =>
			validateGenbankIsolateSave(
				command,
				[createRecord({ sequence: "TTTTTTTT" })],
				taxonomy,
				otu,
			),
		).toThrow(GenbankProvenanceError);
	});
});

describe("GenBank OTU save validation", () => {
	it("rejects named identities that changed after preview", () => {
		const records = [
			createRecord({ source: createSource({ segment: "RNA1" }) }),
			createRecord({
				accession: "NC_001368",
				accession_version: "NC_001368.1",
				source: createSource({ segment: "RNA2" }),
			}),
		];
		const command = buildCreateOtuCommandFromDraft(
			buildGenbankOtuDraft(records, taxonomy),
			0.05,
		) as CreateLocalOtuCommand;
		const changed = [
			{
				...records[0],
				source: createSource({ segment: "RNA1", isolate: "A" }),
			},
			{ ...records[1], source: createSource({ segment: "RNA2", strain: "B" }) },
		] as NcbiGenbank[];
		expect(() => validateGenbankOtuSave(command, changed, taxonomy)).toThrow(
			GenbankMixedIsolateError,
		);
	});
	function createGenbankCommand(): CreateLocalOtuCommand {
		return buildCreateOtuCommandFromDraft(
			buildGenbankOtuDraft([createRecord()], taxonomy),
			0.05,
		) as CreateLocalOtuCommand;
	}

	it("accepts a direct save with verifiable accessions", () => {
		validateGenbankOtuSave(createGenbankCommand(), [createRecord()], taxonomy);
	});

	it("rejects a record changed since preview", () => {
		const command = createGenbankCommand();
		expect(() =>
			validateGenbankOtuSave(
				command,
				[createRecord({ sequence: "TTTTTTTT" })],
				taxonomy,
			),
		).toThrow(GenbankProvenanceError);
	});

	it("rejects changed isolate identity and taxonomy details since preview", () => {
		const command = createGenbankCommand();
		expect(() =>
			validateGenbankOtuSave(
				command,
				[createRecord({ source: createSource({ isolate: "New isolate" }) })],
				taxonomy,
			),
		).toThrow(GenbankProvenanceError);
		expect(() =>
			validateGenbankOtuSave(command, [createRecord()], {
				...taxonomy,
				other_names: {
					...taxonomy.other_names,
					acronym: ["NEW"],
				},
			}),
		).toThrow(GenbankProvenanceError);
	});

	it("rejects an accession reclassified under another species", () => {
		const command = createGenbankCommand();
		const otherTaxonomy = {
			...taxonomy,
			id: 999,
			name: "Another virus",
		};
		expect(() =>
			validateGenbankOtuSave(
				command,
				[createRecord({ source: createSource({ taxid: 999 }) })],
				otherTaxonomy,
			),
		).toThrow(GenbankProvenanceError);
	});
});
