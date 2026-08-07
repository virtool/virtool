import { z } from "zod";
import type { GroupMinimal } from "./groups";
import type { JobNested } from "./jobs";
import type { LabelNested } from "./labels";
import type { SearchResult } from "./search";
import type { SubtractionNested } from "./subtractions";
import type { UserNested } from "./users";

/**
 * The library preparation used to create a sample.
 *
 * A schema rather than a plain union because the jobs API serves it to a
 * workflow, whose client parses the response — and every workflow branches on
 * it to decide whether it is running paired or amplicon logic.
 */
export const LibraryType = z.enum(["amplicon", "srna", "other", "normal"]);

export type LibraryType = z.infer<typeof LibraryType>;

/** The state of a single workflow for a sample. */
export type WorkflowState = "complete" | "pending" | "none" | "incompatible";

/** The state of each workflow tracked for a sample. */
export type SampleWorkflows = {
	/** The state of the NuVs workflow */
	nuvs: WorkflowState;

	/** The state of the Pathoscope workflow */
	pathoscope: WorkflowState;
};

/**
 * The creation job embedded in a sample. A job nested in a sample is always the
 * `create_sample` job that built it.
 */
export type SampleJobNested = JobNested & { workflow: "create_sample" };

/** An input upload embedded in a sample reads file. */
export type SampleReadUpload = {
	id: number;
	name: string;
	size: number | null;
	uploadedAt: string | null;
	user: UserNested | null;
};

/** A reads file that makes up a sample. */
export type Read = {
	downloadUrl: string;
	id: number;
	name: string;
	nameOnDisk: string;
	sample: number;
	size: number;

	/**
	 * The object's complete key in storage, as recorded when it was written, or
	 * null for a file that predates keys being recorded.
	 *
	 * Nothing composes this from the row's identity: a migrated file keeps
	 * whatever prefix its object was written under, so no pattern reconstructs
	 * one. A workflow reads the bytes itself and has no other way to locate them.
	 */
	storageKey: string | null;

	upload?: SampleReadUpload | null;
	uploadedAt: string;
};

/**
 * The FastQC quality charts associated with a sample.
 *
 * A schema rather than a plain type because the jobs API validates an
 * incoming quality blob at sample finalize; `@virtool/bio`'s FastQC parser is
 * what produces it.
 */
export const Quality = z.object({
	/** Data for the per-base quality chart */
	bases: z.array(z.array(z.number())),

	/** Data for the composition chart */
	composition: z.array(z.array(z.number())),

	/** The read count of the sample */
	count: z.number().int().nonnegative(),

	/** The quality-score encoding */
	encoding: z.string(),

	/** The GC content of the sample as a percentage */
	gc: z.number(),

	/** The read-length range */
	length: z.array(z.number()),

	/** Data for the sequences chart */
	sequences: z.array(z.number()),
});

export type Quality = z.infer<typeof Quality>;

/** A sample reduced to the fields shown in resource listings. */
export type SampleMinimal = {
	createdAt: string;
	host: string;
	id: number;
	isolate: string;
	job?: SampleJobNested;
	labels: LabelNested[];
	libraryType: LibraryType;
	name: string;
	notes: string;
	nuvs: boolean | string;
	pathoscope: boolean | string;
	ready: boolean;
	user: UserNested;
	workflows: SampleWorkflows;
};

/** A complete sample, as returned by the detail endpoint. */
export type Sample = SampleMinimal & {
	allRead: boolean;
	allWrite: boolean;
	format: string;
	group: GroupMinimal | null;
	groupRead: boolean;
	groupWrite: boolean;
	hold: boolean;
	isLegacy: boolean;
	locale: string;
	paired: boolean;
	quality: Quality | null;
	reads: Read[];
	subtractions: SubtractionNested[];
};

/** A page of samples with pagination metadata. */
export type SampleSearchResult = SearchResult & {
	items: SampleMinimal[];
};

/** The rights fields that can be changed on a sample. */
export type SampleRightsUpdate = {
	allRead?: boolean;
	allWrite?: boolean;
	group?: number | string | null;
	groupRead?: boolean;
	groupWrite?: boolean;
};

/**
 * Fields accepted when creating a sample. A name is required; the rest default
 * to empty. `group` is a group id, a legacy string, or null (`""` and `"none"`
 * mean "no group"); `files` is one or two reads uploads.
 */
export const SampleCreateRequest = z.object({
	name: z.string().trim().min(1),
	host: z.string().trim().default(""),
	isolate: z.string().trim().default(""),
	locale: z.string().trim().default(""),
	notes: z.string().default(""),
	libraryType: z
		.enum(["amplicon", "srna", "other", "normal"])
		.default("normal"),
	group: z.union([z.number().int(), z.string(), z.null()]).default(null),
	subtractions: z.array(z.number().int().positive()).default([]),
	labels: z.array(z.number().int().positive()).default([]),
	files: z.array(z.number().int().positive()).min(1).max(2),
});

export type SampleCreateRequest = z.infer<typeof SampleCreateRequest>;

/** Fields accepted when updating a sample. Only those present are changed. */
export const SampleUpdateRequest = z.object({
	name: z.string().trim().min(1).optional(),
	host: z.string().trim().optional(),
	isolate: z.string().trim().optional(),
	locale: z.string().trim().optional(),
	notes: z.string().trim().optional(),
	labels: z.array(z.number().int().positive()).optional(),
	subtractions: z.array(z.number().int().positive()).optional(),
});

export type SampleUpdateRequest = z.infer<typeof SampleUpdateRequest>;
