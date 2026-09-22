import { z } from "zod";
import type { UserNested } from "./users";

/** The molecule type stored by a v2 OTU. */
export const OtuV2MoleculeType = {
	cRNA: "cRNA",
	DNA: "DNA",
	mRNA: "mRNA",
	RNA: "RNA",
	tRNA: "tRNA",
} as const;

/** The molecule type stored by a v2 OTU. */
export type OtuV2MoleculeType =
	(typeof OtuV2MoleculeType)[keyof typeof OtuV2MoleculeType];

/** The strandedness stored by a v2 OTU. */
export const OtuV2Strandedness = {
	single: "single",
	double: "double",
} as const;

/** The strandedness stored by a v2 OTU. */
export type OtuV2Strandedness =
	(typeof OtuV2Strandedness)[keyof typeof OtuV2Strandedness];

/** The topology stored by a v2 OTU. */
export const OtuV2Topology = {
	linear: "linear",
	circular: "circular",
} as const;

/** The topology stored by a v2 OTU. */
export type OtuV2Topology = (typeof OtuV2Topology)[keyof typeof OtuV2Topology];

/** The completeness rule applied to a v2 plan segment. */
export const OtuV2SegmentRule = {
	required: "required",
	recommended: "recommended",
	optional: "optional",
} as const;

/** The completeness rule applied to a v2 plan segment. */
export type OtuV2SegmentRule =
	(typeof OtuV2SegmentRule)[keyof typeof OtuV2SegmentRule];

/** The kind of name assigned to a v2 isolate. */
export const OtuV2IsolateNameType = {
	isolate: "isolate",
	strain: "strain",
	clone: "clone",
	variant: "variant",
	genotype: "genotype",
	serotype: "serotype",
} as const;

/** The kind of name assigned to a v2 isolate. */
export type OtuV2IsolateNameType =
	(typeof OtuV2IsolateNameType)[keyof typeof OtuV2IsolateNameType];

const uuidSchema = z.uuid();
const trimmedTextSchema = z.string().trim().min(1);
const sequenceSchema = z
	.string()
	.transform((value) => value.replace(/\s/g, "").toUpperCase())
	.pipe(
		z
			.string()
			.min(1)
			.regex(/^[ATCGNRYKMSWBDHV]+$/),
	);

const moleculeSchema = z
	.object({
		type: z.enum(OtuV2MoleculeType),
		strandedness: z.enum(OtuV2Strandedness),
		topology: z.enum(OtuV2Topology),
	})
	.strict();

const segmentNameSchema = z
	.object({
		prefix: trimmedTextSchema,
		key: trimmedTextSchema,
	})
	.strict();

const segmentSchema = z
	.object({
		id: uuidSchema,
		name: segmentNameSchema.nullable(),
		length: z.number().int().positive(),
		lengthTolerance: z.number().min(0).max(1),
		rule: z.enum(OtuV2SegmentRule),
	})
	.strict();

const planSchema = z
	.object({
		id: uuidSchema,
		segments: z.array(segmentSchema).min(1),
	})
	.strict()
	.superRefine((plan, ctx) => {
		const names = new Set<string>();
		for (const [index, segment] of plan.segments.entries()) {
			if (plan.segments.length > 1 && !segment.name) {
				ctx.addIssue({
					code: "custom",
					path: ["segments", index, "name"],
					message: "Every multipartite segment must have a name.",
				});
				continue;
			}
			if (segment.name) {
				const name = `${segment.name.prefix.toLowerCase()}\0${segment.name.key.toLowerCase()}`;
				if (names.has(name)) {
					ctx.addIssue({
						code: "custom",
						path: ["segments", index, "name"],
						message: "Segment names must be unique.",
					});
				}
				names.add(name);
			}
		}
	});

const lineageTaxonSchema = z
	.object({
		id: z.number().int().positive(),
		name: z.string(),
		rank: z.string(),
	})
	.strict();

const localTaxonomySchema = z
	.object({
		kind: z.literal("local"),
		identityId: uuidSchema,
		name: trimmedTextSchema,
		acronym: trimmedTextSchema.nullable().default(null),
		lineage: z.array(lineageTaxonSchema).default([]),
	})
	.strict();

const isolateNameSchema = z
	.object({
		type: z.enum(OtuV2IsolateNameType),
		value: trimmedTextSchema,
	})
	.strict();

const localSequenceSchema = z
	.object({
		id: uuidSchema,
		definition: trimmedTextSchema,
		sequence: sequenceSchema,
		segmentId: uuidSchema,
	})
	.strict();

const isolateSchema = z
	.object({
		id: uuidSchema,
		name: isolateNameSchema.nullable().default(null),
		sequences: z.array(localSequenceSchema).min(1),
	})
	.strict();

const genbankProvenanceSchema = z
	.object({
		sequences: z
			.array(
				z
					.object({
						sequenceId: uuidSchema,
						accession: z
							.string()
							.min(1)
							.max(64)
							.regex(/^[A-Za-z0-9._-]+$/),
					})
					.strict(),
			)
			.min(1)
			.max(500),
	})
	.strict();

