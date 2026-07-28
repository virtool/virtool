import { z } from "zod";
import type { SearchResult } from "./search";
import type { Task } from "./tasks";
import type { UserNested } from "./users";

/** The three per-reference rights a member (user or group) can be granted. */
export type ReferenceRights = {
	build: boolean;
	modify: boolean;
	modifyOtu: boolean;
};

/** The name of a single reference right. */
export type ReferenceRight = keyof ReferenceRights;

/** A user granted rights on a reference. */
export type ReferenceUser = ReferenceRights & {
	id: number;
	handle: string;
	createdAt: Date;
};

/** A group granted rights on a reference. */
export type ReferenceGroup = ReferenceRights & {
	id: number;
	name: string;
	createdAt: Date;
};

/** The reference a clone was created from, reduced to id and name. */
export type ReferenceClonedFrom = { id: number; name: string };

/** A contributor to a reference's history, with their change count. */
export type ReferenceContributor = UserNested & { count: number };

/** The most recent ready build (index) of a reference. */
export type ReferenceBuild = {
	id: number;
	version: number;
	createdAt: Date;
	user: UserNested;
};

/** The upload a reference was imported from, with its uploader. */
export type ReferenceImportedFrom = {
	id: number;
	name: string;
	createdAt: Date | null;
	size: number | null;
	user: UserNested | null;
};

/** A reference as it appears in a search-result list. */
export type ReferenceMinimal = {
	id: number;
	dataType: string;
	name: string;
	archived: boolean;
	clonedFrom: ReferenceClonedFrom | null;
	createdAt: Date;
	importedFrom: ReferenceImportedFrom | null;
	latestBuild: ReferenceBuild | null;
	organism: string;
	otuCount: number;
	task: Task | null;
	user: UserNested | null;
};

/** A full reference, as returned by the detail endpoint. */
export type Reference = ReferenceMinimal & {
	contributors: ReferenceContributor[];
	description: string;
	groups: ReferenceGroup[];
	restrictSourceTypes: boolean;
	sourceTypes: string[];
	users: ReferenceUser[];
};

/** A page of references. */
export type ReferenceSearchResult = SearchResult & {
	items: ReferenceMinimal[];
};

/**
 * Fields accepted when creating a reference. An empty name, description, or
 * organism is allowed; a clone fills the name in from its source. At most one
 * of `cloneFrom` and `importFrom` may be set — the server function enforces
 * that on top of this shape.
 */
export const ReferenceCreateRequest = z.object({
	name: z.string().trim().default(""),
	description: z.string().trim().default(""),
	organism: z.string().trim().default(""),
	cloneFrom: z.number().int().positive().optional(),
	importFrom: z.number().int().positive().optional(),
});

export type ReferenceCreateRequest = z.infer<typeof ReferenceCreateRequest>;

/** Fields accepted when updating a reference. Only those present are changed. */
export const ReferenceUpdateRequest = z.object({
	name: z.string().trim().min(1).optional(),
	description: z.string().optional(),
	organism: z.string().optional(),
	restrictSourceTypes: z.boolean().optional(),
	sourceTypes: z.array(z.string()).optional(),
});

export type ReferenceUpdateRequest = z.infer<typeof ReferenceUpdateRequest>;
