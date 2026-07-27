import { z } from "zod";
import type { JobNested } from "./jobs";
import type { JsonObject } from "./json";
import type { SearchResultV2 } from "./search";
import type { SubtractionNested } from "./subtractions";
import type { UserNested } from "./users";
import type { WorkflowName } from "./workflowName";

/** The parent sample of an analysis, reduced to its id. */
export type AnalysisSampleNested = {
	/** The unique identifier */
	id: number;
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
export type AnalysisJobNested = JobNested & { workflow: WorkflowName };

/** An analysis as it appears in a search-result list. */
export type AnalysisMinimal = {
	/** When the analysis was created */
	createdAt: string;

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
	updatedAt: string;

	/** The user who started the analysis */
	user: UserNested;

	/** The workflow used to generate the analysis */
	workflow: WorkflowName;
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
	uploadedAt: string | null;
};

/**
 * A complete analysis, as returned by the detail endpoint.
 *
 * `results` is the workflow's own output. Its internals are the worker's
 * contract — the keys inside stay exactly as the workflow emitted them, and are
 * not renamed to this package's camelCase convention.
 */
export type Analysis = AnalysisMinimal & {
	/** Files generated during the analysis that are available for download */
	files: AnalysisFile[];

	/** The results of the analysis, shaped for presentation */
	results: JsonObject | null;
};

/** A page of analyses. */
export type AnalysisSearchResult = SearchResultV2 & {
	items: AnalysisMinimal[];
};

/** Body for the single-call `POST /analyses/{id}/results` write. */
export const AnalysisFinalize = z.object({
	results: z.unknown(),
});

export type AnalysisFinalize = z.infer<typeof AnalysisFinalize>;
