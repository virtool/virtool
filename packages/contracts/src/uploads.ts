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

/**
 * How many blocks Azure Blob Storage admits in one block blob.
 *
 * The upload protocol is Azure's, so its limits bound every declared size the
 * server can accept. They live here rather than in the app because the browser
 * validators, the public REST route, and the administration form all check
 * against them.
 */
export const AZURE_MAX_BLOCK_COUNT = 50_000;

/** The largest single block Azure Blob Storage admits, in bytes. */
const AZURE_MAX_BLOCK_SIZE = 4_000 * 1024 * 1024;

/** The largest block blob Azure Blob Storage admits, in bytes. */
export const AZURE_MAX_BLOB_SIZE = AZURE_MAX_BLOCK_COUNT * AZURE_MAX_BLOCK_SIZE;

/**
 * The maximum upload size a settings row is seeded with, in bytes.
 *
 * Five gigabytes. An administrator raises it up to {@link AZURE_MAX_BLOB_SIZE},
 * which the protocol cannot exceed.
 */
export const DEFAULT_MAX_UPLOAD_SIZE = 5_000_000_000;

const byteFormatter = new Intl.NumberFormat("en-US");

/** Build the message shown when a file exceeds the configured maximum. */
export function formatMaxUploadSizeMessage(maximum: number): string {
	return `File exceeds the maximum upload size of ${byteFormatter.format(maximum)} bytes.`;
}

/** Raised when a declared upload size is above the configured maximum. */
export class UploadTooLargeError extends Error {
	constructor(readonly maximum: number) {
		super(formatMaxUploadSizeMessage(maximum));
		this.name = "UploadTooLargeError";
	}
}

/**
 * Check a declared upload size against the configured maximum.
 *
 * Shared by the browser, which refuses a file before any transfer starts, and
 * by the server, which is the authority. Both raise the same message, so a file
 * refused at the drop zone reads the same as one refused at initialization.
 */
export function checkUploadSize(size: number, maximum: number): void {
	if (size > maximum) {
		throw new UploadTooLargeError(maximum);
	}
}

/** The upload rule a client needs to refuse a file before transferring it. */
export type UploadPolicy = {
	maxUploadSize: number;
};
