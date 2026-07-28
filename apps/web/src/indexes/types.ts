import type { ReferenceNested } from "@references/types";
import { z } from "zod";
import type { SearchResult } from "@/types/api";

const referenceNestedSchema = z.object({
	id: z.int(),
	data_type: z.string(),
	name: z.string(),
});

const userNestedSchema = z.object({
	id: z.int(),
	handle: z.string(),
});

const indexNestedSchema = z.object({
	id: z.int(),
	version: z.union([z.number(), z.string()]),
});

/** Basic data for nested representations */
export type IndexNested = z.infer<typeof indexNestedSchema>;

/** Minimal index data for list views */
export const indexMinimalSchema = indexNestedSchema.extend({
	change_count: z.number().nullable(),
	created_at: z.string(),
	modified_otu_count: z.number(),
	reference: referenceNestedSchema,
	user: userNestedSchema,
	ready: z.boolean(),
});

/** Minimal index data for list views */
export type IndexMinimal = z.infer<typeof indexMinimalSchema>;

const indexContributorSchema = userNestedSchema.extend({
	count: z.number(),
});

/** Index editor information */
export type IndexContributor = z.infer<typeof indexContributorSchema>;

const indexOTUSchema = z.object({
	change_count: z.number(),
	id: z.string(),
	name: z.string(),
});

/** Index relevant minimal OTU data */
export type IndexOTU = z.infer<typeof indexOTUSchema>;

const indexFileSchema = z.object({
	download_url: z.string(),
	id: z.int(),
	index: z.int(),
	name: z.string(),
	size: z.number().optional(),
	type: z.string(),
});

/** A downloadable file produced by an index build */
export type IndexFile = z.infer<typeof indexFileSchema>;

/** Reference index for use in workflows */
export const indexSchema = indexMinimalSchema.extend({
	contributors: z.array(indexContributorSchema),
	files: z.array(indexFileSchema),
	manifest: z.record(z.string(), z.unknown()),
	otus: z.array(indexOTUSchema),
});

/** Reference index for use in workflows */
export type Index = z.infer<typeof indexSchema>;

// Indexes are still served by the Python API, so `GET /refs/{refId}/history`
// answers in snake_case. The equivalent OTU shapes now live in
// `@virtool/contracts` as the camelCase wire shape the TypeScript server
// returns, so reusing them here would silently mistype every field. These stay
// declared locally until indexes move off Python too.
type UnbuiltHistoryNested = {
	/** When the change was made */
	created_at: string;

	/** A human-readable description of the change */
	description: string;

	/** The unique identifier */
	id: string;

	/** The name of the method that made the change (eg. edit_sequence) */
	method_name: string;

	/** The user who made the change */
	user: z.infer<typeof userNestedSchema>;
};

type UnbuiltOtuNested = {
	/** The unique identifier */
	id: string;

	/** The display name */
	name: string;

	/** The revision number, incremented on every change */
	version: number;
};

/** An unbuilt change awaiting the next index build */
export type UnbuiltChanges = UnbuiltHistoryNested & {
	index: IndexNested | null;
	otu: UnbuiltOtuNested;
	reference: ReferenceNested;
};

/** Unbuilt changes search results */
export type UnbuiltChangesSearchResults = SearchResult & {
	items: UnbuiltChanges[];
};

/** Index search results */
export type IndexSearchResult = SearchResult & {
	/** Indexes relevant to the query */
	items: IndexMinimal[];
	/** The number of individual OTUs changed since the last index build */
	modified_otu_count: number;
	/** The number of total OTUs in the reference */
	total_otu_count: number;
	/** The number of total changes in the reference since the last index build */
	change_count: number;
};
