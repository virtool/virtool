import type { JobState, JobWorkflow } from "./jobs";
import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/** A subtraction reduced to the fields embedded in other resources. */
export type SubtractionNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/** The percentage of the genome made up by each nucleotide. */
export type NucleotideComposition = {
	a: number;
	c: number;
	g: number;
	t: number;
	/** Unknown nucleotide */
	n: number;
};

/** The compact upload snapshot attached to a subtraction as `file`. */
export type SubtractionUpload = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/**
 * A subtraction's create job, reduced to what the list and detail show.
 *
 * `state` and `workflow` come out of plain `text` columns Python writes, so the
 * union is asserted once where the row is mapped rather than threaded through
 * as `string`.
 */
export type SubtractionJobMinimal = {
	id: number;
	created_at: string;
	progress: number;
	state: JobState;
	user: UserNested | null;
	workflow: JobWorkflow;
};

/** A downloadable file belonging to a subtraction. */
export type SubtractionFile = {
	download_url: string;
	id: number;
	name: string;
	size: number;
	subtraction: number;
	type: string;
};

/** A sample linked to a subtraction through the default-subtraction join. */
export type SubtractionSampleNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/** A subtraction as it appears in a search-result list. */
export type SubtractionMinimal = SubtractionNested & {
	/** The number of sequences, or null before the create job finishes */
	count: number | null;

	created_at: string;

	/** The upload it was built from, or null once that upload is gone */
	file: SubtractionUpload | null;

	/** The create job, or null for a subtraction migrated without one */
	job: SubtractionJobMinimal | null;

	nickname: string;

	/** Whether the create job finished and the subtraction can be used */
	ready: boolean;

	/** The creating user, or null if that account was removed */
	user: UserNested | null;
};

/** A full subtraction, as returned by the detail endpoint. */
export type Subtraction = SubtractionMinimal & {
	/** Files available for download */
	files: SubtractionFile[];

	/** The ATGC ratios in the genome, or null before the job computes them */
	gc: NucleotideComposition | null;

	/** Samples that name this subtraction as a default */
	linked_samples: SubtractionSampleNested[];
};

/** A subtraction reduced to the fields the analysis picker needs. */
export type SubtractionShortlistItem = SubtractionNested & {
	ready: boolean;
};

/** A page of subtractions, with a count of those ready to use. */
export type SubtractionSearchResult = SearchResult & {
	/** How many of the found subtractions are ready */
	readyCount: number;

	/** The subtractions on this page */
	items: SubtractionMinimal[];
};
