import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/** The kinds of file that can be uploaded. */
export const UPLOAD_TYPES = ["reference", "reads", "subtraction"] as const;

/** What a given upload holds, and therefore which pickers offer it. */
export type UploadType = (typeof UPLOAD_TYPES)[number];

/**
 * An upload as returned to the client. Mirrors Python's `UploadMinimal`:
 * `name_on_disk` is internal and never exposed.
 *
 * Every field but `removed_at` and `user` is non-null: the columns are nullable
 * at the database level, but Python sets them all when it creates a row and
 * `findUploads` only ever returns `ready` rows, so a listed or created upload
 * always carries them.
 */
export type Upload = {
	id: number;
	created_at: string;
	name: string;
	ready: boolean;
	removed: boolean;
	removed_at: string | null;
	reserved: boolean;
	size: number;
	type: string;
	uploaded_at: string;

	/** The uploading user, or null if that account was removed */
	user: UserNested | null;
};

/** A page of uploads. */
export type UploadSearchResult = SearchResult & {
	/** The uploads on this page */
	items: Upload[];
};
