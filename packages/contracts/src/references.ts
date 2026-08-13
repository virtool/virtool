import { z } from "zod";
import type { SearchResult } from "./search";
import type { Task } from "./tasks";
import type { UserNested } from "./users";

/** The three per-reference rights a member (user or group) can be granted. */
export type ReferenceRights = {
	build: boolean;
	modify: boolean;
	modifyOtu: boolean;
};

/** The name of a single reference right. */
export type ReferenceRight = keyof ReferenceRights;

/** A user granted rights on a reference. */
export type ReferenceUser = ReferenceRights & {
	id: number;
	handle: string;
	createdAt: Date;
};

/** A group granted rights on a reference. */
export type ReferenceGroup = ReferenceRights & {
	id: number;
	name: string;
	createdAt: Date;
};

/** The reference a clone was created from, reduced to id and name. */
export type ReferenceClonedFrom = { id: number; name: string };

/** A contributor to a reference's history, with their change count. */
export type ReferenceContributor = UserNested & { count: number };

/** The most recent ready build (index) of a reference. */
export type ReferenceBuild = {
	id: number;
	version: number;
	createdAt: Date;
	user: UserNested;
};

/** The upload a reference was imported from, with its uploader. */
export type ReferenceImportedFrom = {
	id: number;
	name: string;
	createdAt: Date | null;
	size: number | null;
	user: UserNested | null;
};

/** A reference as it appears in a search-result list. */
export type ReferenceMinimal = {
	id: number;
	dataType: string;
	name: string;
	archived: boolean;
	clonedFrom: ReferenceClonedFrom | null;
	createdAt: Date;
	importedFrom: ReferenceImportedFrom | null;
	latestBuild: ReferenceBuild | null;
	organism: string;
	otuCount: number;
	task: Task | null;
	user: UserNested | null;
};

/** A full reference, as returned by the detail endpoint. */
export type Reference = ReferenceMinimal & {
	contributors: ReferenceContributor[];
	description: string;
	groups: ReferenceGroup[];
	restrictSourceTypes: boolean;
	sourceTypes: string[];
	users: ReferenceUser[];
};

/** A page of references. */
export type ReferenceSearchResult = SearchResult & {
	items: ReferenceMinimal[];
};

/**
 * Fields accepted when creating a reference. An empty name, description, or
 * organism is allowed; a clone fills the name in from its source. At most one
 * of `cloneFrom` and `importFrom` may be set — the server function enforces
 * that on top of this shape.
 */
export const ReferenceCreateRequest = z.object({
	name: z.string().trim().default(""),
	description: z.string().trim().default(""),
	organism: z.string().trim().default(""),
	cloneFrom: z.number().int().positive().optional(),
	importFrom: z.number().int().positive().optional(),
});

export type ReferenceCreateRequest = z.infer<typeof ReferenceCreateRequest>;

/** Fields accepted when updating a reference. Only those present are changed. */
export const ReferenceUpdateRequest = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().optional(),
	organism: z.string().optional(),
	restrictSourceTypes: z.boolean().optional(),
	sourceTypes: z.array(z.string()).optional(),
});

export type ReferenceUpdateRequest = z.infer<typeof ReferenceUpdateRequest>;

/*
 * The shape of an uploaded reference file, and the port of Python's
 * `ReferenceSourceData` and the models under it.
 *
 * Two upload formats parse to this one shape: a gzipped JSON export, which
 * spells an OTU's and a sequence's id `_id`, and a `.v1.sqlite` snapshot, whose
 * reader yields the same documents keyed `id`. Python reconciles the two with a
 * pydantic alias plus `allow_population_by_field_name`; `withUnderscoreId`
 * below is that reconciliation, and it normalises onto `_id` because
 * `prepareOtuInsertion` reads the document Mongo-side.
 *
 * Every object is loose. A reference carries keys neither implementation reads
 * — `schema`, `taxid`, `remote` — and the OTU document is stored verbatim, so
 * stripping them would silently drop data on the way through.
 */

/**
 * Accept an `id` where the schema wants `_id`, as Python's alias does.
 *
 * Only fills `_id` in; an object that already has one is untouched, so a
 * document carrying both keeps whichever the JSON export wrote.
 */
function withUnderscoreId(value: unknown): unknown {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return value;
	}

	const record = value as Record<string, unknown>;

	if ("_id" in record || !("id" in record)) {
		return value;
	}

	const { id, ...rest } = record;

	return { _id: id, ...rest };
}

const referenceSourceSequenceSchema = z.preprocess(
	withUnderscoreId,
	z.looseObject({
		_id: z.string().min(1),
		accession: z.string().min(1),
		definition: z.string(),
		sequence: z.string().min(10),
	}),
);

