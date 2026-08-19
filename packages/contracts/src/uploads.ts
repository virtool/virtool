import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/** The columns an upload list can be sorted by. */
export const UPLOAD_SORT_FIELDS = [
	"createdAt",
	"name",
	"size",
	"user",
] as const;

/** A column an upload list can be sorted by. */
export type UploadSortField = (typeof UPLOAD_SORT_FIELDS)[number];

/** The kinds of file that can be uploaded. */
export const UPLOAD_TYPES = ["reference", "reads", "subtraction"] as const;

/** What a given upload holds, and therefore which pickers offer it. */
export type UploadType = (typeof UPLOAD_TYPES)[number];

/**
 * An upload as returned to the client. `name_on_disk` is internal and never
 * exposed.
 *
 * **Every timestamp is nullable, because its column is.** They are populated in
 * practice, but that is not an invariant this schema enforces, and a row
 * migrated from before a column existed carries null regardless. Typing them
 * non-null previously forced the mapper to substitute an epoch date, which
 * renders as a plausible-looking timestamp half a century ago rather than as
 * the absence it is.
 */
export type Upload = {
	id: number;
	createdAt: Date | null;
	name: string;
	ready: boolean;
	removed: boolean;
	removedAt: Date | null;
	reserved: boolean;
	size: number;
	type: string;
	uploadedAt: Date | null;

	/** The uploading user, or null if that account was removed */
	user: UserNested | null;
};

/** A page of uploads. */
export type UploadSearchResult = SearchResult & {
	/** The uploads on this page */
	items: Upload[];
};
