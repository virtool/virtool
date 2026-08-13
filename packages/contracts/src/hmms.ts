import { z } from "zod";
import type { SearchResult } from "./search";
import type { Task } from "./tasks";

/** A single sequence record backing an HMM annotation. */
export const HmmEntry = z.object({
	accession: z.string(),
	gi: z.string(),
	name: z.string(),
	organism: z.string(),
});

/** A single sequence record backing an HMM annotation. */
export type HmmEntry = z.infer<typeof HmmEntry>;

/**
 * One annotation as the HMM release archive's `annotations.json` carries it.
 *
 * The install task's input. It has no `id`: the ids are Postgres', assigned as
 * the rows are inserted, which is why {@link HmmAnnotationRecord} and this are
 * two shapes rather than one.
 */
export const HmmAnnotation = z.object({
	cluster: z.number().int(),
	count: z.number().int(),
	entries: z.array(HmmEntry),
	families: z.record(z.string(), z.number()),
	genera: z.record(z.string(), z.number()),
	length: z.number().int(),
	mean_entropy: z.number(),
	names: z.array(z.string()),
	total_entropy: z.number(),
});

/** One annotation as the HMM release archive's `annotations.json` carries it. */
export type HmmAnnotation = z.infer<typeof HmmAnnotation>;

/**
 * One annotation as the stored `hmm/annotations.json.gz` blob carries it.
 *
 * This shape has two independent implementations that cannot see each other —
 * `writeHmmAnnotations` in `@virtool/data` writes it, NuVs reads it out of the
 * bucket, and Python's `annotation_from_row` writes it too — so it lives here
 * rather than beside either of them.
 *
 * Field names are the database's snake_case, because the blob is a dump of
 * `hmms` rows rather than anything this codebase serves to a browser. `hidden`
 * is nullable: the column has no `NOT NULL`, and Python writes whatever it read.
 */
export const HmmAnnotationRecord = HmmAnnotation.extend({
	hidden: z.boolean().nullable(),
	id: z.number().int(),
});

/** One annotation as the stored `hmm/annotations.json.gz` blob carries it. */
export type HmmAnnotationRecord = z.infer<typeof HmmAnnotationRecord>;

/** An HMM as it appears in a search-result list. */
export type HmmMinimal = {
	id: number;
	cluster: number;
	count: number;
	families: Record<string, number>;
	names: string[];
};

/** A full HMM annotation, as returned by the detail endpoint. */
export type Hmm = HmmMinimal & {
	entries: HmmEntry[];
	genera: Record<string, number>;
	length: number;
	meanEntropy: number;
	totalEntropy: number;
};

/** Whether an HMM release is installed, and what the last install did. */
export type HmmStatus = {
	errors: string[];
	installed: { ready: boolean } | null;
	task: Task | null;
};

/** A page of HMMs, with the install status attached. */
export type HmmSearchResult = SearchResult & {
	/** The HMMs on this page */
	items: HmmMinimal[];

	/** Whether a release is installed, so a list can prompt to install one */
	status: HmmStatus;
};
