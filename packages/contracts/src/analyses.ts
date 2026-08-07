import { z } from "zod";
import type { JobNested } from "./jobs";
import type { JsonObject } from "./json";
import type { SearchResult } from "./search";
import type { SubtractionNested } from "./subtractions";
import type { UserNested } from "./users";

/**
 * A workflow that produces an analysis.
 *
 * Strictly narrower than `JobWorkflow`: an analysis is only ever the output of
 * Pathoscope or NuVs. The wider union would let a caller ask for an analysis
 * run by `create_sample`, which has no meaning and no result shape.
 */
export const AnalysisWorkflow = z.enum(["pathoscope", "nuvs"]);

export type AnalysisWorkflow = z.infer<typeof AnalysisWorkflow>;

/**
 * A format an analysis result file can be stored in.
 *
 * Mirrors Python's `AnalysisFormat`, a real Postgres enum (`analysisformat`)
 * behind `analysis_files.format`. Distinct from a sample artifact's `type` even
 * though the two share their members today — they are separate upstream enums
 * and are free to diverge.
 */
export const AnalysisFormat = z.enum([
	"sam",
	"bam",
	"fasta",
	"fastq",
	"csv",
	"tsv",
	"json",
]);

export type AnalysisFormat = z.infer<typeof AnalysisFormat>;

/** The parent sample of an analysis, reduced to id and name. */
export type AnalysisSampleNested = {
	/** The unique identifier */
	id: number;

	/** The sample name */
	name: string;
};

/** The reference an analysis was run against, reduced to id and name. */
export type AnalysisReferenceNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/**
 * The index build an analysis was run against. The version is not stored on the
 * analysis; it is read from the build the `index_id` foreign key points at.
 */
export type AnalysisIndexNested = {
	/** The unique identifier */
	id: number;

	/** The build's version number */
	version: number;
};

/** The job that ran an analysis workflow. */
export type AnalysisJobNested = JobNested & { workflow: AnalysisWorkflow };

/** An analysis as it appears in a search-result list. */
export type AnalysisMinimal = {
	/** When the analysis was created */
	createdAt: Date;

	/** The unique identifier */
	id: number;

	/** The reference index used in the analysis */
	index: AnalysisIndexNested;

	/** The job that ran the analysis workflow */
	job: AnalysisJobNested | null;

	/** Whether the analysis is complete and ready to view */
	ready: boolean;

	/** The reference used for the analysis */
	reference: AnalysisReferenceNested;

	/** The parent sample for the analysis */
	sample: AnalysisSampleNested;

	/** Subtractions used in the analysis */
	subtractions: SubtractionNested[];

	/** When the analysis was last updated */
	updatedAt: Date;

	/** The user who started the analysis */
	user: UserNested;

	/** The workflow used to generate the analysis */
	workflow: AnalysisWorkflow;
};

/** A result file retained by a workflow and offered for download. */
export type AnalysisFile = {
	/** The id of the parent analysis */
	analysis: number;

	/** A description of the file's contents */
	description: string | null;

	/** The file's format, e.g. `tsv` */
	format: string;

	/** The unique identifier */
	id: number;

	/** The file name */
	name: string;

	/** The name the file is stored under */
	nameOnDisk: string;

	/** The size of the file in bytes */
	size: number | null;

	/** When the file was uploaded */
	uploadedAt: Date | null;
};

/**
 * An analysis, as returned by the detail endpoint.
 *
 * The results are not part of this shape. They are the expensive half of an
 * analysis and are fetched on their own, so that what a viewer can draw
 * immediately does not wait on what it cannot.
 */
export type Analysis = AnalysisMinimal & {
	/** Files generated during the analysis that are available for download */
	files: AnalysisFile[];
};

/**
 * The results of an analysis, shaped for presentation, or null if it has not
 * finished.
 *
 * The internals are the worker's contract — the keys inside stay exactly as the
 * workflow emitted them, and are not renamed to this package's camelCase
 * convention.
 */
export type AnalysisResults = JsonObject | null;

/** A page of analyses. */
export type AnalysisSearchResult = SearchResult & {
	items: AnalysisMinimal[];
};