function checkIsolatePlan(
	plan: z.output<typeof planSchema>,
	isolate: z.output<typeof isolateSchema>,
	ctx: z.RefinementCtx,
): void {
	const segments = new Map(
		plan.segments.map((segment) => [segment.id, segment]),
	);
	const sequenceIds = new Set<string>();
	const filledSegments = new Set<string>();

	for (const [index, sequence] of isolate.sequences.entries()) {
		if (sequenceIds.has(sequence.id)) {
			ctx.addIssue({
				code: "custom",
				path: ["isolate", "sequences", index, "id"],
				message: "Sequence ids must be unique.",
			});
		}
		sequenceIds.add(sequence.id);

		const segment = segments.get(sequence.segmentId);
		if (!segment) {
			ctx.addIssue({
				code: "custom",
				path: ["isolate", "sequences", index, "segmentId"],
				message: "Sequence segment must belong to the OTU plan.",
			});
			continue;
		}
		if (filledSegments.has(sequence.segmentId)) {
			ctx.addIssue({
				code: "custom",
				path: ["isolate", "sequences", index, "segmentId"],
				message: "A segment can have only one sequence per isolate.",
			});
		}
		filledSegments.add(sequence.segmentId);
		const minimum = segment.length * (1 - segment.lengthTolerance);
		const maximum = segment.length * (1 + segment.lengthTolerance);
		if (
			sequence.sequence.length < minimum ||
			sequence.sequence.length > maximum
		) {
			ctx.addIssue({
				code: "custom",
				path: ["isolate", "sequences", index, "sequence"],
				message: "Sequence length is outside the segment tolerance.",
			});
		}
	}

	for (const [index, segment] of plan.segments.entries()) {
		if (segment.rule === "required" && !filledSegments.has(segment.id)) {
			ctx.addIssue({
				code: "custom",
				path: ["plan", "segments", index],
				message: "Every required segment must have a sequence.",
			});
		}
	}
}

/** The shared plan rules for one local OTU isolate. */
export const OtuV2IsolatePlan = z
	.object({ plan: planSchema, isolate: isolateSchema })
	.strict()
	.superRefine(({ plan, isolate }, ctx) =>
		checkIsolatePlan(plan, isolate, ctx),
	);

const createOtuPayloadSchema = z
	.object({
		molecule: moleculeSchema,
		plan: planSchema,
		taxonomy: localTaxonomySchema,
		promotedAccessions: z.array(z.string()).length(0),
		genbank: genbankProvenanceSchema.optional(),
		isolate: isolateSchema,
	})
	.strict()
	.superRefine((payload, ctx) => {
		const segmentIds = new Set<string>();

		for (const [index, segment] of payload.plan.segments.entries()) {
			if (segmentIds.has(segment.id)) {
				ctx.addIssue({
					code: "custom",
					path: ["plan", "segments", index, "id"],
					message: "Segment ids must be unique.",
				});
			}
			segmentIds.add(segment.id);
		}

		checkIsolatePlan(payload.plan, payload.isolate, ctx);
	});

/** A canonical local `CreateOTU` command accepted by v2. */
export const CreateLocalOtuCommand = z
	.object({
		type: z.literal("CreateOTU"),
		schemaVersion: z.literal(1),
		otuId: uuidSchema,
		expectedVersion: z.literal(0),
		payload: createOtuPayloadSchema,
	})
	.strict();

/** A command that adds one isolate to an existing local OTU. */
export const CreateLocalOtuIsolateCommand = z
	.object({
		type: z.literal("CreateIsolate"),
		schemaVersion: z.literal(1),
		otuId: uuidSchema,
		expectedVersion: z.number().int().positive(),
		payload: z
			.object({
				isolate: isolateSchema,
				genbank: genbankProvenanceSchema.optional(),
			})
			.strict(),
	})
	.strict();

/** A command that deletes one isolate from an existing local OTU. */
export const DeleteLocalOtuIsolateCommand = z
	.object({
		type: z.literal("DeleteIsolate"),
		schemaVersion: z.literal(1),
		otuId: uuidSchema,
		expectedVersion: z.number().int().positive(),
		payload: z.object({ isolateId: uuidSchema }).strict(),
	})
	.strict();

/** A command that deletes an existing local OTU. */
export const DeleteLocalOtuCommand = z
	.object({
		type: z.literal("DeleteOTU"),
		schemaVersion: z.literal(1),
		otuId: uuidSchema,
		expectedVersion: z.number().int().positive(),
		payload: z.object({}).strict(),
	})
	.strict();

/** Input accepted before a local `CreateOTU` command is normalized. */
export type CreateLocalOtuCommandInput = z.input<typeof CreateLocalOtuCommand>;

/** A parsed and normalized local `CreateOTU` command. */
export type CreateLocalOtuCommand = z.output<typeof CreateLocalOtuCommand>;

/** A parsed and normalized local `CreateIsolate` command. */
export type CreateLocalOtuIsolateCommand = z.output<
	typeof CreateLocalOtuIsolateCommand
>;

/** Input accepted before a local `CreateIsolate` command is normalized. */
export type CreateLocalOtuIsolateCommandInput = z.input<
	typeof CreateLocalOtuIsolateCommand
