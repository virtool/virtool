import { z } from "zod";
import type { SearchResult } from "./search";

/** HMM profile metadata returned by `GET /hmms` (nuvs only). Provisional shape. */
export const Hmms = z.array(
	z.object({
		id: z.number().int().nonnegative(),
		cluster: z.number().int().nonnegative(),
	}),
);

export type Hmms = z.infer<typeof Hmms>;

/** A single sequence record backing an HMM annotation. */
export type HmmEntry = {
	accession: string;
	gi: string;
	name: string;
	organism: string;
};

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

/** The task attached to the HMM status, in the wire shape the client parses. */
export type HmmStatusTask = {
	complete: boolean;
	createdAt: Date;
	error: string | null;
	id: number;
	progress: number;
	step: string;
	type: string;
};

/** Whether an HMM release is installed, and what the last install did. */
export type HmmStatus = {
	errors: string[];
	installed: { ready: boolean } | null;
	task: HmmStatusTask | null;
};

/** A page of HMMs, with the install status attached. */
export type HmmSearchResult = SearchResult & {
	/** The HMMs on this page */
	items: HmmMinimal[];

	/** Whether a release is installed, so a list can prompt to install one */
	status: HmmStatus;
};
