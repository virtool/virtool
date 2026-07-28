import { z } from "zod";
import type { SearchResultV2 } from "./search";
import type { UserNested } from "./users";

/**
 * An isolate's canonical display name, as Python's `format_isolate_name`
 * composes it: the capitalised source type followed by the source name.
 *
 * Either field being absent or empty yields the `"Unnamed Isolate"` sentinel —
 * a name is only meaningful with both halves. The source type is lower-cased
 * past its first character to match Python's `str.capitalize`, so an isolate
 * stored as `ISOLATE` renders the same on both sides.
 *
 * Read structurally rather than through a declared isolate type: the callers
 * hold OTU documents at several different stages of patching, and all of them
 * carry these two fields. The snake_case keys are the *storage* shape — this
 * reads the JSONB document, not the wire shape below.
 */
export function formatIsolateName(isolate: {
	source_name?: unknown;
	source_type?: unknown;
}): string {
	const sourceType =
		typeof isolate.source_type === "string" ? isolate.source_type : "";
	const sourceName =
		typeof isolate.source_name === "string" ? isolate.source_name : "";

	if (!sourceType || !sourceName) {
		return "Unnamed Isolate";
	}

	return `${sourceType.charAt(0).toUpperCase()}${sourceType.slice(1).toLowerCase()} ${sourceName}`;
}

/** The nucleic acid a segment is made of. */
export const Molecule = {
	ds_dna: "dsDNA",
	ds_rna: "dsRNA",
	ss_dna: "ssDNA",
	ss_rna: "ssRNA",
	ss_rna_neg: "ssRNA-",
	ss_rna_pos: "ssRNA+",
} as const;

/** The nucleic acid a segment is made of. */
export type Molecule = (typeof Molecule)[keyof typeof Molecule];

const moleculeSchema = z.enum(Molecule);

/**
 * The kind of change a history entry records.
 *
 * These are values, not field names, and are stored verbatim in
 * `legacy_history.method_name` by both services — they stay snake_case where
 * the surrounding wire shape is camelCase.
 */
export type HistoryMethod =
	| "add_isolate"
	| "create"
	| "create_sequence"
	| "clone"
	| "edit"
	| "edit_sequence"
	| "edit_isolate"
	| "remove"
	| "remote"
	| "remove_isolate"
	| "remove_sequence"
	| "import"
	| "set_as_default"
	| "update";

/** The record an OTU or sequence was sourced from in a remote reference. */
export type OtuRemote = {
	/** The unique identifier in the remote reference */
	id: string;
};

/** The reference an OTU belongs to, reduced to id and name. */
export type OtuReferenceNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/** A segment declared in an OTU's schema. */
export type OtuSegment = {
	/** The nucleic acid the segment is made of */
	molecule: Molecule | null;

	/** The segment name sequences reference */
	name: string;

	/** Whether every isolate must carry this segment */
	required: boolean;
};

/** A sequence belonging to an isolate. */
export type OtuSequence = {
	/** The GenBank accession */
	accession: string;

	/** A human-readable description */
	definition: string;

	/** The host organism */
	host: string;

	/** The unique identifier */
	id: string;

	/** The record this sequence was sourced from in a remote reference */
	remote: OtuRemote | null;

	/** The schema segment this sequence fills, or `null` when unassigned */
	segment: string | null;

	/** The nucleotide sequence */
	sequence: string;
};

/** An isolate of an OTU, with its sequences. */
export type OtuIsolate = {
	/** Whether this is the OTU's default isolate */
	default: boolean;

	/** The unique identifier */
	id: string;

	/** The isolate's sequences, in schema-segment order */
	sequences: OtuSequence[];

	/** The isolate's source name (eg. the cultivar) */
	sourceName: string;

	/** The isolate's source type (eg. `isolate`, `strain`) */
	sourceType: string;
};

/** An OTU reduced to the fields embedded in other resources. */
export type OtuNested = {
	/** The unique identifier */
	id: string;

	/** The display name */
	name: string;

	/** The revision number, incremented on every change */
	version: number;
};

/** A sequence record reported as missing its `sequence` field. */
export type OtuEmptySequence = {
	/** The unique identifier */
	id: string;

	/** The isolate the sequence belongs to */
	isolateId: string;
};

/**
 * Validation issues that must be resolved before an OTU can be built into an
 * index. Every field is `false` rather than absent when it does not apply,
 * matching the shape Python's `verify` returns.
 */
export type OtuIssueReport = {
	/** The ids of isolates that have no sequences, or `false` when there are none */
	emptyIsolate: string[] | false;

	/** Whether the OTU has no isolates associated with it */
	emptyOtu: boolean;

	/** Sequences that have an empty `sequence` field, or `false` when there are none */
	emptySequence: OtuEmptySequence[] | false;

	/** Whether isolates carry inconsistent numbers of sequences */
	isolateInconsistency: boolean;
};

/** A change to an OTU, reduced to the fields embedded in the OTU itself. */
export type HistoryNested = {
	/** When the change was made */
	createdAt: Date;

	/** A human-readable description of the change */
	description: string;

	/** The unique identifier, of the form `{otuId}.{otuVersion}` */
	id: string;

	/** The kind of change */
	methodName: HistoryMethod;

	/** The user who made the change */
	user: UserNested;
};