>;

/** A parsed and normalized local `DeleteIsolate` command. */
export type DeleteLocalOtuIsolateCommand = z.output<
	typeof DeleteLocalOtuIsolateCommand
>;

/** Input accepted before a local `DeleteIsolate` command is normalized. */
export type DeleteLocalOtuIsolateCommandInput = z.input<
	typeof DeleteLocalOtuIsolateCommand
>;

/** Input accepted for a local `DeleteOTU` command. */
export type DeleteLocalOtuCommandInput = z.input<typeof DeleteLocalOtuCommand>;

/** A parsed and normalized local `DeleteOTU` command. */
export type DeleteLocalOtuCommand = z.output<typeof DeleteLocalOtuCommand>;

/** A segment in an assembled v2 OTU plan. */
export type OtuV2Segment = z.output<typeof segmentSchema>;

/** A stable v2 plan and its current segment state. */
export type OtuV2Plan = z.output<typeof planSchema>;

/** One taxon in an OTU's ordered NCBI lineage, from root to organism. */
export type OtuV2LineageTaxon = z.output<typeof lineageTaxonSchema>;

/** The local display identity of an assembled v2 OTU. */
export type OtuV2LocalTaxonomy = z.output<typeof localTaxonomySchema>;

/** A locally authored sequence in an assembled v2 OTU. */
export type OtuV2LocalSequence = z.output<typeof localSequenceSchema>;

/** An isolate in an assembled v2 OTU. */
export type OtuV2Isolate = z.output<typeof isolateSchema>;

/** A lightweight isolate summary used by OTU navigation views. */
export type LocalOtuV2IsolateSummary = {
	id: string;
	name: OtuV2Isolate["name"];
	createdAt: Date;
};

/** A sequence summary that excludes the sequence body. */
export type LocalOtuV2SequenceSummary = {
	id: string;
	definition: string;
	segmentId: string;
};

/** One isolate with sequence metadata but without sequence bodies. */
export type LocalOtuV2IsolateDetail = {
	id: string;
	name: OtuV2Isolate["name"];
	sequences: LocalOtuV2SequenceSummary[];
};

/** A v2 OTU molecule. */
export type OtuV2Molecule = z.output<typeof moleculeSchema>;

/** The creation history summary embedded in the tracer read model. */
export type OtuV2Change = {
	version: number;
	commandSchemaVersion: number;
	source: "user";
	user: UserNested;
	createdAt: Date;
} & (
	| {
			command: "CreateOTU";
			payload: CreateLocalOtuCommand["payload"];
	  }
	| {
			command: "CreateIsolate";
			payload: CreateLocalOtuIsolateCommand["payload"];
	  }
	| {
			command: "DeleteIsolate";
			payload: DeleteLocalOtuIsolateCommand["payload"];
	  }
	| {
			command: "DeleteOTU";
			payload: DeleteLocalOtuCommand["payload"];
	  }
);

/** A summary of a local v2 OTU for listing within a Reference. */
export type LocalOtuV2Summary = {
	id: string;
	name: string;
	acronym: string | null;
	version: number;
	isolateCount: number;
};

/** One segment of a GenBank-derived OTU draft, from a single record. */
export type GenbankOtuDraftSegment = {
	name: { prefix: string; key: string } | null;
	definition: string;
	sequence: string;
	length: number;
	accession: string;
};

/**
 * A neutral OTU draft derived from one or more GenBank records.
 *
 * The server resolves NCBI records and taxonomy into this shape; the client
 * mints the UUIDs and applies the Reference's default tolerance to turn it into
 * a complete `CreateOTU` command. It carries no UUIDs and no persistence state.
 */
export type GenbankOtuDraft = {
	molecule: OtuV2Molecule;
	taxonomy: {
		name: string;
		acronym: string | null;
		lineage: OtuV2LineageTaxon[];
	};
	isolate: { type: OtuV2IsolateNameType; value: string } | null;
	segments: GenbankOtuDraftSegment[];
};

/** A GenBank-derived isolate preview for an existing OTU. */
export type GenbankIsolateDraft = {
	name: { type: OtuV2IsolateNameType; value: string } | null;
	sequences: Array<GenbankOtuDraftSegment & { segmentId: string }>;
};

/** A complete local v2 OTU assembled from relational state. */
export type LocalOtuV2 = {
	id: string;
	referenceId: string;
	version: number;
	molecule: OtuV2Molecule;
	taxonomy: OtuV2LocalTaxonomy;
	plan: OtuV2Plan;
	isolates: OtuV2Isolate[];
	createdAt: Date;
	changes: OtuV2Change[];
	mostRecentChange: OtuV2Change;
};

/** The metadata needed to render the local v2 OTU overview. */
export type LocalOtuV2Overview = Omit<LocalOtuV2, "isolates"> & {
	isolates: Array<Omit<LocalOtuV2IsolateSummary, "createdAt">>;
	isolateCount: number;
};

/** The body and provenance of one local v2 sequence, fetched on demand. */
export type LocalOtuV2Sequence = OtuV2LocalSequence & {
	source: "manual" | "genbank";
	accessionVersion: string | null;
};
