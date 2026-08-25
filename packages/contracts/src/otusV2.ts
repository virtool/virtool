import { z } from "zod";

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
	.strict();

const localTaxonomySchema = z
	.object({
		kind: z.literal("local"),
		identityId: uuidSchema,
		name: trimmedTextSchema,
		acronym: trimmedTextSchema.nullable().default(null),
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

const createOtuPayloadSchema = z
	.object({
		molecule: moleculeSchema,
		plan: planSchema,
		taxonomy: localTaxonomySchema,
		promotedAccessions: z.array(z.string()).length(0),
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

		const sequenceIds = new Set<string>();
		const filledSegments = new Set<string>();

		for (const [index, sequence] of payload.isolate.sequences.entries()) {
			if (sequenceIds.has(sequence.id)) {
				ctx.addIssue({
					code: "custom",
					path: ["isolate", "sequences", index, "id"],
					message: "Sequence ids must be unique.",
				});
			}
			sequenceIds.add(sequence.id);

			if (!segmentIds.has(sequence.segmentId)) {
				ctx.addIssue({
					code: "custom",
					path: ["isolate", "sequences", index, "segmentId"],
					message: "Sequence segment must belong to the OTU plan.",
				});
			}
			filledSegments.add(sequence.segmentId);

			const segment = payload.plan.segments.find(
				(candidate) => candidate.id === sequence.segmentId,
			);
			if (segment) {
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
		}

		for (const [index, segment] of payload.plan.segments.entries()) {
			if (segment.rule === "required" && !filledSegments.has(segment.id)) {
				ctx.addIssue({
					code: "custom",
					path: ["plan", "segments", index],
					message: "Every required segment must have a sequence.",
				});
			}
		}
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

/** Input accepted before a local `CreateOTU` command is normalized. */
export type CreateLocalOtuCommandInput = z.input<typeof CreateLocalOtuCommand>;

/** A parsed and normalized local `CreateOTU` command. */
export type CreateLocalOtuCommand = z.output<typeof CreateLocalOtuCommand>;

/** A segment in an assembled v2 OTU plan. */
export type OtuV2Segment = z.output<typeof segmentSchema>;

/** A stable v2 plan and its current segment state. */
export type OtuV2Plan = z.output<typeof planSchema>;

/** The local display identity of an assembled v2 OTU. */
export type OtuV2LocalTaxonomy = z.output<typeof localTaxonomySchema>;

/** A locally authored sequence in an assembled v2 OTU. */
export type OtuV2LocalSequence = z.output<typeof localSequenceSchema>;

/** An isolate in an assembled v2 OTU. */
export type OtuV2Isolate = z.output<typeof isolateSchema>;

/** A v2 OTU molecule. */
export type OtuV2Molecule = z.output<typeof moleculeSchema>;

/** The creation history summary embedded in the tracer read model. */
export type OtuV2Change = {
	version: number;
	command: "CreateOTU";
	commandSchemaVersion: number;
	source: "user";
	userId: number;
	createdAt: Date;
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
	mostRecentChange: OtuV2Change;
};