/** The index build a change was included in. */
export type HistoryIndexNested = {
	/** The unique identifier */
	id: number;

	/** The build's version number */
	version: number;
};

/**
 * The OTU a change was made to, at the version the change produced.
 *
 * `version` is the string `"removed"` on the change that deleted the OTU —
 * there is no numbered version for a document that no longer exists.
 */
export type HistoryOtuNested = {
	/** The unique identifier */
	id: string;

	/** The display name, as it was before the change */
	name: string;

	/** The version the change produced, or `"removed"` if it deleted the OTU */
	version: number | "removed";
};

/** A change to an OTU, as listed by the OTU's history. */
export type OtuHistory = HistoryNested & {
	/** The index the change was built into, or `null` while it is unbuilt */
	index: HistoryIndexNested | null;

	/** The OTU the change was made to */
	otu: HistoryOtuNested;

	/** The reference the OTU belongs to */
	reference: OtuReferenceNested;
};

/** An OTU as it appears in a search-result list. */
export type OtuMinimal = OtuNested & {
	/** The OTU's abbreviation, or the empty string */
	abbreviation: string;

	/** The reference the OTU belongs to */
	reference: OtuReferenceNested;

	/** Whether the OTU passes validation and can be built into an index */
	verified: boolean;
};

/** A complete OTU, with its isolates and their sequences. */
export type Otu = OtuMinimal & {
	/** The OTU's isolates */
	isolates: OtuIsolate[];

	/** Validation issues, or `null` when the OTU is valid */
	issues: OtuIssueReport | null;

	/** The version last built into an index, or `null` when never built */
	lastIndexedVersion: number | null;

	/** The most recent change made to the OTU */
	mostRecentChange: HistoryNested | null;

	/** The record this OTU was sourced from in a remote reference */
	remote: OtuRemote | null;

	/** The segments an isolate's sequences are assigned to */
	schema: OtuSegment[];
};

/** A page of OTUs. */
export type OtuSearchResult = SearchResultV2 & {
	items: OtuMinimal[];

	/** The number of OTUs changed since the reference was last built */
	modifiedCount: number;
};

/** A sequence record looked up in GenBank by accession. */
export type Genbank = {
	/** The GenBank accession */
	accession: string;

	/** A human-readable description */
	definition: string;

	/** The host organism, or the empty string when the record names none */
	host: string;

	/** The nucleotide sequence */
	sequence: string;
};

const segmentSchema = z.object({
	molecule: moleculeSchema.nullable().default(null),
	name: z.string(),
	required: z.boolean(),
});

/** Fields accepted when creating an OTU. */
export const OtuCreateRequest = z.object({
	name: z.string().trim().min(1),
	abbreviation: z.string().trim().default(""),
	schema: z.array(segmentSchema).default([]),
});

export type OtuCreateRequest = z.infer<typeof OtuCreateRequest>;

/** Fields accepted when updating an OTU. Only those present are changed. */
export const OtuUpdateRequest = z.object({
	name: z.string().trim().min(1).optional(),
	abbreviation: z.string().trim().optional(),
	schema: z.array(segmentSchema).optional(),
});

export type OtuUpdateRequest = z.infer<typeof OtuUpdateRequest>;

/** Fields accepted when creating an isolate. */
export const IsolateCreateRequest = z.object({
	default: z.boolean().default(false),
	sourceName: z.string().trim().default(""),
	sourceType: z.string().trim().default(""),
});

export type IsolateCreateRequest = z.infer<typeof IsolateCreateRequest>;

/** Fields accepted when updating an isolate. Only those present are changed. */
export const IsolateUpdateRequest = z.object({
	sourceName: z.string().trim().optional(),
	sourceType: z.string().trim().optional(),
});

export type IsolateUpdateRequest = z.infer<typeof IsolateUpdateRequest>;

/**
 * The characters a stored nucleotide sequence may use: the four bases plus the
 * IUPAC ambiguity codes Virtool accepts.
 *
 * Python strips spaces and newlines after validating against this same pattern,
 * which its own regex has already rejected — the strip is unreachable and is not
 * carried over. The sequence field enforces the pattern client-side too, so
 * nothing reaching here has whitespace to lose.
 */
const sequenceSchema = z
	.string()
	.min(1)
	.regex(/^[ATCGNRYKM]+$/);

/** Fields accepted when creating a sequence. */
export const SequenceCreateRequest = z.object({
	accession: z.string().trim().min(1),
	definition: z.string().trim().min(1),
	host: z.string().trim().default(""),
	segment: z.string().nullable().default(null),
	sequence: sequenceSchema,
});

export type SequenceCreateRequest = z.infer<typeof SequenceCreateRequest>;

/** Fields accepted when updating a sequence. Only those present are changed. */
export const SequenceUpdateRequest = z.object({
	accession: z.string().trim().min(1).optional(),
	definition: z.string().trim().min(1).optional(),
	host: z.string().trim().optional(),
	segment: z.string().nullable().optional(),
	sequence: sequenceSchema.optional(),
});

export type SequenceUpdateRequest = z.infer<typeof SequenceUpdateRequest>;
