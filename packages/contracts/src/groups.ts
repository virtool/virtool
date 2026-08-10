import type { Permissions } from "./permissions";
import type { SearchResult } from "./search";
import type { UserNested } from "./users";

/** A group reduced to the fields embedded in other resources. */
export type GroupMinimal = {
	/** The unique identifier */
	id: number;

	/** The Mongo-era string id, or null for a Postgres-native group */
	legacyId: string | null;

	/** The display name */
	name: string;
};

/** A group with its permissions and members. */
export type Group = GroupMinimal & {
	/** What the group grants every member */
	permissions: Permissions;

	/** The users belonging to the group */
	users: UserNested[];
};

/** A page of groups. */
export type GroupSearchResult = SearchResult & {
	/** The groups on this page */
	items: GroupMinimal[];
};