const referenceSourceIsolateSchema = z.looseObject({
	// No alias here, and none in Python either: both readers spell an isolate's
	// id `id` already.
	id: z.string(),
	default: z.boolean(),
	source_type: z.string(),
	source_name: z.string(),
	sequences: z.array(referenceSourceSequenceSchema).min(1),
});

const referenceSourceOtuSchema = z.preprocess(
	withUnderscoreId,
	z.looseObject({
		_id: z.string(),
		abbreviation: z.string().default(""),
		name: z.string(),
		isolates: z.array(referenceSourceIsolateSchema).min(1),
	}),
);

/** One OTU of an uploaded reference, with its isolates and their sequences. */
export type ReferenceSourceOtu = z.infer<typeof referenceSourceOtuSchema>;

/**
 * The most duplicates of one kind named before the message is truncated.
 *
 * A file whose ids are all identical would otherwise put one entry per OTU into
 * `tasks.error`, which is read back into a popover.
 */
const MAX_REPORTED_DUPLICATES = 5;

/**
 * Every duplicate check Python runs, in one pass over the OTUs.
 *
 * Python spreads these across four `@validator("otus")` functions, which stop
 * at the first that raises, so a file with two problems is fixed and
 * re-uploaded only to fail on the next. Running them together reports all four
 * at once; the predicates themselves are unchanged, quirks included — the name
 * check compares case-insensitively but reports the name as written, isolate
 * ids collide only within their own OTU, and sequence ids collide across the
 * whole file.
 */
function checkForDuplicates(
	data: { otus: ReferenceSourceOtu[] },
	ctx: z.RefinementCtx,
): void {
	const seenNames = new Set<string>();
	const duplicateNames = new Set<string>();

	const seenOtuIds = new Set<string>();
	const duplicateOtuIds = new Set<string>();

	const seenSequenceIds = new Set<string>();
	const duplicateSequenceIds = new Set<string>();

	const otusWithDuplicateIsolates: string[] = [];

	for (const otu of data.otus) {
		const lowered = otu.name.toLowerCase();

		if (seenNames.has(lowered)) {
			duplicateNames.add(otu.name);
		} else {
			seenNames.add(lowered);
		}

		if (seenOtuIds.has(otu._id)) {
			duplicateOtuIds.add(otu._id);
		} else {
			seenOtuIds.add(otu._id);
		}

		const isolateIds = new Set<string>();
		let hasDuplicateIsolate = false;

		for (const isolate of otu.isolates) {
			if (isolateIds.has(isolate.id)) {
				hasDuplicateIsolate = true;
			}

			isolateIds.add(isolate.id);

			for (const sequence of isolate.sequences) {
				if (seenSequenceIds.has(sequence._id)) {
					duplicateSequenceIds.add(sequence._id);
				} else {
					seenSequenceIds.add(sequence._id);
				}
			}
		}

		if (hasDuplicateIsolate) {
			otusWithDuplicateIsolates.push(`${otu.name} (${otu._id})`);
		}
	}

	const problems: Array<[string, Iterable<string>]> = [
		["Duplicate OTU names", duplicateNames],
		["Duplicate OTU ids", duplicateOtuIds],
		["OTUs with duplicate isolate ids", otusWithDuplicateIsolates],
		["Duplicate sequence ids", duplicateSequenceIds],
	];

	for (const [label, found] of problems) {
		const items = [...found];

		if (items.length > 0) {
			ctx.addIssue({
				code: "custom",
				path: ["otus"],
				message: `${label}: ${summarize(items)}`,
			});
		}
	}
}

/** Name the first few of `items`, counting off however many are left. */
function summarize(items: string[]): string {
	const shown = items.slice(0, MAX_REPORTED_DUPLICATES).join(", ");

	return items.length > MAX_REPORTED_DUPLICATES
		? `${shown} and ${items.length - MAX_REPORTED_DUPLICATES} more`
		: shown;
}

export const ReferenceSourceDataSchema = z
	.object({
		/*
		 * Python's `ReferenceDataType` has one member, so a barcode reference is
		 * rejected there and must be rejected here too — both runners claim these
		 * tasks until the cutover, and the looser side would accept a file the
		 * other refuses.
		 */
		data_type: z.enum(["genome"]).default("genome"),
		organism: z.string().default("Unknown"),
		otus: z.array(referenceSourceOtuSchema).min(1),
	})
	.superRefine(checkForDuplicates);

/** A parsed reference upload, ready to be written to a reference. */
export type ReferenceSourceData = z.infer<typeof ReferenceSourceDataSchema>;
