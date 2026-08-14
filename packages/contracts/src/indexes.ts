import { z } from "zod";
import type { OtuHistory } from "./otus";
import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/**
 * The kind of artifact an index file holds.
 *
 * `index_files.type` is a `text` column closed by the `ck_index_files_type`
 * CHECK constraint; this is the one declaration of what that constraint
 * admits, imported by the schema mirror rather than restated there.
 */
export const IndexFileType = z.enum(["json", "fasta", "bowtie2", "sqlite"]);

export type IndexFileType = z.infer<typeof IndexFileType>;

/** The reference an index was built from, reduced to the fields listings show. */
export type IndexReferenceNested = {
	/** The unique identifier */
	id: number;

	/** The display name */
	name: string;
};

/** An index reduced to the fields embedded in other resources. */
export type IndexNested = {
	/** The unique identifier */
	id: number;

	/** The build's version number, counting from zero within its reference */
	version: number;
};

/** An index as it appears in a search-result list. */
export type IndexMinimal = IndexNested & {
	/** The number of changes this build included */
	changeCount: number;

	/** When the build was started */
	createdAt: Date;

	/** The number of distinct OTUs those changes touched */
	modifiedOtuCount: number;

	/** Whether the build has finished and can be used in an analysis */
	ready: boolean;

	/** The reference the index was built from */
	reference: IndexReferenceNested;

	/** The user who started the build */
	user: UserNested;
};

/** A user who contributed changes to an index, with their change count. */
export type IndexContributor = UserNested & {
	/** The number of changes the user contributed */
	count: number;
};

/** An OTU an index included changes to. */
export type IndexOtu = {
	/** The number of changes the build included for this OTU */
	changeCount: number;

	/** The unique identifier */
	id: string;

	/** The display name */
	name: string;
};

/** A downloadable file produced by an index build. */
export type IndexFile = {
	/**
	 * Where the file can be downloaded from, relative to the API root. Index
	 * files are still served by the Python API.
	 */
	downloadUrl: string;

	/** The unique identifier */
	id: number;

	/** The id of the index the file belongs to */
	index: number;

	/** The file name */
	name: string;

	/** The size in bytes, or null while the build has not recorded one */
	size: number | null;

	/**
	 * The object's complete key in storage, as recorded when it was written.
	 *
	 * Nothing composes this from the row's identity: a migrated file keeps
	 * whatever prefix its object was written under, so no pattern reconstructs
	 * one. A workflow reads the bytes itself and has no other way to locate them.
	 */
	storageKey: string;

	/** The kind of artifact the file holds */
	type: string;
};

/** A full index, as returned by the detail endpoint. */
export type Index = IndexMinimal & {
	/** The users who contributed the changes this build included */
	contributors: IndexContributor[];

	/** The files the build produced */
	files: IndexFile[];

	/** The OTU versions the build is pinned to, keyed by OTU id */
	manifest: Record<string, number>;

	/** The OTUs the build included changes to */
	otus: IndexOtu[];
};

/**
 * A page of indexes.
 *
 * The three counts are the reference's *unbuilt* totals — what the next build
 * would include — not a summary of the page. They are what a list view needs in
 * order to decide whether to offer a rebuild.
 */
export type IndexSearchResult = SearchResult & {
	/** The indexes on this page */
	items: IndexMinimal[];

	/** The number of changes not yet included in any build */
	changeCount: number;

	/** The number of distinct OTUs those changes touched */
	modifiedOtuCount: number;

	/** The total number of OTUs in scope */
	totalOtuCount: number;
};

/** A page of changes awaiting the next index build. */
export type UnbuiltChangesSearchResult = SearchResult & {
	/** The unbuilt changes on this page */
	items: OtuHistory[];
};
