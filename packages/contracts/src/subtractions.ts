import { z } from "zod";
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

/**
 * The fraction of the genome made up by each nucleotide.
 *
 * Each value is in `[0, 1]`, **not** a percentage — `toGcContent` formats it as
 * one for display. The bound is what catches a workflow that finalizes with
 * percentages by mistake, which is the plausible unit error here; a per-nucleotide
 * `count / total` can never exceed 1, so it costs a correct payload nothing.
 *
 * A schema rather than a plain type because the jobs API validates it at
 * subtraction finalize.
 */
const nucleotideFraction = z.number().min(0).max(1);

export const NucleotideComposition = z.object({
	a: nucleotideFraction,
	c: nucleotideFraction,
	g: nucleotideFraction,
	t: nucleotideFraction,
	/** Unknown nucleotide */
	n: nucleotideFraction,
});

export type NucleotideComposition = z.infer<typeof NucleotideComposition>;

/**
 * One of the file types a subtraction can hold.
 *
 * `fasta` is the source genome; `bowtie2` is one shard of the built index.
 */
export const SubtractionFileType = z.enum(["fasta", "bowtie2"]);

export type SubtractionFileType = z.infer<typeof SubtractionFileType>;

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

	/**
	 * The object's complete key in storage, as recorded when it was written, or
	 * null for a file that predates keys being recorded.
	 *
	 * Nothing composes this from the row's identity: a migrated file keeps
	 * whatever prefix its object was written under, so no pattern reconstructs
	 * one. A workflow reads the bytes itself and has no other way to locate them.
	 */
	storageKey: string | null;

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
